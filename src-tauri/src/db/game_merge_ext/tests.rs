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
