mod assets_ext;
mod collections_ext;
mod dashboard_ext;
mod game_merge_ext;
mod games_ext;
mod launch_ext;
mod library_roots_ext;
mod metadata_ext;
mod migrations;
pub mod models;
mod saves_ext;
mod scanner_ext;
mod schema;
mod search_ext;
mod settings_ext;
mod tag_maintenance_ext;
mod tasks_ext;

#[cfg(test)]
use models::{
    AddGameInput, AssetInput, CollectionInput, CreateLaunchProfileInput, GameFilter,
    UpdateGameInput,
};
use rusqlite::Connection;
use std::fs;
use tauri::AppHandle;

pub use crate::error::AppError as DbError;
use crate::infrastructure::paths::AppPaths;
use crate::repositories::asset_tags::AssetTagRepository;
use crate::repositories::collections::CollectionRepository;
use crate::repositories::games::GameRepository;
use crate::repositories::launch::LaunchRepository;
use crate::repositories::library_roots::LibraryRootRepository;
use crate::repositories::metadata_cache::MetadataCacheRepository;
use crate::repositories::metadata_ids::MetadataIdRepository;
use crate::repositories::metadata_matches::MetadataMatchRepository;
use crate::repositories::metadata_sources::MetadataSourceRepository;
use crate::repositories::saved_searches::SavedSearchRepository;
use crate::repositories::saves::SaveRepository;
use crate::repositories::scanner_results::ScannerResultRepository;
use crate::repositories::settings::SettingRepository;
use crate::repositories::tasks::TaskRepository;
pub type DbResult<T> = crate::error::AppResult<T>;

pub struct Database {
    pub(super) conn: Connection,
}

impl Database {
    fn task_repository(&self) -> TaskRepository<'_> {
        TaskRepository::new(&self.conn)
    }

    fn game_repository(&self) -> GameRepository<'_> {
        GameRepository::new(&self.conn)
    }

    fn asset_tag_repository(&self) -> AssetTagRepository<'_> {
        AssetTagRepository::new(&self.conn)
    }

    fn collection_repository(&self) -> CollectionRepository<'_> {
        CollectionRepository::new(&self.conn)
    }

    fn library_root_repository(&self) -> LibraryRootRepository<'_> {
        LibraryRootRepository::new(&self.conn)
    }

    fn launch_repository(&self) -> LaunchRepository<'_> {
        LaunchRepository::new(&self.conn)
    }

    fn metadata_id_repository(&self) -> MetadataIdRepository<'_> {
        MetadataIdRepository::new(&self.conn)
    }

    fn metadata_cache_repository(&self) -> MetadataCacheRepository<'_> {
        MetadataCacheRepository::new(&self.conn)
    }

    fn metadata_match_repository(&self) -> MetadataMatchRepository<'_> {
        MetadataMatchRepository::new(&self.conn)
    }

    fn metadata_source_repository(&self) -> MetadataSourceRepository<'_> {
        MetadataSourceRepository::new(&self.conn)
    }

    fn saved_search_repository(&self) -> SavedSearchRepository<'_> {
        SavedSearchRepository::new(&self.conn)
    }

    fn save_repository(&self) -> SaveRepository<'_> {
        SaveRepository::new(&self.conn)
    }

    fn scanner_result_repository(&self) -> ScannerResultRepository<'_> {
        ScannerResultRepository::new(&self.conn)
    }

    fn setting_repository(&self) -> SettingRepository<'_> {
        SettingRepository::new(&self.conn)
    }

    pub fn new(app: &AppHandle) -> DbResult<Self> {
        let paths = AppPaths::from_app(app)?;
        let conn = Connection::open(paths.database())?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        let db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    pub fn new_from_path(path: impl Into<std::path::PathBuf>) -> DbResult<Self> {
        let conn = Connection::open(path.into())?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        let db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    pub fn backup_to_path(&self, path: &std::path::Path) -> DbResult<()> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let sql = format!("VACUUM INTO {}", quote_sql_string(&path.to_string_lossy()));
        self.conn.execute_batch(&sql)?;
        Ok(())
    }

    fn migrate(&self) -> DbResult<()> {
        schema::migrate(self)
    }

    #[cfg(test)]
    fn table_columns(&self, table: &str) -> DbResult<Vec<String>> {
        schema::table_columns(self, table)
    }
}

