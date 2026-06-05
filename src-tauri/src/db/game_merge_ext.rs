use std::collections::{BTreeMap, BTreeSet};

use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row, Transaction};
use uuid::Uuid;

use crate::db::models::{
    DuplicateGameMergeExternalId, DuplicateGameMergeGameSummary, DuplicateGameMergeMovedCounts,
    DuplicateGameMergeOptions, DuplicateGameMergePreview, DuplicateGameMergeResult, Game,
};
use crate::db::{Database, DbError, DbResult};
use crate::repositories::games::game_from_row;

impl Database {
    pub fn preview_duplicate_game_merge(
        &self,
        options: DuplicateGameMergeOptions,
    ) -> DbResult<DuplicateGameMergePreview> {
        let plan = DuplicateMergePlan::build(&self.conn, options)?;
        let moved_counts = preview_moved_counts(&self.conn, &plan.source_ids)?;
        Ok(DuplicateGameMergePreview {
            target: summarize_game(&self.conn, &plan.target)?,
            sources: plan
                .sources
                .iter()
                .map(|game| summarize_game(&self.conn, game))
                .collect::<DbResult<Vec<_>>>()?,
            shared_external_ids: plan.shared_external_ids,
            moved_counts,
            warnings: plan.warnings,
        })
    }

    pub fn merge_duplicate_games(
        &self,
        options: DuplicateGameMergeOptions,
    ) -> DbResult<DuplicateGameMergeResult> {
        let plan = DuplicateMergePlan::build(&self.conn, options)?;
        let now = now();
        let tx = self.conn.unchecked_transaction()?;
        let moved_counts = execute_duplicate_game_merge(&tx, &plan, &now)?;
        tx.commit()?;

        Ok(DuplicateGameMergeResult {
            merged_game: self.get_game(plan.target.id)?,
            deleted_source_game_ids: plan.source_ids,
            moved_counts,
            warnings: plan.warnings,
        })
    }
}

#[derive(Debug, Clone)]
struct DuplicateMergePlan {
    target: Game,
    sources: Vec<Game>,
    source_ids: Vec<String>,
    final_target: Game,
    shared_external_ids: Vec<DuplicateGameMergeExternalId>,
    warnings: Vec<String>,
}

impl DuplicateMergePlan {
    fn build(conn: &Connection, options: DuplicateGameMergeOptions) -> DbResult<Self> {
        let target_id = trimmed_required(options.target_game_id, "targetGameId")?;
        let mut source_ids = Vec::new();
        for source_id in options.source_game_ids {
            let source_id = trimmed_required(source_id, "sourceGameIds")?;
            if source_id == target_id {
                return Err(DbError::validation("source game cannot be the target game"));
            }
            if !source_ids.contains(&source_id) {
                source_ids.push(source_id);
            }
        }
        if source_ids.is_empty() {
            return Err(DbError::validation("at least one source game is required"));
        }

        let target = get_game_for_merge(conn, &target_id)?;
        let mut sources = Vec::new();
        for source_id in &source_ids {
            sources.push(get_game_for_merge(conn, source_id)?);
        }

        let target_external_ids = collect_game_external_ids(conn, &target)?;
        let target_keys = external_id_keys(&target_external_ids);
        let mut shared = BTreeMap::new();
        let mut warnings = Vec::new();
        for source in &sources {
            let source_external_ids = collect_game_external_ids(conn, source)?;
            let source_shared = source_external_ids
                .iter()
                .filter(|external_id| target_keys.contains(&external_id_key(external_id)))
                .cloned()
                .collect::<Vec<_>>();
            if source_shared.is_empty() {
                return Err(DbError::validation(format!(
                    "source game '{}' does not share an external id with the target game",
                    source.title
                )));
            }
            for external_id in source_shared {
                shared.insert(external_id_key(&external_id), external_id);
            }
            append_external_id_conflict_warnings(
                &mut warnings,
                &target,
                &target_external_ids,
                source,
                &source_external_ids,
            );
            append_scalar_conflict_warnings(&mut warnings, &target, source);
        }

        let mut final_target = target.clone();
        for source in &sources {
            merge_game_fields(&mut final_target, source);
        }
        apply_target_external_id_precedence(&mut final_target, &target_external_ids);

        Ok(Self {
            target,
            sources,
            source_ids,
            final_target,
            shared_external_ids: shared.into_values().collect(),
            warnings,
        })
    }
}

