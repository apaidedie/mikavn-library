use super::*;

fn test_db() -> Database {
    let path = std::env::temp_dir().join(format!("mikavn-archive-test-{}.db", Uuid::new_v4()));
    Database::new_from_path(path).unwrap()
}

fn database_marker(path: &Path) -> String {
    let conn = Connection::open(path).unwrap();
    conn.query_row("SELECT value FROM marker LIMIT 1", [], |row| row.get(0))
        .unwrap()
}

fn game(id: &str, title: &str, install_path: &str) -> Game {
    Game {
        id: id.to_string(),
        title: title.to_string(),
        original_title: None,
        aliases: Vec::new(),
        developer: None,
        publisher: None,
        brand: None,
        release_date: None,
        description: None,
        notes: None,
        tags: Vec::new(),
        genres: Vec::new(),
        rating: None,
        age_rating: None,
        play_status: "planned".to_string(),
        favorite: false,
        hidden: false,
        install_path: install_path.to_string(),
        executable_path: None,
        working_directory: None,
        launch_args: None,
        path_status: "unknown".to_string(),
        last_path_checked_at: None,
        cover_image: None,
        banner_image: None,
        background_image: None,
        vndb_id: None,
        bangumi_id: None,
        dlsite_id: None,
        fanza_id: None,
        ymgal_id: None,
        total_play_seconds: 0,
        last_played_at: None,
        created_at: String::new(),
        updated_at: String::new(),
    }
}

#[test]
fn copy_dir_recursive_counts_files() {
    let root = std::env::temp_dir().join(format!("mikavn-archive-copy-test-{}", Uuid::new_v4()));
    let source = root.join("source");
    let target = root.join("target");
    fs::create_dir_all(source.join("nested")).unwrap();
    fs::write(source.join("a.txt"), "a").unwrap();
    fs::write(source.join("nested").join("b.txt"), "b").unwrap();

    let count = copy_dir_recursive(&source, &target).unwrap();

    assert_eq!(count, 2);
    assert!(target.join("a.txt").is_file());
    assert!(target.join("nested").join("b.txt").is_file());
    let _ = fs::remove_dir_all(root);
}

#[test]
fn count_files_ignores_missing_directory() {
    let missing = std::env::temp_dir().join(format!("mikavn-missing-{}", Uuid::new_v4()));
    assert_eq!(count_files(&missing).unwrap(), 0);
}

#[test]
fn zip_archive_preview_and_extract_are_safe() {
    let root = std::env::temp_dir().join(format!("mikavn-archive-zip-test-{}", Uuid::new_v4()));
    let source = root.join("source");
    let target = root.join("target");
    let archive = root.join("archive.zip");
    fs::create_dir_all(source.join("images")).unwrap();
    fs::create_dir_all(source.join("save-backups")).unwrap();
    fs::write(source.join("mikavn.db"), "not-a-real-db").unwrap();
    fs::write(source.join("images").join("cover.png"), "image").unwrap();
    fs::write(source.join("save-backups").join("save.dat"), "save").unwrap();
    let manifest = LibraryArchiveManifest {
        app: "MikaVN Library".to_string(),
        archive_version: 1,
        exported_at: Utc::now().to_rfc3339(),
        database_file: "mikavn.db".to_string(),
        include_images: true,
        include_save_backups: true,
        images_count: 1,
        save_backups_count: 1,
        notes: Vec::new(),
    };
    fs::write(
        source.join("manifest.json"),
        serde_json::to_string_pretty(&manifest).unwrap(),
    )
    .unwrap();

    let count = zip_dir(&source, &archive).unwrap();
    let preview = preview_archive_zip(&archive).unwrap();
    extract_archive_zip(&archive, &target).unwrap();

    assert_eq!(count, 4);
    assert!(preview.database_present);
    assert_eq!(preview.images_count, 1);
    assert_eq!(preview.save_backups_count, 1);
    assert!(target.join("manifest.json").is_file());
    assert!(target.join("images").join("cover.png").is_file());
    let _ = fs::remove_dir_all(root);
}

