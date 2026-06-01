use super::{migrations, Database, DbResult};

pub(super) fn migrate(db: &Database) -> DbResult<()> {
    create_base_schema(db)?;
    ensure_games_columns(db)?;
    ensure_play_session_columns(db)?;
    ensure_task_columns(db)?;
    ensure_match_job_columns(db)?;
    migrations::apply_versioned_migrations(db)?;
    Ok(())
}

fn create_base_schema(db: &Database) -> DbResult<()> {
    db.conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS games (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          original_title TEXT,
          aliases TEXT NOT NULL DEFAULT '[]',
          developer TEXT,
          publisher TEXT,
          brand TEXT,
          release_date TEXT,
          description TEXT,
          notes TEXT,
          tags TEXT NOT NULL DEFAULT '[]',
          genres TEXT NOT NULL DEFAULT '[]',
          rating INTEGER,
          age_rating TEXT,
          play_status TEXT NOT NULL DEFAULT 'planned',
          favorite INTEGER NOT NULL DEFAULT 0,
          hidden INTEGER NOT NULL DEFAULT 0,
          install_path TEXT NOT NULL,
          executable_path TEXT,
          working_directory TEXT,
          launch_args TEXT,
          path_status TEXT NOT NULL DEFAULT 'unknown',
          last_path_checked_at TEXT,
          cover_image TEXT,
          banner_image TEXT,
          background_image TEXT,
          vndb_id TEXT,
          bangumi_id TEXT,
          dlsite_id TEXT,
          fanza_id TEXT,
          ymgal_id TEXT,
          total_play_seconds INTEGER NOT NULL DEFAULT 0,
          last_played_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS play_sessions (
          id TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
          launch_profile_id TEXT,
          started_at TEXT NOT NULL,
          ended_at TEXT,
          duration_seconds INTEGER NOT NULL DEFAULT 0,
          exit_status TEXT,
          FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE,
          FOREIGN KEY(launch_profile_id) REFERENCES launch_profiles(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS library_roots (
          id TEXT PRIMARY KEY,
          path TEXT NOT NULL UNIQUE,
          recursive INTEGER NOT NULL DEFAULT 1,
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS metadata_cache (
          key TEXT PRIMARY KEY,
          provider TEXT NOT NULL,
          request TEXT NOT NULL,
          response TEXT NOT NULL,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS metadata_match_jobs (
          id TEXT PRIMARY KEY,
          task_id TEXT,
          status TEXT NOT NULL,
          total INTEGER NOT NULL,
          completed INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS metadata_match_results (
          id TEXT PRIMARY KEY,
          job_id TEXT NOT NULL,
          game_id TEXT NOT NULL,
          original_title TEXT NOT NULL,
          cleaned_title TEXT,
          selected_provider TEXT,
          selected_id TEXT,
          selected_score REAL,
          status TEXT NOT NULL,
          reason TEXT,
          candidates TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          FOREIGN KEY(job_id) REFERENCES metadata_match_jobs(id) ON DELETE CASCADE,
          FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          status TEXT NOT NULL,
          progress REAL NOT NULL DEFAULT 0,
          message TEXT,
          error TEXT,
          retry_payload TEXT,
          retryable INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS task_logs (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          level TEXT NOT NULL,
          message TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS scan_task_results (
          task_id TEXT PRIMARY KEY,
          path TEXT NOT NULL,
          recursive INTEGER NOT NULL,
          candidates TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS launch_profiles (
          id TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
          name TEXT NOT NULL,
          executable_path TEXT NOT NULL,
          working_directory TEXT,
          arguments TEXT,
          environment_variables TEXT,
          runner_type TEXT NOT NULL DEFAULT 'direct',
          locale_emulator_path TEXT,
          pre_launch_command TEXT,
          post_launch_command TEXT,
          run_as_admin INTEGER NOT NULL DEFAULT 0,
          is_default INTEGER NOT NULL DEFAULT 0,
          compatibility_notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS field_locks (
          id TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
          field_name TEXT NOT NULL,
          locked_by_user INTEGER NOT NULL DEFAULT 1,
          updated_at TEXT NOT NULL,
          UNIQUE(game_id, field_name),
          FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS metadata_sources (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL UNIQUE,
          label TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1,
          priority INTEGER NOT NULL DEFAULT 100,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS external_ids (
          id TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          external_id TEXT NOT NULL,
          source TEXT,
          confidence REAL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(game_id, provider),
          FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS collections (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          color TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS collection_games (
          collection_id TEXT NOT NULL,
          game_id TEXT NOT NULL,
          added_at TEXT NOT NULL,
          PRIMARY KEY(collection_id, game_id),
          FOREIGN KEY(collection_id) REFERENCES collections(id) ON DELETE CASCADE,
          FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS game_assets (
          id TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
          asset_type TEXT NOT NULL,
          uri TEXT NOT NULL,
          source TEXT,
          is_primary INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(game_id, asset_type, uri),
          FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          kind TEXT NOT NULL DEFAULT 'tag',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(name, kind)
        );

        CREATE TABLE IF NOT EXISTS game_tags (
          game_id TEXT NOT NULL,
          tag_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY(game_id, tag_id),
          FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE,
          FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
        );
        "#,
    )?;
    Ok(())
}

fn ensure_games_columns(db: &Database) -> DbResult<()> {
    let required = [
        ("original_title", "TEXT"),
        ("aliases", "TEXT NOT NULL DEFAULT '[]'"),
        ("developer", "TEXT"),
        ("publisher", "TEXT"),
        ("brand", "TEXT"),
        ("release_date", "TEXT"),
        ("description", "TEXT"),
        ("notes", "TEXT"),
        ("tags", "TEXT NOT NULL DEFAULT '[]'"),
        ("genres", "TEXT NOT NULL DEFAULT '[]'"),
        ("rating", "INTEGER"),
        ("age_rating", "TEXT"),
        ("play_status", "TEXT NOT NULL DEFAULT 'planned'"),
        ("favorite", "INTEGER NOT NULL DEFAULT 0"),
        ("hidden", "INTEGER NOT NULL DEFAULT 0"),
        ("executable_path", "TEXT"),
        ("working_directory", "TEXT"),
        ("launch_args", "TEXT"),
        ("path_status", "TEXT NOT NULL DEFAULT 'unknown'"),
        ("last_path_checked_at", "TEXT"),
        ("cover_image", "TEXT"),
        ("banner_image", "TEXT"),
        ("background_image", "TEXT"),
        ("vndb_id", "TEXT"),
        ("bangumi_id", "TEXT"),
        ("dlsite_id", "TEXT"),
        ("fanza_id", "TEXT"),
        ("ymgal_id", "TEXT"),
        ("total_play_seconds", "INTEGER NOT NULL DEFAULT 0"),
        ("last_played_at", "TEXT"),
        ("created_at", "TEXT NOT NULL DEFAULT ''"),
        ("updated_at", "TEXT NOT NULL DEFAULT ''"),
    ];
    ensure_columns(db, "games", &required)
}

fn ensure_play_session_columns(db: &Database) -> DbResult<()> {
    ensure_columns(
        db,
        "play_sessions",
        &[("launch_profile_id", "TEXT"), ("exit_status", "TEXT")],
    )
}

pub(super) fn ensure_task_columns(db: &Database) -> DbResult<()> {
    ensure_columns(
        db,
        "tasks",
        &[
            ("retry_payload", "TEXT"),
            ("retryable", "INTEGER NOT NULL DEFAULT 0"),
        ],
    )
}

pub(super) fn ensure_match_job_columns(db: &Database) -> DbResult<()> {
    let columns = table_columns(db, "metadata_match_jobs")?;
    if !columns.iter().any(|column| column == "task_id") {
        db.conn.execute(
            "ALTER TABLE metadata_match_jobs ADD COLUMN task_id TEXT",
            [],
        )?;
    }
    Ok(())
}

fn ensure_columns(db: &Database, table: &str, required: &[(&str, &str)]) -> DbResult<()> {
    let columns = table_columns(db, table)?;
    for (name, definition) in required {
        if !columns.iter().any(|column| column == name) {
            db.conn.execute(
                &format!("ALTER TABLE {table} ADD COLUMN {name} {definition}"),
                [],
            )?;
        }
    }
    Ok(())
}

pub(super) fn table_columns(db: &Database, table: &str) -> DbResult<Vec<String>> {
    let mut stmt = db.conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(1))?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}