fn execute_duplicate_game_merge(
    tx: &Transaction<'_>,
    plan: &DuplicateMergePlan,
    now: &str,
) -> DbResult<DuplicateGameMergeMovedCounts> {
    let mut moved_counts = DuplicateGameMergeMovedCounts {
        source_games: plan.source_ids.len() as i64,
        ..DuplicateGameMergeMovedCounts::default()
    };
    let original_default_profile_id = plan.target_default_profile_id(tx)?;

    update_target_game_for_merge(tx, &plan.final_target, now)?;
    moved_counts.external_ids += move_external_ids(tx, plan, now)?;
    ensure_external_ids_for_game(tx, &plan.final_target, now)?;

    for source_id in &plan.source_ids {
        moved_counts.collection_links += move_collection_links(tx, &plan.target.id, source_id)?;
        moved_counts.assets += move_assets(tx, &plan.target.id, source_id, now)?;
        moved_counts.tags += move_game_tags(tx, &plan.target.id, source_id)?;
        moved_counts.field_locks += move_field_locks(tx, &plan.target.id, source_id, now)?;
        moved_counts.save_paths += move_save_paths(tx, &plan.target.id, source_id)?;
        moved_counts.save_backups +=
            move_simple_game_rows(tx, "save_backups", &plan.target.id, source_id)?;
        moved_counts.launch_profiles +=
            move_simple_game_rows(tx, "launch_profiles", &plan.target.id, source_id)?;
        moved_counts.play_sessions +=
            move_simple_game_rows(tx, "play_sessions", &plan.target.id, source_id)?;
        moved_counts.metadata_match_results +=
            move_simple_game_rows(tx, "metadata_match_results", &plan.target.id, source_id)?;
    }

    ensure_json_tags_in_normalized_table(tx, &plan.final_target)?;
    normalize_primary_assets(tx, &plan.final_target, now)?;
    normalize_launch_profile_defaults(tx, &plan.target.id, original_default_profile_id, now)?;

    for source_id in &plan.source_ids {
        tx.execute("DELETE FROM games WHERE id = ?1", params![source_id])?;
    }

    Ok(moved_counts)
}

impl DuplicateMergePlan {
    fn target_default_profile_id(&self, tx: &Transaction<'_>) -> DbResult<Option<String>> {
        tx.query_row(
            "SELECT id FROM launch_profiles WHERE game_id = ?1 AND is_default = 1 ORDER BY created_at ASC LIMIT 1",
            params![self.target.id],
            |row| row.get(0),
        )
        .optional()
        .map_err(DbError::from)
    }
}

fn get_game_for_merge(conn: &Connection, id: &str) -> DbResult<Game> {
    conn.query_row(
        "SELECT * FROM games WHERE id = ?1",
        params![id],
        game_from_row,
    )
    .optional()?
    .ok_or_else(|| DbError::validation(format!("game not found: {id}")))
}

fn summarize_game(conn: &Connection, game: &Game) -> DbResult<DuplicateGameMergeGameSummary> {
    Ok(DuplicateGameMergeGameSummary {
        game_id: game.id.clone(),
        title: game.title.clone(),
        install_path: game.install_path.clone(),
        external_ids: collect_game_external_ids(conn, game)?,
        total_play_seconds: game.total_play_seconds,
        last_played_at: game.last_played_at.clone(),
    })
}

fn preview_moved_counts(
    conn: &Connection,
    source_ids: &[String],
) -> DbResult<DuplicateGameMergeMovedCounts> {
    let mut counts = DuplicateGameMergeMovedCounts {
        source_games: source_ids.len() as i64,
        ..DuplicateGameMergeMovedCounts::default()
    };
    for source_id in source_ids {
        counts.play_sessions += count_game_rows(conn, "play_sessions", source_id)?;
        counts.launch_profiles += count_game_rows(conn, "launch_profiles", source_id)?;
        counts.save_paths += count_game_rows(conn, "save_paths", source_id)?;
        counts.save_backups += count_game_rows(conn, "save_backups", source_id)?;
        counts.external_ids += count_game_rows(conn, "external_ids", source_id)?;
        counts.collection_links += count_game_rows(conn, "collection_games", source_id)?;
        counts.assets += count_game_rows(conn, "game_assets", source_id)?;
        counts.tags += count_game_rows(conn, "game_tags", source_id)?;
        counts.field_locks += count_game_rows(conn, "field_locks", source_id)?;
        counts.metadata_match_results +=
            count_game_rows(conn, "metadata_match_results", source_id)?;
    }
    Ok(counts)
}

fn count_game_rows(conn: &Connection, table: &str, game_id: &str) -> DbResult<i64> {
    let sql = format!("SELECT COUNT(*) FROM {table} WHERE game_id = ?1");
    conn.query_row(&sql, params![game_id], |row| row.get(0))
        .map_err(DbError::from)
}

fn move_simple_game_rows(
    tx: &Transaction<'_>,
    table: &str,
    target_game_id: &str,
    source_game_id: &str,
) -> DbResult<i64> {
    let sql = format!("UPDATE {table} SET game_id = ?1 WHERE game_id = ?2");
    Ok(tx.execute(&sql, params![target_game_id, source_game_id])? as i64)
}