#[test]
fn zip_archive_preview_rejects_unsafe_entry_paths() {
    let root = std::env::temp_dir().join(format!(
        "mikavn-archive-zip-unsafe-preview-test-{}",
        Uuid::new_v4()
    ));
    fs::create_dir_all(&root).unwrap();
    let archive_path = root.join("unsafe.zip");
    let file = File::create(&archive_path).unwrap();
    let mut writer = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    let manifest = LibraryArchiveManifest {
        app: "MikaVN Library".to_string(),
        archive_version: 1,
        exported_at: Utc::now().to_rfc3339(),
        database_file: "mikavn.db".to_string(),
        include_images: false,
        include_save_backups: false,
        images_count: 0,
        save_backups_count: 0,
        notes: Vec::new(),
    };
    writer.start_file("manifest.json", options).unwrap();
    writer
        .write_all(serde_json::to_string_pretty(&manifest).unwrap().as_bytes())
        .unwrap();
    writer.start_file("../outside.txt", options).unwrap();
    writer.write_all(b"escape").unwrap();
    writer.finish().unwrap();

    let error = preview_archive_zip(&archive_path).unwrap_err();

    assert_eq!(error.code, "VALIDATION_ERROR");
    assert!(error.message.contains("unsafe path"));
    let _ = fs::remove_dir_all(root);
}

#[test]
fn validate_archive_restore_database_rejects_non_mikavn_database() {
    let root = std::env::temp_dir().join(format!(
        "mikavn-archive-restore-validate-test-{}",
        Uuid::new_v4()
    ));
    fs::create_dir_all(&root).unwrap();
    let database = root.join("foreign.db");
    let conn = Connection::open(&database).unwrap();
    conn.execute("CREATE TABLE other_app(id TEXT PRIMARY KEY)", [])
        .unwrap();
    drop(conn);

    let error = validate_archive_restore_database(&database).unwrap_err();

    assert_eq!(error.code, "BACKUP_FAILED");
    assert!(error
        .message
        .contains("does not look like a MikaVN database"));
    let _ = fs::remove_dir_all(root);
}

#[test]
fn restore_cache_directory_mirrors_and_protects_existing_cache() {
    let root = std::env::temp_dir().join(format!(
        "mikavn-archive-restore-cache-test-{}",
        Uuid::new_v4()
    ));
    let source = root.join("archive-images");
    let target = root.join("app-data-images");
    let protection = root.join("protection-images");
    fs::create_dir_all(source.join("nested")).unwrap();
    fs::create_dir_all(target.join("stale-nested")).unwrap();
    fs::create_dir_all(target.join("empty-stale-dir")).unwrap();
    fs::write(source.join("new.webp"), "new").unwrap();
    fs::write(source.join("nested").join("fresh.webp"), "fresh").unwrap();
    fs::write(target.join("old.webp"), "old").unwrap();
    fs::write(target.join("stale-nested").join("stale.webp"), "stale").unwrap();

    let restored = restore_cache_directory(&source, &target, &protection).unwrap();

    assert_eq!(restored, 2);
    assert!(target.join("new.webp").is_file());
    assert!(target.join("nested").join("fresh.webp").is_file());
    assert!(!target.join("old.webp").exists());
    assert!(!target.join("stale-nested").exists());
    assert!(!target.join("empty-stale-dir").exists());
    assert!(protection.join("old.webp").is_file());
    assert!(protection.join("stale-nested").join("stale.webp").is_file());
    let _ = fs::remove_dir_all(root);
}

