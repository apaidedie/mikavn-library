use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::db::models::{
    CreateLaunchProfileInput, LaunchProfile, PlaySession, UpdateLaunchProfileInput,
};
use crate::db::{DbError, DbResult};

pub struct LaunchRepository<'a> {
    conn: &'a Connection,
}

impl<'a> LaunchRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn create_play_session(
        &self,
        game_id: String,
        launch_profile_id: Option<String>,
    ) -> DbResult<PlaySession> {
        let session = PlaySession {
            id: Uuid::new_v4().to_string(),
            game_id,
            launch_profile_id,
            started_at: now(),
            ended_at: None,
            duration_seconds: 0,
            exit_status: None,
        };
        self.conn.execute(
            "INSERT INTO play_sessions (id, game_id, launch_profile_id, started_at, duration_seconds) VALUES (?1, ?2, ?3, ?4, 0)",
            params![&session.id, &session.game_id, &session.launch_profile_id, &session.started_at],
        )?;
        Ok(session)
    }

    pub fn finish_play_session(
        &self,
        session_id: String,
        exit_status: Option<String>,
    ) -> DbResult<()> {
        let session = self
            .conn
            .query_row(
                "SELECT id, game_id, launch_profile_id, started_at, ended_at, duration_seconds, exit_status FROM play_sessions WHERE id = ?1",
                params![session_id],
                play_session_from_row,
            )
            .optional()?
            .ok_or_else(|| DbError::new("VALIDATION_ERROR", "play session not found"))?;

        if session.ended_at.is_some() {
            return Ok(());
        }

        let ended_at = Utc::now();
        let started_at = DateTime::parse_from_rfc3339(&session.started_at)
            .map_err(|error| DbError::validation(format!("invalid session start time: {error}")))?;
        let duration_seconds = (ended_at - started_at.with_timezone(&Utc))
            .num_seconds()
            .max(0);
        let ended_at_string = ended_at.to_rfc3339();

        self.conn.execute(
            "UPDATE play_sessions SET ended_at = ?2, duration_seconds = ?3, exit_status = ?4 WHERE id = ?1",
            params![&session.id, ended_at_string, duration_seconds, exit_status],
        )?;
        self.conn.execute(
            "UPDATE games SET total_play_seconds = total_play_seconds + ?2, last_played_at = ?3, updated_at = ?3 WHERE id = ?1",
            params![session.game_id, duration_seconds, ended_at_string],
        )?;
        Ok(())
    }

    pub fn list_play_sessions(&self, game_id: String, limit: i64) -> DbResult<Vec<PlaySession>> {
        let limit = limit.clamp(1, 200);
        let mut stmt = self.conn.prepare(
            "SELECT id, game_id, launch_profile_id, started_at, ended_at, duration_seconds, exit_status FROM play_sessions WHERE game_id = ?1 ORDER BY started_at DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![game_id, limit], play_session_from_row)?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn play_seconds_since(&self, since: DateTime<Utc>) -> DbResult<i64> {
        let value = self.conn.query_row(
            "SELECT COALESCE(SUM(duration_seconds), 0) FROM play_sessions WHERE ended_at IS NOT NULL AND ended_at >= ?1",
            params![since.to_rfc3339()],
            |row| row.get(0),
        )?;
        Ok(value)
    }

    pub fn create_launch_profile(
        &self,
        input: CreateLaunchProfileInput,
    ) -> DbResult<LaunchProfile> {
        let now = now();
        let is_default = input.is_default.unwrap_or(false)
            || self.list_launch_profiles(input.game_id.clone())?.is_empty();
        let profile = LaunchProfile {
            id: Uuid::new_v4().to_string(),
            game_id: input.game_id,
            name: trimmed_required(input.name, "name")?,
            executable_path: trimmed_required(input.executable_path, "executablePath")?,
            working_directory: trim_optional(input.working_directory),
            arguments: trim_optional(input.arguments),
            environment_variables: trim_optional(input.environment_variables),
            runner_type: normalize_runner_type(input.runner_type),
            locale_emulator_path: trim_optional(input.locale_emulator_path),
            pre_launch_command: trim_optional(input.pre_launch_command),
            post_launch_command: trim_optional(input.post_launch_command),
            run_as_admin: input.run_as_admin.unwrap_or(false),
            is_default,
            compatibility_notes: trim_optional(input.compatibility_notes),
            created_at: now.clone(),
            updated_at: now,
        };

        if profile.is_default {
            self.clear_default_launch_profile(&profile.game_id)?;
        }

        self.conn.execute(
            r#"
            INSERT INTO launch_profiles (
              id, game_id, name, executable_path, working_directory, arguments, environment_variables,
              runner_type, locale_emulator_path, pre_launch_command, post_launch_command, run_as_admin,
              is_default, compatibility_notes, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
            "#,
            params![
                &profile.id,
                &profile.game_id,
                &profile.name,
                &profile.executable_path,
                &profile.working_directory,
                &profile.arguments,
                &profile.environment_variables,
                &profile.runner_type,
                &profile.locale_emulator_path,
                &profile.pre_launch_command,
                &profile.post_launch_command,
                bool_int(profile.run_as_admin),
                bool_int(profile.is_default),
                &profile.compatibility_notes,
                &profile.created_at,
                &profile.updated_at,
            ],
        )?;

        self.get_launch_profile(&profile.id)
    }

    pub fn list_launch_profiles(&self, game_id: String) -> DbResult<Vec<LaunchProfile>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, game_id, name, executable_path, working_directory, arguments, environment_variables,
                   runner_type, locale_emulator_path, pre_launch_command, post_launch_command, run_as_admin,
                   is_default, compatibility_notes, created_at, updated_at
            FROM launch_profiles
            WHERE game_id = ?1
            ORDER BY is_default DESC, created_at ASC
            "#,
        )?;
        let rows = stmt.query_map(params![game_id], launch_profile_from_row)?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn get_launch_profile(&self, id: &str) -> DbResult<LaunchProfile> {
        self.conn
            .query_row(
                r#"
                SELECT id, game_id, name, executable_path, working_directory, arguments, environment_variables,
                       runner_type, locale_emulator_path, pre_launch_command, post_launch_command, run_as_admin,
                       is_default, compatibility_notes, created_at, updated_at
                FROM launch_profiles
                WHERE id = ?1
                "#,
                params![id],
                launch_profile_from_row,
            )
            .optional()?
            .ok_or_else(|| DbError::validation("launch profile not found"))
    }

    pub fn get_default_launch_profile(&self, game_id: &str) -> DbResult<Option<LaunchProfile>> {
        self.conn
            .query_row(
                r#"
                SELECT id, game_id, name, executable_path, working_directory, arguments, environment_variables,
                       runner_type, locale_emulator_path, pre_launch_command, post_launch_command, run_as_admin,
                       is_default, compatibility_notes, created_at, updated_at
                FROM launch_profiles
                WHERE game_id = ?1
                ORDER BY is_default DESC, created_at ASC
                LIMIT 1
                "#,
                params![game_id],
                launch_profile_from_row,
            )
            .optional()
            .map_err(DbError::from)
    }

    pub fn update_launch_profile(
        &self,
        id: String,
        input: UpdateLaunchProfileInput,
    ) -> DbResult<LaunchProfile> {
        let mut profile = self.get_launch_profile(&id)?;

        if let Some(value) = input.name {
            profile.name = trimmed_required(value, "name")?;
        }
        if let Some(value) = input.executable_path {
            profile.executable_path = trimmed_required(value, "executablePath")?;
        }
        if input.working_directory.is_some() {
            profile.working_directory = trim_optional(input.working_directory);
        }
        if input.arguments.is_some() {
            profile.arguments = trim_optional(input.arguments);
        }
        if input.environment_variables.is_some() {
            profile.environment_variables = trim_optional(input.environment_variables);
        }
        if input.runner_type.is_some() {
            profile.runner_type = normalize_runner_type(input.runner_type);
        }
        if input.locale_emulator_path.is_some() {
            profile.locale_emulator_path = trim_optional(input.locale_emulator_path);
        }
        if input.pre_launch_command.is_some() {
            profile.pre_launch_command = trim_optional(input.pre_launch_command);
        }
        if input.post_launch_command.is_some() {
            profile.post_launch_command = trim_optional(input.post_launch_command);
        }
        if let Some(value) = input.run_as_admin {
            profile.run_as_admin = value;
        }
        if let Some(value) = input.is_default {
            profile.is_default = value;
        }
        if input.compatibility_notes.is_some() {
            profile.compatibility_notes = trim_optional(input.compatibility_notes);
        }
        profile.updated_at = now();

        if profile.is_default {
            self.clear_default_launch_profile(&profile.game_id)?;
        }

        self.conn.execute(
            r#"
            UPDATE launch_profiles SET
              name = ?2, executable_path = ?3, working_directory = ?4, arguments = ?5,
              environment_variables = ?6, runner_type = ?7, locale_emulator_path = ?8,
              pre_launch_command = ?9, post_launch_command = ?10, run_as_admin = ?11,
              is_default = ?12, compatibility_notes = ?13, updated_at = ?14
            WHERE id = ?1
            "#,
            params![
                &profile.id,
                &profile.name,
                &profile.executable_path,
                &profile.working_directory,
                &profile.arguments,
                &profile.environment_variables,
                &profile.runner_type,
                &profile.locale_emulator_path,
                &profile.pre_launch_command,
                &profile.post_launch_command,
                bool_int(profile.run_as_admin),
                bool_int(profile.is_default),
                &profile.compatibility_notes,
                &profile.updated_at,
            ],
        )?;
        self.get_launch_profile(&id)
    }

    pub fn delete_launch_profile(&self, id: String) -> DbResult<()> {
        let profile = self.get_launch_profile(&id)?;
        self.conn
            .execute("DELETE FROM launch_profiles WHERE id = ?1", params![id])?;
        if profile.is_default {
            if let Some(next) = self.get_default_launch_profile(&profile.game_id)? {
                self.set_default_launch_profile(next.id)?;
            }
        }
        Ok(())
    }

    pub fn set_default_launch_profile(&self, id: String) -> DbResult<LaunchProfile> {
        let profile = self.get_launch_profile(&id)?;
        self.clear_default_launch_profile(&profile.game_id)?;
        self.conn.execute(
            "UPDATE launch_profiles SET is_default = 1, updated_at = ?2 WHERE id = ?1",
            params![&profile.id, now()],
        )?;
        self.get_launch_profile(&profile.id)
    }

    pub fn update_relocated_profile_paths(
        &self,
        game_id: &str,
        old_install: &str,
        new_install: &str,
        updated_at: &str,
    ) -> DbResult<()> {
        let profiles = self.list_launch_profiles(game_id.to_string())?;
        for profile in profiles {
            let executable_path = if profile.executable_path.starts_with(old_install) {
                profile
                    .executable_path
                    .replacen(old_install, new_install, 1)
            } else {
                profile.executable_path
            };
            let working_directory = profile.working_directory.map(|item| {
                if item.starts_with(old_install) {
                    item.replacen(old_install, new_install, 1)
                } else {
                    item
                }
            });
            self.conn.execute(
                "UPDATE launch_profiles SET executable_path = ?2, working_directory = ?3, updated_at = ?4 WHERE id = ?1",
                params![profile.id, executable_path, working_directory, updated_at],
            )?;
        }
        Ok(())
    }

    fn clear_default_launch_profile(&self, game_id: &str) -> DbResult<()> {
        self.conn.execute(
            "UPDATE launch_profiles SET is_default = 0 WHERE game_id = ?1",
            params![game_id],
        )?;
        Ok(())
    }
}