fn move_save_paths(
    tx: &Transaction<'_>,
    target_game_id: &str,
    source_game_id: &str,
) -> DbResult<i64> {
    let mut stmt = tx.prepare("SELECT id, path FROM save_paths WHERE game_id = ?1")?;
    let rows = stmt.query_map(params![source_game_id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    let rows = rows.collect::<Result<Vec<_>, _>>()?;
    let moved = rows.len() as i64;
    for (source_path_id, path) in rows {
        let target_path_id: Option<String> = tx
            .query_row(
                "SELECT id FROM save_paths WHERE game_id = ?1 AND path = ?2",
                params![target_game_id, path],
                |row| row.get(0),
            )
            .optional()?;
        if let Some(target_path_id) = target_path_id {
            tx.execute(
                "UPDATE save_backups SET game_id = ?1, save_path_id = ?2 WHERE save_path_id = ?3",
                params![target_game_id, target_path_id, source_path_id],
            )?;
            tx.execute(
                "DELETE FROM save_paths WHERE id = ?1",
                params![source_path_id],
            )?;
        } else {
            tx.execute(
                "UPDATE save_paths SET game_id = ?1 WHERE id = ?2",
                params![target_game_id, source_path_id],
            )?;
        }
    }
    Ok(moved)
}

fn move_collection_links(
    tx: &Transaction<'_>,
    target_game_id: &str,
    source_game_id: &str,
) -> DbResult<i64> {
    let inserted = tx.execute(
        r#"
        INSERT OR IGNORE INTO collection_games (collection_id, game_id, added_at)
        SELECT collection_id, ?1, added_at FROM collection_games WHERE game_id = ?2
        "#,
        params![target_game_id, source_game_id],
    )?;
    tx.execute(
        "DELETE FROM collection_games WHERE game_id = ?1",
        params![source_game_id],
    )?;
    Ok(inserted as i64)
}

fn move_assets(
    tx: &Transaction<'_>,
    target_game_id: &str,
    source_game_id: &str,
    now: &str,
) -> DbResult<i64> {
    let mut stmt = tx.prepare(
        "SELECT id, asset_type, uri FROM game_assets WHERE game_id = ?1 ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map(params![source_game_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
        ))
    })?;
    let rows = rows.collect::<Result<Vec<_>, _>>()?;
    let moved = rows.len() as i64;
    for (id, asset_type, uri) in rows {
        let target_conflict: Option<String> = tx
            .query_row(
                "SELECT id FROM game_assets WHERE game_id = ?1 AND asset_type = ?2 AND uri = ?3",
                params![target_game_id, asset_type, uri],
                |row| row.get(0),
            )
            .optional()?;
        if target_conflict.is_some() {
            tx.execute("DELETE FROM game_assets WHERE id = ?1", params![id])?;
        } else {
            tx.execute(
                "UPDATE game_assets SET game_id = ?1, updated_at = ?3 WHERE id = ?2",
                params![target_game_id, id, now],
            )?;
        }
    }
    Ok(moved)
}

fn move_game_tags(
    tx: &Transaction<'_>,
    target_game_id: &str,
    source_game_id: &str,
) -> DbResult<i64> {
    let inserted = tx.execute(
        r#"
        INSERT OR IGNORE INTO game_tags (game_id, tag_id, created_at)
        SELECT ?1, tag_id, created_at FROM game_tags WHERE game_id = ?2
        "#,
        params![target_game_id, source_game_id],
    )?;
    tx.execute(
        "DELETE FROM game_tags WHERE game_id = ?1",
        params![source_game_id],
    )?;
    Ok(inserted as i64)
}

fn move_field_locks(
    tx: &Transaction<'_>,
    target_game_id: &str,
    source_game_id: &str,
    now: &str,
) -> DbResult<i64> {
    let mut stmt = tx.prepare(
        "SELECT id, field_name, locked_by_user FROM field_locks WHERE game_id = ?1 ORDER BY field_name ASC",
    )?;
    let rows = stmt.query_map(params![source_game_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, i64>(2)?,
        ))
    })?;
    let rows = rows.collect::<Result<Vec<_>, _>>()?;
    let moved = rows.len() as i64;
    for (id, field_name, locked_by_user) in rows {
        let target_lock: Option<String> = tx
            .query_row(
                "SELECT id FROM field_locks WHERE game_id = ?1 AND field_name = ?2",
                params![target_game_id, field_name],
                |row| row.get(0),
            )
            .optional()?;
        if target_lock.is_some() {
            tx.execute(
                r#"
                UPDATE field_locks
                SET locked_by_user = CASE WHEN locked_by_user = 1 OR ?3 = 1 THEN 1 ELSE 0 END,
                    updated_at = ?4
                WHERE game_id = ?1 AND field_name = ?2
                "#,
                params![target_game_id, field_name, locked_by_user, now],
            )?;
            tx.execute("DELETE FROM field_locks WHERE id = ?1", params![id])?;
        } else {
            tx.execute(
                "UPDATE field_locks SET game_id = ?1, updated_at = ?3 WHERE id = ?2",
                params![target_game_id, id, now],
            )?;
        }
    }
    Ok(moved)
}

#[derive(Debug, Clone)]
struct ExternalIdRow {
    id: String,
    provider: String,
    external_id: String,
}