#[test]
fn replace_pending_restore_database_preserves_existing_pending_on_failure() {
    let root = std::env::temp_dir().join(format!(
        "mikavn-archive-pending-replace-test-{}",
        Uuid::new_v4()
    ));
    fs::create_dir_all(&root).unwrap();
    let pending = root.join("mikavn.db");
    let staging = root.join("staging.db");
    let invalid_staging = root.join("invalid.db");
    Database::new_from_path(&pending).unwrap();
    Database::new_from_path(&staging).unwrap();
    fs::write(&invalid_staging, b"not sqlite").unwrap();
    Connection::open(&pending)
        .unwrap()
        .execute("CREATE TABLE marker(value TEXT)", [])
        .unwrap();
    Connection::open(&pending)
        .unwrap()
        .execute("INSERT INTO marker(value) VALUES ('old')", [])
        .unwrap();
    Connection::open(&staging)
        .unwrap()
        .execute("CREATE TABLE marker(value TEXT)", [])
        .unwrap();
    Connection::open(&staging)
        .unwrap()
        .execute("INSERT INTO marker(value) VALUES ('new')", [])
        .unwrap();

    replace_pending_restore_database(&staging, &pending, fs::metadata(&staging).unwrap().len())
        .unwrap();

    assert_eq!(database_marker(&pending), "new");
    let error = replace_pending_restore_database(
        &invalid_staging,
        &pending,
        fs::metadata(&invalid_staging).unwrap().len(),
    )
    .unwrap_err();

    assert_ne!(error.code, "VALIDATION_ERROR");
    assert_eq!(database_marker(&pending), "new");
    let _ = fs::remove_dir_all(root);
}

#[test]
fn archive_directory_round_trips_real_database_records_and_indexes() {
    let root =
        std::env::temp_dir().join(format!("mikavn-archive-roundtrip-test-{}", Uuid::new_v4()));
    let source_root = root.join("source");
    let archive_dir = root.join("archive");
    let target_root = root.join("target");
    fs::create_dir_all(&source_root).unwrap();
    fs::create_dir_all(&archive_dir).unwrap();
    fs::create_dir_all(&target_root).unwrap();

    let source_db = Database::new_from_path(source_root.join("mikavn.db")).unwrap();
    let mut source_game = game("roundtrip-game", "Round Trip VN", "D:\\Games\\RoundTrip");
    source_game.original_title = Some("Round Trip Original".to_string());
    source_game.aliases = vec!["RTVN".to_string(), "Roundtrip".to_string()];
    source_game.developer = Some("MikaVN Studio".to_string());
    source_game.description = Some("A migration proof record.".to_string());
    source_game.notes = Some("Patch 1.02 installed.".to_string());
    source_game.tags = vec!["mystery".to_string(), "drama".to_string()];
    source_game.genres = vec!["Visual Novel".to_string()];
    source_game.favorite = true;
    source_game.cover_image = Some("images/roundtrip-cover.webp".to_string());
    source_game.vndb_id = Some("v12345".to_string());
    source_game.dlsite_id = Some("RJ01234567".to_string());
    game_service::insert_imported_game(&source_db, source_game).unwrap();

    source_db
        .backup_to_path(&archive_dir.join("mikavn.db"))
        .unwrap();
    let manifest = LibraryArchiveManifest {
        app: "MikaVN Library".to_string(),
        archive_version: 1,
        exported_at: Utc::now().to_rfc3339(),
        database_file: "mikavn.db".to_string(),
        include_images: false,
        include_save_backups: false,
        images_count: 0,
        save_backups_count: 0,
        notes: vec![
            "This archive contains MikaVN database records only.".to_string(),
            "It never contains or deletes real game installation directories.".to_string(),
        ],
    };
    fs::write(
        archive_dir.join("manifest.json"),
        serde_json::to_string_pretty(&manifest).unwrap(),
    )
    .unwrap();

    let preview = preview_archive_dir(&archive_dir).unwrap();
    assert!(preview.database_present);
    assert_eq!(preview.manifest.database_file, "mikavn.db");
    assert!(preview.warnings.is_empty());

    let archive_games = read_archive_games(&archive_dir.join("mikavn.db")).unwrap();
    assert_eq!(archive_games.len(), 1);
    assert_eq!(archive_games[0].title, "Round Trip VN");
    assert_eq!(archive_games[0].tags, vec!["mystery", "drama"]);
    assert_eq!(archive_games[0].genres, vec!["Visual Novel"]);
    assert_eq!(archive_games[0].vndb_id.as_deref(), Some("v12345"));

    let target_db = Database::new_from_path(target_root.join("mikavn.db")).unwrap();
    let task = target_db
        .create_task(
            "library.archive_import",
            Some("Round-trip archive import".to_string()),
        )
        .unwrap();
    let mut summary = ImportSummary {
        imported: 0,
        skipped: 0,
        images: 0,
        save_backups: 0,
        protection_path: root.join("before-import.db"),
    };
    let mut progress_messages = Vec::new();

    import_archive_games_with_summary(
        &target_db,
        &task.id,
        archive_games,
        &mut summary,
        |progress, message| {
            progress_messages.push((progress, message));
            Ok(())
        },
    )
    .unwrap();

    assert_eq!(summary.imported, 1);
    assert_eq!(summary.skipped, 0);
    assert_eq!(progress_messages.len(), 1);
    assert!(progress_messages[0].1.contains("已导入 1 个，跳过 0 个"));

    let imported_games = target_db.list_games(GameFilter::default()).unwrap();
    assert_eq!(imported_games.len(), 1);
    let imported = &imported_games[0];
    assert_eq!(imported.title, "Round Trip VN");
    assert_eq!(
        imported.original_title.as_deref(),
        Some("Round Trip Original")
    );
    assert_eq!(imported.aliases, vec!["RTVN", "Roundtrip"]);
    assert_eq!(imported.developer.as_deref(), Some("MikaVN Studio"));
    assert_eq!(imported.notes.as_deref(), Some("Patch 1.02 installed."));
    assert!(imported.favorite);
    assert_eq!(
        imported.cover_image.as_deref(),
        Some("images/roundtrip-cover.webp")
    );

    let assets = target_db.list_game_assets(imported.id.clone()).unwrap();
    assert!(assets.iter().any(|asset| asset.asset_type == "cover"
        && asset.uri == "images/roundtrip-cover.webp"
        && asset.source.as_deref() == Some("archive_import")));
    let tags = target_db.list_tags(None).unwrap();
    assert!(tags
        .iter()
        .any(|tag| tag.kind == "tag" && tag.name == "mystery" && tag.game_count == 1));
    assert!(tags
        .iter()
        .any(|tag| tag.kind == "genre" && tag.name == "Visual Novel" && tag.game_count == 1));
    let external_ids = target_db.list_external_ids(imported.id.clone()).unwrap();
    assert!(external_ids
        .iter()
        .any(|id| id.provider == "vndb" && id.external_id == "v12345"));
    assert!(external_ids
        .iter()
        .any(|id| id.provider == "dlsite" && id.external_id == "RJ01234567"));
    let logs = target_db.list_task_logs(&task.id).unwrap();
    assert!(logs
        .iter()
        .any(|log| log.message.contains("归档导入新增：Round Trip VN")));

    drop(target_db);
    drop(source_db);
    let _ = fs::remove_dir_all(root);
}

