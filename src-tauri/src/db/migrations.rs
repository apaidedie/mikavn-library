use super::{schema, Database, DbError, DbResult};
use crate::db::models::GameFilter;
use crate::repositories::asset_tags::AssetTagRepository;
use crate::repositories::games::GameRepository;
use crate::repositories::metadata_ids::MetadataIdRepository;
use crate::repositories::metadata_sources::MetadataSourceRepository;

const CURRENT_SCHEMA_VERSION: i64 = 13;

struct Migration {
    version: i64,
    name: &'static str,
    apply: fn(&Database) -> DbResult<()>,
}

const VERSIONED_MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        name: "create save paths and backups",
        apply: migration_001_create_save_tables,
    },
    Migration {
        version: 2,
        name: "create tasks",
        apply: migration_002_create_tasks,
    },
    Migration {
        version: 3,
        name: "create scan task results",
        apply: migration_003_create_scan_task_results,
    },
    Migration {
        version: 4,
        name: "create launch profiles",
        apply: migration_004_create_launch_profiles,
    },
    Migration {
        version: 5,
        name: "reserved compatibility version",
        apply: migration_005_noop,
    },
    Migration {
        version: 6,
        name: "create field locks",
        apply: migration_006_create_field_locks,
    },
    Migration {
        version: 7,
        name: "add task retry columns and logs",
        apply: migration_007_task_retry_and_logs,
    },
    Migration {
        version: 8,
        name: "create metadata sources and external ids",
        apply: migration_008_metadata_sources_and_external_ids,
    },
    Migration {
        version: 9,
        name: "create collections",
        apply: migration_009_create_collections,
    },
    Migration {
        version: 10,
        name: "create asset, tag, and saved search tables",
        apply: migration_010_assets_tags_and_saved_searches,
    },
    Migration {
        version: 11,
        name: "reserved compatibility version",
        apply: migration_011_noop,
    },
    Migration {
        version: 12,
        name: "add metadata match task link",
        apply: migration_012_metadata_match_task_link,
    },
    Migration {
        version: 13,
        name: "ensure saved searches",
        apply: migration_013_saved_searches,
    },
];

pub(super) fn apply_versioned_migrations(db: &Database) -> DbResult<()> {
    let current_version = current_user_version(db)?;
    if current_version >= CURRENT_SCHEMA_VERSION {
        return Ok(());
    }

    for migration in VERSIONED_MIGRATIONS {
        if current_version < migration.version {
            let result =
                (migration.apply)(db).and_then(|_| set_user_version(db, migration.version));
            if let Err(error) = result {
                return Err(migration_error(migration, error));
            }
        }
    }
    Ok(())
}

fn current_user_version(db: &Database) -> DbResult<i64> {
    Ok(db
        .conn
        .query_row("PRAGMA user_version", [], |row| row.get(0))?)
}

fn set_user_version(db: &Database, version: i64) -> DbResult<()> {
    db.conn
        .execute_batch(&format!("PRAGMA user_version = {version};"))?;
    Ok(())
}

fn migration_001_create_save_tables(db: &Database) -> DbResult<()> {
    db.conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS save_paths (
          id TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
          label TEXT NOT NULL,
          path TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS save_backups (
          id TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
          save_path_id TEXT NOT NULL,
          label TEXT NOT NULL,
          source_path TEXT NOT NULL,
          backup_path TEXT NOT NULL,
          protection INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE,
          FOREIGN KEY(save_path_id) REFERENCES save_paths(id) ON DELETE CASCADE
        );
        "#,
    )?;
    Ok(())
}

fn migration_002_create_tasks(db: &Database) -> DbResult<()> {
    db.conn.execute_batch(
        r#"
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
        "#,
    )?;
    Ok(())
}

fn migration_003_create_scan_task_results(db: &Database) -> DbResult<()> {
    db.conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS scan_task_results (
          task_id TEXT PRIMARY KEY,
          path TEXT NOT NULL,
          recursive INTEGER NOT NULL,
          candidates TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );
        "#,
    )?;
    Ok(())
}

fn migration_004_create_launch_profiles(db: &Database) -> DbResult<()> {
    db.conn.execute_batch(
        r#"
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
        "#,
    )?;
    Ok(())
}

fn migration_005_noop(_db: &Database) -> DbResult<()> {
    Ok(())
}

fn migration_006_create_field_locks(db: &Database) -> DbResult<()> {
    db.conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS field_locks (
          id TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
          field_name TEXT NOT NULL,
          locked_by_user INTEGER NOT NULL DEFAULT 1,
          updated_at TEXT NOT NULL,
          UNIQUE(game_id, field_name),
          FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
        );
        "#,
    )?;
    Ok(())
}

fn migration_007_task_retry_and_logs(db: &Database) -> DbResult<()> {
    schema::ensure_task_columns(db)?;
    db.conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS task_logs (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          level TEXT NOT NULL,
          message TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );
        "#,
    )?;
    Ok(())
}

fn migration_008_metadata_sources_and_external_ids(db: &Database) -> DbResult<()> {
    db.conn.execute_batch(
        r#"
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
        "#,
    )?;
    seed_metadata_sources(db)?;
    backfill_external_ids(db)?;
    Ok(())
}

fn migration_009_create_collections(db: &Database) -> DbResult<()> {
    db.conn.execute_batch(
        r#"
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
        "#,
    )?;
    Ok(())
}

fn migration_010_assets_tags_and_saved_searches(db: &Database) -> DbResult<()> {
    db.conn.execute_batch(
        r#"
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

        CREATE TABLE IF NOT EXISTS saved_searches (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          query TEXT NOT NULL,
          description TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        "#,
    )?;
    backfill_assets_and_tags(db)?;
    Ok(())
}

fn migration_011_noop(_db: &Database) -> DbResult<()> {
    Ok(())
}

fn migration_012_metadata_match_task_link(db: &Database) -> DbResult<()> {
    schema::ensure_match_job_columns(db)
}

fn migration_013_saved_searches(db: &Database) -> DbResult<()> {
    db.conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS saved_searches (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          query TEXT NOT NULL,
          description TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        "#,
    )?;
    Ok(())
}

fn migration_error(migration: &Migration, error: DbError) -> DbError {
    DbError::new(
        "DB_MIGRATION_FAILED",
        format!(
            "database migration v{} ({}) failed: {}",
            migration.version, migration.name, error
        ),
    )
}

fn seed_metadata_sources(db: &Database) -> DbResult<()> {
    MetadataSourceRepository::new(&db.conn).seed_metadata_sources()
}

fn backfill_external_ids(db: &Database) -> DbResult<()> {
    let games = GameRepository::new(&db.conn).list(GameFilter::default(), None)?;
    let metadata_ids = MetadataIdRepository::new(&db.conn);
    for game in games {
        metadata_ids.sync_game_external_ids(&game, Some("games"))?;
    }
    Ok(())
}

fn backfill_assets_and_tags(db: &Database) -> DbResult<()> {
    let games = GameRepository::new(&db.conn).list(GameFilter::default(), None)?;
    let asset_tags = AssetTagRepository::new(&db.conn);
    for game in games {
        asset_tags.sync_game_assets(&game, Some("migration"))?;
        asset_tags.sync_game_tags(&game)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migration_registry_is_strictly_ordered() {
        assert_eq!(
            VERSIONED_MIGRATIONS.last().map(|item| item.version),
            Some(CURRENT_SCHEMA_VERSION)
        );

        let mut expected = 1;
        for migration in VERSIONED_MIGRATIONS {
            assert_eq!(migration.version, expected);
            assert!(!migration.name.trim().is_empty());
            expected += 1;
        }
    }
}