fn now() -> String {
    Utc::now().to_rfc3339()
}

fn bool_int(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

fn trim_optional(value: Option<String>) -> Option<String> {
    value
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
}

fn trimmed_required(value: String, field: &str) -> DbResult<String> {
    let trimmed = value.trim().to_string();
    if trimmed.is_empty() {
        Err(DbError::validation(format!("{field} is required")))
    } else {
        Ok(trimmed)
    }
}

fn normalize_runner_type(value: Option<String>) -> String {
    match value
        .as_deref()
        .map(str::trim)
        .filter(|item| !item.is_empty())
    {
        Some("locale_emulator") => "locale_emulator".to_string(),
        Some("custom_command") => "custom_command".to_string(),
        Some("shortcut_lnk") => "shortcut_lnk".to_string(),
        _ => "direct".to_string(),
    }
}

fn play_session_from_row(row: &Row<'_>) -> rusqlite::Result<PlaySession> {
    Ok(PlaySession {
        id: row.get(0)?,
        game_id: row.get(1)?,
        launch_profile_id: row.get(2)?,
        started_at: row.get(3)?,
        ended_at: row.get(4)?,
        duration_seconds: row.get(5)?,
        exit_status: row.get(6)?,
    })
}

fn launch_profile_from_row(row: &Row<'_>) -> rusqlite::Result<LaunchProfile> {
    Ok(LaunchProfile {
        id: row.get(0)?,
        game_id: row.get(1)?,
        name: row.get(2)?,
        executable_path: row.get(3)?,
        working_directory: row.get(4)?,
        arguments: row.get(5)?,
        environment_variables: row.get(6)?,
        runner_type: row.get(7)?,
        locale_emulator_path: row.get(8)?,
        pre_launch_command: row.get(9)?,
        post_launch_command: row.get(10)?,
        run_as_admin: row.get::<_, i64>(11)? != 0,
        is_default: row.get::<_, i64>(12)? != 0,
        compatibility_notes: row.get(13)?,
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
    })
}