#[test]
fn detects_archive_game_conflicts() {
    let existing = game("game-1", "星之终途", "D:\\Games\\星之终途");
    let same_title = Game {
        id: "game-2".to_string(),
        install_path: "D:\\Other".to_string(),
        ..existing.clone()
    };
    let same_path = Game {
        id: "game-3".to_string(),
        title: "Other".to_string(),
        ..existing.clone()
    };
    let new_game = Game {
        id: "game-4".to_string(),
        title: "New".to_string(),
        install_path: "D:\\Games\\New".to_string(),
        ..existing.clone()
    };

    assert_eq!(
        archive_import_conflict_reason(&[existing.clone()], &same_title).as_deref(),
        Some("标题已存在：星之终途")
    );
    assert_eq!(
        archive_import_conflict_reason(&[existing.clone()], &same_path).as_deref(),
        Some("安装目录已存在：星之终途")
    );
    assert!(archive_import_conflict_reason(&[existing], &new_game).is_none());
}

#[test]
fn archive_import_summary_logs_added_and_skipped_games() {
    let db = test_db();
    let task = db
        .create_task("library.archive_import", Some("导入测试".to_string()))
        .unwrap();
    let existing = game("existing", "Existing Title", "D:\\Games\\Existing");
    game_service::insert_imported_game(&db, existing).unwrap();
    let mut summary = ImportSummary {
        imported: 0,
        skipped: 0,
        images: 0,
        save_backups: 0,
        protection_path: PathBuf::from("D:\\Protection\\before-import.db"),
    };

    import_archive_games_with_summary(
        &db,
        &task.id,
        vec![
            game("new", "Fresh Title", "D:\\Games\\Fresh"),
            game("conflict-title", "Existing Title", "D:\\Games\\Other"),
            game("conflict-path", "Other Title", "D:\\Games\\Existing"),
        ],
        &mut summary,
        |_, _| Ok(()),
    )
    .unwrap();

    assert_eq!(summary.imported, 1);
    assert_eq!(summary.skipped, 2);
    let logs = db.list_task_logs(&task.id).unwrap();
    assert!(logs
        .iter()
        .any(|log| log.message.contains("归档导入新增：Fresh Title")));
    assert!(logs
        .iter()
        .any(|log| log.message.contains("标题已存在：Existing Title")));
    assert!(logs
        .iter()
        .any(|log| log.message.contains("安装目录已存在：Existing Title")));
}