fn quote_sql_string(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;

    #[test]
    fn migration_sets_user_version() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        let db = Database { conn };
        db.migrate().unwrap();
        let version: i64 = db
            .conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 13);
    }

    #[test]
    fn migration_creates_tasks_table() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        let db = Database { conn };
        db.migrate().unwrap();

        let task = db
            .create_task("scan", Some("Scanning".to_string()))
            .unwrap();
        assert_eq!(task.status, "pending");
        assert!(!task.retryable);
        assert_eq!(db.list_tasks(20).unwrap().len(), 1);
        assert_eq!(db.list_task_logs(&task.id).unwrap().len(), 1);
    }

    #[test]
    fn task_logs_and_retry_payloads_are_persisted() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        let db = Database { conn };
        db.migrate().unwrap();

        let task = db
            .create_task_with_payload(
                "library.scan",
                Some("Scanning".to_string()),
                Some(r#"{"path":"D:\Games","recursive":true}"#.to_string()),
                true,
            )
            .unwrap();
        let updated = db
            .update_task(
                &task.id,
                "failed",
                1.0,
                Some("Scan failed".to_string()),
                Some("path missing".to_string()),
            )
            .unwrap();

        assert!(updated.retryable);
        assert!(updated.retry_payload.unwrap().contains("D:\\Games"));
        let logs = db.list_task_logs(&task.id).unwrap();
        assert_eq!(logs.len(), 3);
        assert_eq!(logs.last().unwrap().level, "error");
    }

    #[test]
    fn task_messages_and_logs_are_redacted() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        let db = Database { conn };
        db.migrate().unwrap();

        let task = db
            .create_task(
                "privacy.test",
                Some(r"API_KEY=secret C:\Users\alice\AppData".to_string()),
            )
            .unwrap();
        let updated = db
            .update_task(
                &task.id,
                "failed",
                1.0,
                Some("token:abc".to_string()),
                Some(r"password=hunter2 C:\Users\alice\Desktop".to_string()),
            )
            .unwrap();
        let logs = db.list_task_logs(&task.id).unwrap();

        assert!(!updated.error.unwrap().contains("hunter2"));
        assert!(!logs.iter().any(|log| log.message.contains("secret")
            || log.message.contains("alice")
            || log.message.contains("abc")));
        assert!(logs.iter().any(|log| log.message.contains("[redacted]")));
    }

    #[test]
    fn migration_adds_task_retry_columns_to_existing_database() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            PRAGMA foreign_keys = ON;
            CREATE TABLE tasks (
              id TEXT PRIMARY KEY,
              type TEXT NOT NULL,
              status TEXT NOT NULL,
              progress REAL NOT NULL DEFAULT 0,
              message TEXT,
              error TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
            PRAGMA user_version = 6;
            "#,
        )
        .unwrap();
        let db = Database { conn };
        db.migrate().unwrap();

        let version: i64 = db
            .conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 13);
        let columns = db.table_columns("tasks").unwrap();
        assert!(columns.contains(&"retry_payload".to_string()));
        assert!(columns.contains(&"retryable".to_string()));
        db.append_task_log("missing-task", "info", "ignored by foreign key")
            .unwrap_err();
    }

    #[test]
    fn migration_creates_and_backfills_external_ids() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        let db = Database { conn };
        db.migrate().unwrap();

        let game = db
            .add_game(AddGameInput {
                title: "Metadata VN".to_string(),
                install_path: "D:\\Games\\Metadata VN".to_string(),
                vndb_id: Some("v123".to_string()),
                dlsite_id: Some("RJ01000000".to_string()),
                ..empty_game_input()
            })
            .unwrap();

        let sources = db.list_metadata_sources().unwrap();
        assert!(sources.iter().any(|source| source.provider == "vndb"));
        let ids = db.list_external_ids(game.id).unwrap();
        assert_eq!(ids.len(), 2);
        assert!(ids
            .iter()
            .any(|id| id.provider == "vndb" && id.external_id == "v123"));
        assert!(ids
            .iter()
            .any(|id| id.provider == "dlsite" && id.external_id == "RJ01000000"));
    }

    #[test]
    fn update_game_syncs_external_ids() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        let db = Database { conn };
        db.migrate().unwrap();

        let game = db
            .add_game(AddGameInput {
                title: "External ID VN".to_string(),
                install_path: "D:\\Games\\External ID VN".to_string(),
                ..empty_game_input()
            })
            .unwrap();
        db.update_game(
            game.id.clone(),
            UpdateGameInput {
                fanza_id: Some("abc_1234".to_string()),
                ..Default::default()
            },
        )
        .unwrap();

        let ids = db.list_external_ids(game.id).unwrap();
        assert_eq!(ids.len(), 1);
        assert_eq!(ids[0].provider, "fanza");
        assert_eq!(ids[0].external_id, "abc_1234");
    }

    #[test]
    fn migration_creates_collections_tables() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        let db = Database { conn };
        db.migrate().unwrap();

        let game = db
            .add_game(AddGameInput {
                title: "Collection VN".to_string(),
                install_path: "D:\\Games\\Collection VN".to_string(),
                tags: Some(vec!["泣きゲー".to_string()]),
                developer: Some("Key".to_string()),
                favorite: Some(true),
                ..empty_game_input()
            })
            .unwrap();
        let collection = db
            .create_collection(CollectionInput {
                name: "短篇".to_string(),
                description: None,
                color: Some("rose".to_string()),
            })
            .unwrap();
        db.add_game_to_collection(collection.id.clone(), game.id.clone())
            .unwrap();

        let collections = db.list_collections().unwrap();
        assert_eq!(collections[0].game_count, 1);
        let games = db.list_collection_games(collection.id.clone()).unwrap();
        assert_eq!(games[0].id, game.id);
        let filtered = db
            .list_games(GameFilter {
                collection_id: Some(collection.id),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(filtered.len(), 1);
    }

    #[test]
    fn library_roots_can_be_updated_and_removed() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        let db = Database { conn };
        db.migrate().unwrap();

        let root = db
            .add_library_root("D:\\Games\\VisualNovel".to_string())
            .unwrap();
        assert!(root.recursive);
        assert!(root.enabled);

        let updated = db
            .update_library_root(root.id.clone(), Some(false), Some(false))
            .unwrap();
        assert!(!updated.recursive);
        assert!(!updated.enabled);
        assert_eq!(db.list_library_roots().unwrap().len(), 1);

        db.remove_library_root(root.id.clone()).unwrap();
        assert!(db.list_library_roots().unwrap().is_empty());
        let error = db.remove_library_root(root.id).unwrap_err();
        assert_eq!(error.code, "PATH_NOT_FOUND");
    }

    #[test]
    fn advanced_game_filters_work() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        let db = Database { conn };
        db.migrate().unwrap();

        let filtered = db
            .add_game(AddGameInput {
                title: "Filtered VN".to_string(),
                install_path: "D:\\Games\\Filtered VN".to_string(),
                tags: Some(vec!["纯爱".to_string()]),
                developer: Some("Palette".to_string()),
                favorite: Some(true),
                cover_image: Some("cover.jpg".to_string()),
                banner_image: Some("banner.jpg".to_string()),
                background_image: Some("background.jpg".to_string()),
                vndb_id: Some("v1".to_string()),
                description: Some("desc".to_string()),
                release_date: Some("2024-01-01".to_string()),
                ..empty_game_input()
            })
            .unwrap();
        let needs_metadata = db
            .add_game(AddGameInput {
                title: "Needs Metadata".to_string(),
                install_path: "D:\\Games\\Needs Metadata".to_string(),
                hidden: Some(true),
                ..empty_game_input()
            })
            .unwrap();
        let missing_artwork = db
            .add_game(AddGameInput {
                title: "Missing Artwork".to_string(),
                install_path: "D:\\Games\\Missing Artwork".to_string(),
                cover_image: Some("cover.jpg".to_string()),
                description: Some("Story".to_string()),
                release_date: Some("2025-01-01".to_string()),
                developer: Some("Art Dev".to_string()),
                dlsite_id: Some("RJ123456".to_string()),
                ..empty_game_input()
            })
            .unwrap();
        let provider_without_images = db
            .add_game(AddGameInput {
                title: "Provider Without Images".to_string(),
                install_path: "D:\\Games\\Provider Without Images".to_string(),
                description: Some("Provider story without image tokens".to_string()),
                dlsite_id: Some("RJ654321".to_string()),
                ..empty_game_input()
            })
            .unwrap();
        db.set_game_path_health(&filtered.id, "ok", "2026-01-01T00:00:00Z")
            .unwrap();
        db.set_game_path_health(&needs_metadata.id, "broken", "2026-01-01T00:00:00Z")
            .unwrap();

        assert_eq!(
            db.list_games(GameFilter {
                tag: Some("纯爱".to_string()),
                ..Default::default()
            })
            .unwrap()
            .len(),
            1
        );
        assert_eq!(
            db.list_games(GameFilter {
                metadata_status: Some("missing_banner".to_string()),
                sort_by: Some("title".to_string()),
                sort_direction: Some("asc".to_string()),
                ..Default::default()
            })
            .unwrap()
            .iter()
            .map(|game| game.id.as_str())
            .collect::<Vec<_>>(),
            vec![
                missing_artwork.id.as_str(),
                needs_metadata.id.as_str(),
                provider_without_images.id.as_str(),
            ]
        );
        assert_eq!(
            db.list_games(GameFilter {
                metadata_status: Some("missing_background".to_string()),
                sort_by: Some("title".to_string()),
                sort_direction: Some("asc".to_string()),
                ..Default::default()
            })
            .unwrap()
            .iter()
            .map(|game| game.id.as_str())
            .collect::<Vec<_>>(),
            vec![
                missing_artwork.id.as_str(),
                needs_metadata.id.as_str(),
                provider_without_images.id.as_str(),
            ]
        );
        assert_eq!(
            db.list_games(GameFilter {
                metadata_status: Some("missing_artwork".to_string()),
                sort_by: Some("title".to_string()),
                sort_direction: Some("asc".to_string()),
                ..Default::default()
            })
            .unwrap()
            .iter()
            .map(|game| game.id.as_str())
            .collect::<Vec<_>>(),
            vec![
                missing_artwork.id.as_str(),
                needs_metadata.id.as_str(),
                provider_without_images.id.as_str(),
            ]
        );
        assert_eq!(
            db.list_games(GameFilter {
                metadata_status: Some("missing_description_image".to_string()),
                sort_by: Some("title".to_string()),
                sort_direction: Some("asc".to_string()),
                ..Default::default()
            })
            .unwrap()
            .iter()
            .map(|game| game.id.as_str())
            .collect::<Vec<_>>(),
            vec![
                missing_artwork.id.as_str(),
                provider_without_images.id.as_str()
            ]
        );
        assert_eq!(
            db.list_games(GameFilter {
                developer: Some("Palette".to_string()),
                ..Default::default()
            })
            .unwrap()
            .len(),
            1
        );
        assert_eq!(
            db.list_games(GameFilter {
                favorite: Some(true),
                ..Default::default()
            })
            .unwrap()
            .len(),
            1
        );
        assert_eq!(
            db.list_games(GameFilter {
                hidden: Some(true),
                ..Default::default()
            })
            .unwrap()
            .len(),
            1
        );
        assert_eq!(
            db.list_games(GameFilter {
                metadata_status: Some("complete".to_string()),
                ..Default::default()
            })
            .unwrap()
            .len(),
            2
        );
        assert_eq!(
            db.list_games(GameFilter {
                metadata_status: Some("needs_metadata".to_string()),
                ..Default::default()
            })
            .unwrap()
            .len(),
            2
        );
        assert_eq!(
            db.list_games(GameFilter {
                path_status: Some("ok".to_string()),
                ..Default::default()
            })
            .unwrap()[0]
                .id,
            filtered.id
        );
        assert_eq!(
            db.list_games(GameFilter {
                path_status: Some("broken".to_string()),
                ..Default::default()
            })
            .unwrap()[0]
                .id,
            needs_metadata.id
        );
    }

    #[test]
    fn game_notes_persist_and_update_without_metadata_fields() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        let db = Database { conn };
        db.migrate().unwrap();

        let game = db
            .add_game(AddGameInput {
                title: "Notes VN".to_string(),
                install_path: "D:\\Games\\Notes VN".to_string(),
                notes: Some("  patch 1.02 installed  ".to_string()),
                description: Some("metadata description".to_string()),
                ..empty_game_input()
            })
            .unwrap();
        assert_eq!(game.notes.as_deref(), Some("patch 1.02 installed"));

        let updated = db
            .update_game(
                game.id.clone(),
                UpdateGameInput {
                    notes: Some("route A complete".to_string()),
                    title: Some("Notes VN Plus".to_string()),
                    ..Default::default()
                },
            )
            .unwrap();
        assert_eq!(updated.notes.as_deref(), Some("route A complete"));
        assert_eq!(updated.description.as_deref(), Some("metadata description"));

        let cleared = db
            .update_game(
                game.id,
                UpdateGameInput {
                    notes: Some("   ".to_string()),
                    ..Default::default()
                },
            )
            .unwrap();
        assert_eq!(cleared.notes, None);
    }

    #[test]
    fn play_sessions_list_recent_first_and_respect_limit() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        let db = Database { conn };
        db.migrate().unwrap();

        let game = db
            .add_game(AddGameInput {
                title: "Session VN".to_string(),
                install_path: "D:\\Games\\Session VN".to_string(),
                ..empty_game_input()
            })
            .unwrap();

        db.conn.execute(
            "INSERT INTO play_sessions (id, game_id, started_at, ended_at, duration_seconds, exit_status) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params!["old-session", game.id, "2026-01-01T12:00:00Z", "2026-01-01T12:30:00Z", 1800, "0"],
        ).unwrap();
        db.conn.execute(
            "INSERT INTO play_sessions (id, game_id, started_at, ended_at, duration_seconds, exit_status) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params!["new-session", game.id, "2026-01-02T12:00:00Z", "2026-01-02T12:15:00Z", 900, "0"],
        ).unwrap();

        let sessions = db.list_play_sessions(game.id, 1).unwrap();
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].id, "new-session");
        assert_eq!(sessions[0].duration_seconds, 900);
    }

    #[test]
    fn migration_creates_and_syncs_assets_and_tags() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        let db = Database { conn };
        db.migrate().unwrap();

        let game = db
            .add_game(AddGameInput {
                title: "Asset VN".to_string(),
                install_path: "D:\\Games\\Asset VN".to_string(),
                tags: Some(vec!["纯爱".to_string(), "纯爱".to_string()]),
                genres: Some(vec!["Visual Novel".to_string()]),
                cover_image: Some("cover.jpg".to_string()),
                background_image: Some("bg.png".to_string()),
                ..empty_game_input()
            })
            .unwrap();

        let assets = db.list_game_assets(game.id.clone()).unwrap();
        assert!(assets.iter().any(|asset| asset.asset_type == "cover"
            && asset.uri == "cover.jpg"
            && asset.is_primary));
        assert!(assets.iter().any(|asset| asset.asset_type == "background"
            && asset.uri == "bg.png"
            && asset.is_primary));
        let tags = db.list_tags(None).unwrap();
        assert!(tags
            .iter()
            .any(|tag| tag.name == "纯爱" && tag.kind == "tag" && tag.game_count == 1));
        assert!(tags
            .iter()
            .any(|tag| tag.name == "Visual Novel" && tag.kind == "genre" && tag.game_count == 1));
    }

    #[test]
    fn manual_asset_updates_primary_game_field() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        let db = Database { conn };
        db.migrate().unwrap();

        let game = db
            .add_game(AddGameInput {
                title: "Manual Asset VN".to_string(),
                install_path: "D:\\Games\\Manual Asset VN".to_string(),
                ..empty_game_input()
            })
            .unwrap();
        let asset = db
            .upsert_game_asset(
                game.id.clone(),
                AssetInput {
                    asset_type: "cover".to_string(),
                    uri: "manual.jpg".to_string(),
                    source: Some("manual".to_string()),
                    is_primary: Some(true),
                },
            )
            .unwrap();
        let updated = db.get_game(game.id.clone()).unwrap();
        assert_eq!(updated.cover_image.as_deref(), Some("manual.jpg"));

        let cleared = db.remove_game_asset(asset.id).unwrap();
        assert_eq!(cleared.cover_image, None);
    }

    #[test]
    fn tag_maintenance_renames_merges_and_deletes_normalized_tags() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        let db = Database { conn };
        db.migrate().unwrap();

        let first = db
            .add_game(AddGameInput {
                title: "First Tag VN".to_string(),
                install_path: "D:\\Games\\First Tag VN".to_string(),
                tags: Some(vec!["pure love".to_string(), "moege".to_string()]),
                ..empty_game_input()
            })
            .unwrap();
        let second = db
            .add_game(AddGameInput {
                title: "Second Tag VN".to_string(),
                install_path: "D:\\Games\\Second Tag VN".to_string(),
                tags: Some(vec!["moege".to_string()]),
                ..empty_game_input()
            })
            .unwrap();

        let tags = db.list_tags(Some("tag".to_string())).unwrap();
        let pure_love = tags
            .iter()
            .find(|tag| tag.name == "pure love")
            .unwrap()
            .clone();
        let moege = tags.iter().find(|tag| tag.name == "moege").unwrap().clone();

        let renamed = db
            .rename_tag(pure_love.id.clone(), "純愛".to_string())
            .unwrap();
        assert_eq!(renamed.name, "純愛");
        assert_eq!(renamed.game_count, 1);

        let merged = db
            .merge_tags(vec![renamed.id.clone()], moege.id.clone())
            .unwrap();
        assert_eq!(merged.name, "moege");
        assert_eq!(merged.game_count, 2);
        let tags_after_merge = db.list_tags(Some("tag".to_string())).unwrap();
        assert!(!tags_after_merge.iter().any(|tag| tag.name == "純愛"));
        assert_eq!(
            tags_after_merge
                .iter()
                .find(|tag| tag.name == "moege")
                .unwrap()
                .game_count,
            2
        );

        db.delete_tag(moege.id).unwrap();
        assert!(db.list_tags(Some("tag".to_string())).unwrap().is_empty());
        let first_links: i64 = db
            .conn
            .query_row(
                "SELECT COUNT(*) FROM game_tags WHERE game_id = ?1",
                params![first.id],
                |row| row.get(0),
            )
            .unwrap();
        let second_links: i64 = db
            .conn
            .query_row(
                "SELECT COUNT(*) FROM game_tags WHERE game_id = ?1",
                params![second.id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(first_links, 0);
        assert_eq!(second_links, 0);
    }

    #[test]
    fn migration_creates_scan_task_results_table() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        let db = Database { conn };
        db.migrate().unwrap();

        let task = db
            .create_task("library.scan", Some("Scanning".to_string()))
            .unwrap();
        db.upsert_scan_task_result(&task.id, "D:\\Games", true, &[])
            .unwrap();

        let status = db.get_scan_task_status(&task.id).unwrap();
        assert_eq!(status.path.as_deref(), Some("D:\\Games"));
        assert_eq!(status.recursive, Some(true));
        assert!(status.candidates.is_empty());
    }

    #[test]
    fn metadata_match_jobs_keep_task_link_and_migrate_column() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            PRAGMA foreign_keys = ON;
            CREATE TABLE metadata_match_jobs (
              id TEXT PRIMARY KEY,
              status TEXT NOT NULL,
              total INTEGER NOT NULL,
              completed INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
            PRAGMA user_version = 11;
            "#,
        )
        .unwrap();
        let db = Database { conn };
        db.migrate().unwrap();

        let columns = db.table_columns("metadata_match_jobs").unwrap();
        assert!(columns.iter().any(|column| column == "task_id"));
        let task = db
            .create_task("metadata.batch_match", Some("Matching".to_string()))
            .unwrap();
        let job = db
            .create_match_job(&["game-1".to_string()], Some(task.id.clone()))
            .unwrap();
        let loaded = db.get_match_job(&job.id).unwrap();

        assert_eq!(loaded.task_id.as_deref(), Some(task.id.as_str()));
    }

    #[test]
    fn migration_creates_launch_profiles_table() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        let db = Database { conn };
        db.migrate().unwrap();

        let game = db
            .add_game(AddGameInput {
                title: "Test VN".to_string(),
                install_path: "D:\\Games\\Test VN".to_string(),
                ..empty_game_input()
            })
            .unwrap();
        let profile = db
            .create_launch_profile(CreateLaunchProfileInput {
                game_id: game.id.clone(),
                name: "默认启动".to_string(),
                executable_path: "D:\\Games\\Test VN\\game.exe".to_string(),
                working_directory: Some("D:\\Games\\Test VN".to_string()),
                arguments: Some("-windowed".to_string()),
                environment_variables: None,
                runner_type: None,
                locale_emulator_path: None,
                pre_launch_command: None,
                post_launch_command: None,
                run_as_admin: Some(false),
                is_default: Some(true),
                compatibility_notes: None,
            })
            .unwrap();

        assert!(profile.is_default);
        assert_eq!(db.list_launch_profiles(game.id).unwrap().len(), 1);
    }

    #[test]
    fn migration_creates_field_locks_table() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        let db = Database { conn };
        db.migrate().unwrap();

        let game = db
            .add_game(AddGameInput {
                title: "Locked VN".to_string(),
                install_path: "D:\\Games\\Locked VN".to_string(),
                ..empty_game_input()
            })
            .unwrap();
        let lock = db
            .set_field_lock(game.id.clone(), "description".to_string(), true)
            .unwrap();

        assert!(lock.locked_by_user);
        assert_eq!(
            db.locked_field_names(&game.id).unwrap(),
            vec!["description".to_string()]
        );
    }

    #[test]
    fn migration_adds_missing_game_columns() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            PRAGMA foreign_keys = ON;
            CREATE TABLE games (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              install_path TEXT NOT NULL
            );
            INSERT INTO games (id, title, install_path) VALUES ('game-1', 'Old Entry', 'D:\Games\Old Entry');
            "#,
        ).unwrap();
        let db = Database { conn };

        db.migrate().unwrap();

        let columns = db.table_columns("games").unwrap();
        assert!(columns.iter().any(|column| column == "hidden"));
        assert!(columns.iter().any(|column| column == "cover_image"));

        let game = db.get_game("game-1".to_string()).unwrap();
        assert_eq!(game.title, "Old Entry");
        assert!(!game.hidden);
        assert_eq!(game.tags, Vec::<String>::new());
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