fn move_external_ids(tx: &Transaction<'_>, plan: &DuplicateMergePlan, now: &str) -> DbResult<i64> {
    let mut moved = 0;
    for source_id in &plan.source_ids {
        let source_rows = list_external_id_rows(tx, source_id)?;
        for source_row in source_rows {
            moved += 1;
            let target_row = tx
                .query_row(
                    "SELECT id, provider, external_id, source, confidence FROM external_ids WHERE game_id = ?1 AND provider = ?2",
                    params![plan.target.id, source_row.provider],
                    external_id_row_from_row,
                )
                .optional()?;
            match target_row {
                None => {
                    tx.execute(
                        r#"
                        UPDATE external_ids
                        SET game_id = ?1, updated_at = ?3
                        WHERE id = ?2
                        "#,
                        params![plan.target.id, source_row.id, now],
                    )?;
                }
                Some(target_row)
                    if normalize_external_id(&target_row.external_id)
                        == normalize_external_id(&source_row.external_id) =>
                {
                    tx.execute(
                        "DELETE FROM external_ids WHERE id = ?1",
                        params![source_row.id],
                    )?;
                }
                Some(_) => {
                    tx.execute(
                        "DELETE FROM external_ids WHERE id = ?1",
                        params![source_row.id],
                    )?;
                }
            }
        }
    }
    Ok(moved)
}