#[test]
fn archive_export_audit_logs_describe_target_and_scope() {
    let logs = archive_export_audit_logs("归档导出", "D:\\MikaVN-Archives", true, false);

    assert_eq!(logs[0], "归档导出目标：D:\\MikaVN-Archives");
    assert_eq!(logs[1], "归档导出包含：图片 是，存档备份 否");
}

#[test]
fn archive_zip_export_audit_logs_describe_target_and_scope() {
    let logs = archive_export_audit_logs("ZIP 归档导出", "D:\\MikaVN-Archives", false, true);

    assert_eq!(logs[0], "ZIP 归档导出目标：D:\\MikaVN-Archives");
    assert_eq!(logs[1], "ZIP 归档导出包含：图片 否，存档备份 是");
}

#[test]
fn archive_import_summary_handles_large_batches_with_in_memory_conflicts() {
    let db = test_db();
    let task = db
        .create_task("library.archive_import", Some("批量导入测试".to_string()))
        .unwrap();
    game_service::insert_imported_game(
        &db,
        game("existing", "Existing Title", "D:\\Games\\Existing"),
    )
    .unwrap();
    let mut archive_games = (0..600)
        .map(|index| {
            game(
                &format!("new-{index}"),
                &format!("Batch Title {index}"),
                &format!("D:\\Games\\Batch\\{index}"),
            )
        })
        .collect::<Vec<_>>();
    archive_games.push(game(
        "conflict-existing-title",
        "Existing Title",
        "D:\\Games\\Other",
    ));
    archive_games.push(game(
        "conflict-existing-path",
        "Other Existing Path Title",
        "D:\\Games\\Existing",
    ));
    archive_games.push(game(
        "conflict-batch-title",
        "Batch Title 42",
        "D:\\Games\\Batch\\duplicate-title",
    ));
    archive_games.push(game(
        "conflict-batch-path",
        "Duplicate Batch Path Title",
        "D:\\Games\\Batch\\43",
    ));
    let mut summary = ImportSummary {
        imported: 0,
        skipped: 0,
        images: 0,
        save_backups: 0,
        protection_path: PathBuf::from("D:\\Protection\\before-import.db"),
    };
    let mut progress_updates = 0;

    import_archive_games_with_summary(&db, &task.id, archive_games, &mut summary, |_, _| {
        progress_updates += 1;
        Ok(())
    })
    .unwrap();

    assert_eq!(summary.imported, 600);
    assert_eq!(summary.skipped, 4);
    assert_eq!(progress_updates, 604);
    assert_eq!(db.list_games(GameFilter::default()).unwrap().len(), 601);
    let logs = db.list_task_logs(&task.id).unwrap();
    assert_eq!(
        logs.iter()
            .filter(|log| log.message.contains("归档导入新增：Batch Title"))
            .count(),
        600
    );
    assert!(logs
        .iter()
        .any(|log| log.message.contains("标题已存在：Batch Title 42")));
    assert!(logs
        .iter()
        .any(|log| log.message.contains("安装目录已存在：Batch Title 43")));
}