fn list_external_id_rows(tx: &Transaction<'_>, game_id: &str) -> DbResult<Vec<ExternalIdRow>> {
    let mut stmt = tx.prepare(
        "SELECT id, provider, external_id FROM external_ids WHERE game_id = ?1 ORDER BY provider ASC",
    )?;
    let rows = stmt.query_map(params![game_id], external_id_row_from_row)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

fn external_id_row_from_row(row: &Row<'_>) -> rusqlite::Result<ExternalIdRow> {
    Ok(ExternalIdRow {
        id: row.get(0)?,
        provider: row.get(1)?,
        external_id: row.get(2)?,
    })
}

fn ensure_external_ids_for_game(tx: &Transaction<'_>, game: &Game, now: &str) -> DbResult<()> {
    for (provider, external_id) in known_game_external_ids(game) {
        tx.execute(
            r#"
            INSERT INTO external_ids (id, game_id, provider, external_id, source, confidence, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, 'merge', NULL, ?5, ?5)
            ON CONFLICT(game_id, provider) DO UPDATE SET
              external_id = excluded.external_id,
              source = COALESCE(external_ids.source, excluded.source),
              confidence = COALESCE(external_ids.confidence, excluded.confidence),
              updated_at = excluded.updated_at
            "#,
            params![Uuid::new_v4().to_string(), game.id, provider, external_id, now],
        )?;
    }
    Ok(())
}

fn update_target_game_for_merge(tx: &Transaction<'_>, game: &Game, now: &str) -> DbResult<()> {
    tx.execute(
        r#"
        UPDATE games SET
          title = ?2, original_title = ?3, aliases = ?4, developer = ?5, publisher = ?6, brand = ?7,
          release_date = ?8, description = ?9, notes = ?10, tags = ?11, genres = ?12, rating = ?13, age_rating = ?14,
          play_status = ?15, favorite = ?16, hidden = ?17, install_path = ?18, executable_path = ?19,
          working_directory = ?20, launch_args = ?21, path_status = ?22, last_path_checked_at = ?23,
          cover_image = ?24, banner_image = ?25, background_image = ?26, vndb_id = ?27, bangumi_id = ?28,
          dlsite_id = ?29, fanza_id = ?30, ymgal_id = ?31, total_play_seconds = ?32, last_played_at = ?33,
          updated_at = ?34
        WHERE id = ?1
        "#,
        params![
            game.id,
            game.title,
            game.original_title,
            json_list(&game.aliases)?,
            game.developer,
            game.publisher,
            game.brand,
            game.release_date,
            game.description,
            game.notes,
            json_list(&game.tags)?,
            json_list(&game.genres)?,
            game.rating,
            game.age_rating,
            game.play_status,
            bool_int(game.favorite),
            bool_int(game.hidden),
            game.install_path,
            game.executable_path,
            game.working_directory,
            game.launch_args,
            game.path_status,
            game.last_path_checked_at,
            game.cover_image,
            game.banner_image,
            game.background_image,
            game.vndb_id,
            game.bangumi_id,
            game.dlsite_id,
            game.fanza_id,
            game.ymgal_id,
            game.total_play_seconds,
            game.last_played_at,
            now,
        ],
    )?;
    Ok(())
}

fn ensure_json_tags_in_normalized_table(tx: &Transaction<'_>, game: &Game) -> DbResult<()> {
    for (kind, values) in [("tag", &game.tags), ("genre", &game.genres)] {
        for value in values {
            let tag = clean(value);
            if tag.is_empty() {
                continue;
            }
            let tag_id = upsert_tag(tx, &tag, kind)?;
            tx.execute(
                "INSERT OR IGNORE INTO game_tags (game_id, tag_id, created_at) VALUES (?1, ?2, ?3)",
                params![game.id, tag_id, now()],
            )?;
        }
    }
    Ok(())
}

fn upsert_tag(tx: &Transaction<'_>, name: &str, kind: &str) -> DbResult<String> {
    let now = now();
    tx.execute(
        r#"
        INSERT INTO tags (id, name, kind, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?4)
        ON CONFLICT(name, kind) DO UPDATE SET updated_at = excluded.updated_at
        "#,
        params![Uuid::new_v4().to_string(), name, kind, now],
    )?;
    tx.query_row(
        "SELECT id FROM tags WHERE name = ?1 AND kind = ?2",
        params![name, kind],
        |row| row.get(0),
    )
    .map_err(DbError::from)
}

fn normalize_primary_assets(tx: &Transaction<'_>, game: &Game, now: &str) -> DbResult<()> {
    for (asset_type, uri) in [
        ("cover", game.cover_image.as_deref()),
        ("banner", game.banner_image.as_deref()),
        ("background", game.background_image.as_deref()),
    ] {
        if let Some(uri) = uri.filter(|value| !value.trim().is_empty()) {
            tx.execute(
                r#"
                INSERT OR IGNORE INTO game_assets (id, game_id, asset_type, uri, source, is_primary, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, 'games', 1, ?5, ?5)
                "#,
                params![Uuid::new_v4().to_string(), game.id, asset_type, uri, now],
            )?;
            tx.execute(
                "UPDATE game_assets SET is_primary = 0, updated_at = ?3 WHERE game_id = ?1 AND asset_type = ?2",
                params![game.id, asset_type, now],
            )?;
            tx.execute(
                "UPDATE game_assets SET is_primary = 1, updated_at = ?4 WHERE game_id = ?1 AND asset_type = ?2 AND uri = ?3",
                params![game.id, asset_type, uri, now],
            )?;
        }
    }
    Ok(())
}

fn normalize_launch_profile_defaults(
    tx: &Transaction<'_>,
    target_game_id: &str,
    original_default_id: Option<String>,
    now: &str,
) -> DbResult<()> {
    if let Some(default_id) = original_default_id {
        tx.execute(
            "UPDATE launch_profiles SET is_default = CASE WHEN id = ?2 THEN 1 ELSE 0 END, updated_at = ?3 WHERE game_id = ?1",
            params![target_game_id, default_id, now],
        )?;
        return Ok(());
    }

    let next_default: Option<String> = tx
        .query_row(
            "SELECT id FROM launch_profiles WHERE game_id = ?1 ORDER BY is_default DESC, created_at ASC LIMIT 1",
            params![target_game_id],
            |row| row.get(0),
        )
        .optional()?;
    if let Some(default_id) = next_default {
        tx.execute(
            "UPDATE launch_profiles SET is_default = CASE WHEN id = ?2 THEN 1 ELSE 0 END, updated_at = ?3 WHERE game_id = ?1",
            params![target_game_id, default_id, now],
        )?;
    }
    Ok(())
}

fn collect_game_external_ids(
    conn: &Connection,
    game: &Game,
) -> DbResult<Vec<DuplicateGameMergeExternalId>> {
    let mut items = Vec::new();
    for (provider, external_id) in known_game_external_ids(game) {
        push_external_id(&mut items, &provider, &external_id);
    }
    let mut stmt = conn.prepare(
        "SELECT provider, external_id FROM external_ids WHERE game_id = ?1 ORDER BY provider ASC",
    )?;
    let rows = stmt.query_map(params![game.id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    for row in rows {
        let (provider, external_id) = row?;
        push_external_id(&mut items, &provider, &external_id);
    }
    items.sort_by(|left, right| {
        left.provider
            .cmp(&right.provider)
            .then_with(|| left.external_id.cmp(&right.external_id))
    });
    Ok(items)
}

fn known_game_external_ids(game: &Game) -> Vec<(String, String)> {
    [
        ("vndb", game.vndb_id.as_deref()),
        ("bangumi", game.bangumi_id.as_deref()),
        ("dlsite", game.dlsite_id.as_deref()),
        ("fanza", game.fanza_id.as_deref()),
        ("ymgal", game.ymgal_id.as_deref()),
    ]
    .into_iter()
    .filter_map(|(provider, value)| {
        value
            .map(clean)
            .filter(|item| !item.is_empty())
            .map(|item| (provider.to_string(), item))
    })
    .collect()
}

fn push_external_id(
    items: &mut Vec<DuplicateGameMergeExternalId>,
    provider: &str,
    external_id: &str,
) {
    let provider = clean(provider).to_lowercase();
    let external_id = clean(external_id);
    if provider.is_empty() || external_id.is_empty() {
        return;
    }
    let key = (provider.as_str(), normalize_external_id(&external_id));
    if items
        .iter()
        .any(|item| item.provider == key.0 && normalize_external_id(&item.external_id) == key.1)
    {
        return;
    }
    items.push(DuplicateGameMergeExternalId {
        provider,
        external_id,
    });
}

fn external_id_keys(items: &[DuplicateGameMergeExternalId]) -> BTreeSet<(String, String)> {
    items.iter().map(external_id_key).collect()
}

fn external_id_key(item: &DuplicateGameMergeExternalId) -> (String, String) {
    (
        item.provider.trim().to_lowercase(),
        normalize_external_id(&item.external_id),
    )
}

fn append_external_id_conflict_warnings(
    warnings: &mut Vec<String>,
    target: &Game,
    target_external_ids: &[DuplicateGameMergeExternalId],
    source: &Game,
    source_external_ids: &[DuplicateGameMergeExternalId],
) {
    let target_by_provider = first_external_id_by_provider(target_external_ids);
    for source_external_id in source_external_ids {
        let Some(target_external_id) = target_by_provider.get(&source_external_id.provider) else {
            continue;
        };
        if normalize_external_id(target_external_id)
            != normalize_external_id(&source_external_id.external_id)
        {
            push_warning(
                warnings,
                format!(
                    "{} 的 {} ID {} 与目标 {} 的 {} 冲突，合并时保留目标值 {}。",
                    source.title,
                    source_external_id.provider,
                    source_external_id.external_id,
                    target.title,
                    source_external_id.provider,
                    target_external_id
                ),
            );
        }
    }
}

fn first_external_id_by_provider(
    items: &[DuplicateGameMergeExternalId],
) -> BTreeMap<String, String> {
    let mut map = BTreeMap::new();
    for item in items {
        map.entry(item.provider.clone())
            .or_insert_with(|| item.external_id.clone());
    }
    map
}

fn append_scalar_conflict_warnings(warnings: &mut Vec<String>, target: &Game, source: &Game) {
    for (field, target_value, source_value) in [
        (
            "简介",
            target.description.as_deref(),
            source.description.as_deref(),
        ),
        ("备注", target.notes.as_deref(), source.notes.as_deref()),
        (
            "开发商",
            target.developer.as_deref(),
            source.developer.as_deref(),
        ),
        ("品牌", target.brand.as_deref(), source.brand.as_deref()),
        (
            "发售日",
            target.release_date.as_deref(),
            source.release_date.as_deref(),
        ),
    ] {
        let target_value = target_value.map(clean).unwrap_or_default();
        let source_value = source_value.map(clean).unwrap_or_default();
        if !target_value.is_empty()
            && !source_value.is_empty()
            && target_value.to_lowercase() != source_value.to_lowercase()
        {
            push_warning(
                warnings,
                format!("{} 的{}与目标不同，目标已有值会保留。", source.title, field),
            );
        }
    }
}

fn push_warning(warnings: &mut Vec<String>, warning: String) {
    if !warnings.contains(&warning) {
        warnings.push(warning);
    }
}

fn merge_game_fields(target: &mut Game, source: &Game) {
    append_unique(&mut target.aliases, &source.title);
    if let Some(original_title) = source.original_title.as_deref() {
        append_unique(&mut target.aliases, original_title);
    }
    for alias in &source.aliases {
        append_unique(&mut target.aliases, alias);
    }
    for tag in &source.tags {
        append_unique(&mut target.tags, tag);
    }
    for genre in &source.genres {
        append_unique(&mut target.genres, genre);
    }

    fill_optional(&mut target.original_title, &source.original_title);
    fill_optional(&mut target.developer, &source.developer);
    fill_optional(&mut target.publisher, &source.publisher);
    fill_optional(&mut target.brand, &source.brand);
    fill_optional(&mut target.release_date, &source.release_date);
    fill_optional(&mut target.description, &source.description);
    fill_optional(&mut target.notes, &source.notes);
    if target.rating.is_none() {
        target.rating = source.rating;
    }
    fill_optional(&mut target.age_rating, &source.age_rating);
    target.favorite = target.favorite || source.favorite;
    fill_optional(&mut target.executable_path, &source.executable_path);
    fill_optional(&mut target.working_directory, &source.working_directory);
    fill_optional(&mut target.launch_args, &source.launch_args);
    fill_optional(&mut target.cover_image, &source.cover_image);
    fill_optional(&mut target.banner_image, &source.banner_image);
    fill_optional(&mut target.background_image, &source.background_image);
    fill_optional(&mut target.vndb_id, &source.vndb_id);
    fill_optional(&mut target.bangumi_id, &source.bangumi_id);
    fill_optional(&mut target.dlsite_id, &source.dlsite_id);
    fill_optional(&mut target.fanza_id, &source.fanza_id);
    fill_optional(&mut target.ymgal_id, &source.ymgal_id);
    target.total_play_seconds = target
        .total_play_seconds
        .saturating_add(source.total_play_seconds);
    target.last_played_at =
        max_timestamp(target.last_played_at.clone(), source.last_played_at.clone());
}

fn apply_target_external_id_precedence(
    game: &mut Game,
    target_external_ids: &[DuplicateGameMergeExternalId],
) {
    let by_provider = first_external_id_by_provider(target_external_ids);
    if let Some(value) = by_provider.get("vndb") {
        game.vndb_id = Some(value.clone());
    }
    if let Some(value) = by_provider.get("bangumi") {
        game.bangumi_id = Some(value.clone());
    }
    if let Some(value) = by_provider.get("dlsite") {
        game.dlsite_id = Some(value.clone());
    }
    if let Some(value) = by_provider.get("fanza") {
        game.fanza_id = Some(value.clone());
    }
    if let Some(value) = by_provider.get("ymgal") {
        game.ymgal_id = Some(value.clone());
    }
}

fn fill_optional(target: &mut Option<String>, source: &Option<String>) {
    if target.as_deref().map(clean).unwrap_or_default().is_empty() {
        *target = source
            .as_deref()
            .map(clean)
            .filter(|value| !value.is_empty());
    }
}

fn append_unique(values: &mut Vec<String>, value: &str) {
    let value = clean(value);
    if value.is_empty() {
        return;
    }
    if !values
        .iter()
        .any(|item| item.trim().eq_ignore_ascii_case(&value))
    {
        values.push(value);
    }
}

fn max_timestamp(left: Option<String>, right: Option<String>) -> Option<String> {
    match (left, right) {
        (Some(left), Some(right)) => Some(if right > left { right } else { left }),
        (Some(left), None) => Some(left),
        (None, Some(right)) => Some(right),
        (None, None) => None,
    }
}

fn json_list(values: &[String]) -> DbResult<String> {
    let mut cleaned = Vec::new();
    for value in values {
        append_unique(&mut cleaned, value);
    }
    Ok(serde_json::to_string(&cleaned)?)
}

fn trimmed_required(value: String, field: &str) -> DbResult<String> {
    let trimmed = value.trim().to_string();
    if trimmed.is_empty() {
        Err(DbError::validation(format!("{field} is required")))
    } else {
        Ok(trimmed)
    }
}

fn clean(value: &str) -> String {
    value.trim().to_string()
}

fn normalize_external_id(value: &str) -> String {
    value.trim().to_lowercase()
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::models::{
        AddGameInput, AssetInput, CollectionInput, CreateLaunchProfileInput, SaveBackup,
    };

    fn memory_db() -> Database {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        let db = Database { conn };
        db.migrate().unwrap();
        db
    }

    #[test]
    fn duplicate_game_merge_moves_related_rows_and_keeps_target_identity() {
        let db = memory_db();
        let target = db
            .add_game(AddGameInput {
                title: "Target VN".to_string(),
                install_path: "D:\\Games\\Target VN".to_string(),
                vndb_id: Some("v123".to_string()),
                tags: Some(vec!["target-tag".to_string()]),
                genres: Some(vec!["Visual Novel".to_string()]),
                cover_image: Some("target-cover.webp".to_string()),
                ..empty_game_input()
            })
            .unwrap();
        let source = db
            .add_game(AddGameInput {
                title: "Source VN".to_string(),
                original_title: Some("Source Original".to_string()),
                install_path: "D:\\Games\\Source VN".to_string(),
                vndb_id: Some("V123".to_string()),
                dlsite_id: Some("RJ01000000".to_string()),
                tags: Some(vec!["source-tag".to_string()]),
                genres: Some(vec!["Adventure".to_string()]),
                background_image: Some("source-bg.webp".to_string()),
                ..empty_game_input()
            })
            .unwrap();
        db.conn
            .execute(
                "UPDATE games SET total_play_seconds = 120, last_played_at = '2026-01-02T00:00:00+00:00' WHERE id = ?1",
                params![source.id],
            )
            .unwrap();

        let collection = db
            .create_collection(CollectionInput {
                name: "Duplicates".to_string(),
                description: None,
                color: None,
            })
            .unwrap();
        db.add_game_to_collection(collection.id.clone(), source.id.clone())
            .unwrap();
        db.upsert_game_asset(
            source.id.clone(),
            AssetInput {
                asset_type: "background".to_string(),
                uri: "source-bg.webp".to_string(),
                source: Some("manual".to_string()),
                is_primary: Some(true),
            },
        )
        .unwrap();
        let save_path = db
            .add_save_path(
                source.id.clone(),
                "Main".to_string(),
                "D:\\Games\\Source VN\\save".to_string(),
            )
            .unwrap();
        db.insert_save_backup(&SaveBackup {
            id: "backup-1".to_string(),
            game_id: source.id.clone(),
            save_path_id: save_path.id.clone(),
            label: "Backup".to_string(),
            source_path: save_path.path.clone(),
            backup_path: "E:\\MikaVN Library\\app-data\\save-backups\\backup-1".to_string(),
            protection: false,
            created_at: "2026-01-01T00:00:00+00:00".to_string(),
        })
        .unwrap();
        db.create_launch_profile(CreateLaunchProfileInput {
            game_id: target.id.clone(),
            name: "Target default".to_string(),
            executable_path: "D:\\Games\\Target VN\\game.exe".to_string(),
            working_directory: None,
            arguments: None,
            environment_variables: None,
            runner_type: None,
            locale_emulator_path: None,
            pre_launch_command: None,
            post_launch_command: None,
            run_as_admin: None,
            is_default: Some(true),
            compatibility_notes: None,
        })
        .unwrap();
        db.create_launch_profile(CreateLaunchProfileInput {
            game_id: source.id.clone(),
            name: "Source default".to_string(),
            executable_path: "D:\\Games\\Source VN\\game.exe".to_string(),
            working_directory: None,
            arguments: None,
            environment_variables: None,
            runner_type: None,
            locale_emulator_path: None,
            pre_launch_command: None,
            post_launch_command: None,
            run_as_admin: None,
            is_default: Some(true),
            compatibility_notes: None,
        })
        .unwrap();
        db.conn.execute(
            "INSERT INTO play_sessions (id, game_id, started_at, ended_at, duration_seconds, exit_status) VALUES ('session-1', ?1, '2026-01-01T00:00:00+00:00', '2026-01-01T00:02:00+00:00', 120, 'ok')",
            params![source.id],
        ).unwrap();
        db.set_field_lock(source.id.clone(), "description".to_string(), true)
            .unwrap();
        db.conn.execute(
            "INSERT INTO metadata_match_jobs (id, status, total, completed, created_at, updated_at) VALUES ('job-1', 'completed', 1, 1, 'now', 'now')",
            [],
        ).unwrap();
        db.conn.execute(
            "INSERT INTO metadata_match_results (id, job_id, game_id, original_title, status, candidates, created_at) VALUES ('result-1', 'job-1', ?1, 'Source VN', 'success', '[]', 'now')",
            params![source.id],
        ).unwrap();

        let preview = db
            .preview_duplicate_game_merge(DuplicateGameMergeOptions {
                target_game_id: target.id.clone(),
                source_game_ids: vec![source.id.clone()],
            })
            .unwrap();
        assert_eq!(preview.shared_external_ids[0].provider, "vndb");
        assert_eq!(preview.moved_counts.source_games, 1);
        assert_eq!(preview.moved_counts.play_sessions, 1);

        let result = db
            .merge_duplicate_games(DuplicateGameMergeOptions {
                target_game_id: target.id.clone(),
                source_game_ids: vec![source.id.clone()],
            })
            .unwrap();
        assert_eq!(result.merged_game.id, target.id);
        assert_eq!(result.deleted_source_game_ids, vec![source.id.clone()]);
        assert!(db.get_game(source.id.clone()).is_err());

        let merged = db.get_game(target.id.clone()).unwrap();
        assert_eq!(merged.dlsite_id.as_deref(), Some("RJ01000000"));
        assert_eq!(merged.background_image.as_deref(), Some("source-bg.webp"));
        assert!(merged.aliases.contains(&"Source VN".to_string()));
        assert!(merged.aliases.contains(&"Source Original".to_string()));
        assert!(merged.tags.contains(&"source-tag".to_string()));
        assert!(merged.genres.contains(&"Adventure".to_string()));
        assert_eq!(merged.total_play_seconds, 120);

        assert_eq!(db.list_collection_games(collection.id).unwrap().len(), 1);
        assert_eq!(db.list_save_paths(target.id.clone()).unwrap().len(), 1);
        assert_eq!(db.list_save_backups(target.id.clone()).unwrap().len(), 1);
        assert_eq!(
            db.list_play_sessions(target.id.clone(), 20).unwrap().len(),
            1
        );
        assert_eq!(db.list_launch_profiles(target.id.clone()).unwrap().len(), 2);
        assert_eq!(
            db.list_launch_profiles(target.id.clone())
                .unwrap()
                .iter()
                .filter(|profile| profile.is_default)
                .count(),
            1
        );
        assert_eq!(db.list_field_locks(target.id.clone()).unwrap().len(), 1);
        assert_eq!(db.list_external_ids(target.id.clone()).unwrap().len(), 2);
        let match_rows: i64 = db
            .conn
            .query_row(
                "SELECT COUNT(*) FROM metadata_match_results WHERE game_id = ?1",
                params![target.id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(match_rows, 1);
    }

    #[test]
    fn duplicate_game_merge_requires_shared_external_id() {
        let db = memory_db();
        let target = db
            .add_game(AddGameInput {
                title: "Target VN".to_string(),
                install_path: "D:\\Games\\Target VN".to_string(),
                vndb_id: Some("v1".to_string()),
                ..empty_game_input()
            })
            .unwrap();
        let source = db
            .add_game(AddGameInput {
                title: "Source VN".to_string(),
                install_path: "D:\\Games\\Source VN".to_string(),
                vndb_id: Some("v2".to_string()),
                ..empty_game_input()
            })
            .unwrap();

        let error = db
            .preview_duplicate_game_merge(DuplicateGameMergeOptions {
                target_game_id: target.id,
                source_game_ids: vec![source.id],
            })
            .unwrap_err();
        assert_eq!(error.code, "VALIDATION_ERROR");
    }

    fn empty_game_input() -> AddGameInput {
        AddGameInput {
            title: String::new(),
            original_title: None,
            aliases: None,
            developer: None,
            publisher: None,
            brand: None,
            release_date: None,
            description: None,
            notes: None,
            tags: None,
            genres: None,
            rating: None,
            age_rating: None,
            play_status: None,
            favorite: None,
            hidden: None,
            install_path: String::new(),
            executable_path: None,
            working_directory: None,
            launch_args: None,
            cover_image: None,
            banner_image: None,
            background_image: None,
            vndb_id: None,
            bangumi_id: None,
            dlsite_id: None,
            fanza_id: None,
            ymgal_id: None,
        }
    }
}
