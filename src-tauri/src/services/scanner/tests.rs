use super::*;

fn game(id: &str, title: &str, install_path: &str, executable_path: Option<&str>) -> Game {
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
        executable_path: executable_path.map(ToString::to_string),
        working_directory: Some(install_path.to_string()),
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

fn candidate(title: &str, install_path: &str, executable_path: Option<&str>) -> ScanCandidate {
    ScanCandidate {
        id: "candidate".to_string(),
        root_path: "D:\\Games".to_string(),
        install_path: install_path.to_string(),
        folder_name: title.to_string(),
        suggested_title: title.to_string(),
        aliases: vec![title.to_string()],
        executables: Vec::new(),
        selected_executable: executable_path.map(ToString::to_string),
        conflict: None,
    }
}

#[test]
fn detects_install_path_conflict() {
    let games = vec![game("game-1", "星之终途", "D:\\Games\\星之终途", None)];
    let conflict = find_candidate_conflict(
        &games,
        &candidate("星之终途 汉化版", "D:/Games/星之终途/", None),
    )
    .unwrap();
    assert_eq!(conflict.reason, "安装目录已存在");
}

#[test]
fn detects_title_conflict() {
    let games = vec![game(
        "game-1",
        "天使☆騒々 RE-BOOT!",
        "D:\\Games\\Yuzu\\Tenshi",
        None,
    )];
    let conflict = find_candidate_conflict(
        &games,
        &candidate("天使☆騒々 RE-BOOT!", "D:\\Games\\Other", None),
    )
    .unwrap();
    assert_eq!(conflict.reason, "标题相同");
}

fn import_candidate(
    title: &str,
    install_path: &str,
    action: Option<&str>,
    conflict_game_id: Option<String>,
) -> ImportCandidate {
    ImportCandidate {
        title: title.to_string(),
        install_path: install_path.to_string(),
        executable_path: Some(format!("{}\\game.exe", install_path)),
        aliases: Some(vec![format!("{title} folder")]),
        allow_duplicate: Some(action == Some("duplicate")),
        conflict_action: action.map(ToString::to_string),
        conflict_game_id,
    }
}

fn test_db(name: &str) -> Database {
    let path =
        std::env::temp_dir().join(format!("mikavn-scanner-test-{name}-{}.db", Uuid::new_v4()));
    Database::new_from_path(path).unwrap()
}

fn add_game_input(title: &str, install_path: &str) -> AddGameInput {
    AddGameInput {
        title: title.to_string(),
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
        install_path: install_path.to_string(),
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

#[test]
fn merge_import_candidate_updates_existing_record_paths() {
    let db = test_db("merge");
    let existing = db
        .add_game(AddGameInput {
            executable_path: Some("D:\\Old\\星之终途\\old.exe".to_string()),
            aliases: Some(vec!["終のステラ".to_string()]),
            ..add_game_input("星之终途", "D:\\Old\\星之终途")
        })
        .unwrap();

    let updated = merge_import_candidate(
        &db,
        &import_candidate(
            "星之终途",
            "D:\\New\\星之终途",
            Some("merge"),
            Some(existing.id.clone()),
        ),
        &existing.id,
    )
    .unwrap();

    assert_eq!(updated.install_path, "D:\\New\\星之终途");
    assert_eq!(
        updated.executable_path.as_deref(),
        Some("D:\\New\\星之终途\\game.exe")
    );
    assert!(updated.aliases.contains(&"終のステラ".to_string()));
    assert!(updated.aliases.contains(&"星之终途 folder".to_string()));
}

#[test]
fn merge_rejects_stale_conflict_target() {
    let db = test_db("stale-target");

    let err = merge_import_candidate(
        &db,
        &import_candidate(
            "星之终途",
            "D:\\New\\星之终途",
            Some("merge"),
            Some("other-game".to_string()),
        ),
        "game-1",
    )
    .unwrap_err();
    assert_eq!(err.code, "VALIDATION_ERROR");
}

#[test]
fn replace_import_candidate_overwrites_database_record_only() {
    let db = test_db("replace");
    let existing = db
        .add_game(AddGameInput {
            executable_path: Some("D:\\Old\\old.exe".to_string()),
            aliases: Some(vec!["old alias".to_string()]),
            ..add_game_input("旧标题", "D:\\Old")
        })
        .unwrap();

    let updated = replace_import_candidate(
        &db,
        &import_candidate(
            "新标题",
            "D:\\New",
            Some("replace"),
            Some(existing.id.clone()),
        ),
        &existing.id,
    )
    .unwrap();

    assert_eq!(updated.id, existing.id);
    assert_eq!(updated.title, "新标题");
    assert_eq!(updated.install_path, "D:\\New");
    assert_eq!(
        updated.executable_path.as_deref(),
        Some("D:\\New\\game.exe")
    );
    assert!(!updated.aliases.contains(&"old alias".to_string()));
}

#[test]
fn replace_rejects_stale_conflict_target() {
    let db = test_db("replace-stale-target");
    let existing = db.add_game(add_game_input("旧标题", "D:\\Old")).unwrap();

    let err = replace_import_candidate(
        &db,
        &import_candidate(
            "新标题",
            "D:\\New",
            Some("replace"),
            Some("other-game".to_string()),
        ),
        &existing.id,
    )
    .unwrap_err();

    assert_eq!(err.code, "VALIDATION_ERROR");
}

#[test]
fn import_scan_candidates_handles_mixed_conflict_actions() {
    let db = test_db("mixed-actions");
    let skip_existing = db
        .add_game(add_game_input("Skip Existing", "D:\\Games\\Skip"))
        .unwrap();
    let merge_existing = db
        .add_game(AddGameInput {
            aliases: Some(vec!["merge old".to_string()]),
            executable_path: Some("D:\\Games\\MergeOld\\old.exe".to_string()),
            ..add_game_input("Merge Existing", "D:\\Games\\MergeOld")
        })
        .unwrap();
    let replace_existing = db
        .add_game(AddGameInput {
            aliases: Some(vec!["replace old".to_string()]),
            executable_path: Some("D:\\Games\\ReplaceOld\\game.exe".to_string()),
            ..add_game_input("Replace Existing", "D:\\Games\\ReplaceOld")
        })
        .unwrap();
    let duplicate_existing = db
        .add_game(add_game_input("Duplicate Existing", "D:\\Games\\Duplicate"))
        .unwrap();

    let report = import_scan_candidates(
        &db,
        vec![
            import_candidate(
                "Skip Existing",
                "D:\\Games\\Skip",
                Some("skip"),
                Some(skip_existing.id.clone()),
            ),
            import_candidate(
                "Merge Existing",
                "D:\\Games\\MergeNew",
                Some("merge"),
                Some(merge_existing.id.clone()),
            ),
            ImportCandidate {
                title: "Replace New Title".to_string(),
                install_path: "D:\\Games\\ReplaceNew".to_string(),
                executable_path: Some("D:\\Games\\ReplaceOld\\game.exe".to_string()),
                aliases: Some(vec!["Replace New Title folder".to_string()]),
                allow_duplicate: Some(false),
                conflict_action: Some("replace".to_string()),
                conflict_game_id: Some(replace_existing.id.clone()),
            },
            import_candidate(
                "Duplicate Existing",
                "D:\\Games\\Duplicate",
                Some("duplicate"),
                Some(duplicate_existing.id.clone()),
            ),
            import_candidate("Fresh Import", "D:\\Games\\Fresh", None, None),
        ],
    )
    .unwrap();

    assert_eq!(report.requested, 5);
    assert_eq!(report.imported_count, 4);
    assert_eq!(report.added, 1);
    assert_eq!(report.merged, 1);
    assert_eq!(report.replaced, 1);
    assert_eq!(report.duplicated, 1);
    assert_eq!(report.skipped, 1);
    assert_eq!(report.items.len(), 5);
    assert!(
        report
            .items
            .iter()
            .any(|item| item.action == "skip"
                && item.target_title.as_deref() == Some("Skip Existing"))
    );
    assert!(report
        .items
        .iter()
        .any(|item| item.action == "merge" && item.conflict_reason.as_deref() == Some("标题相同")));
    assert!(report
        .items
        .iter()
        .any(|item| item.action == "add" && item.candidate_title == "Fresh Import"));
    assert!(!report
        .imported
        .iter()
        .any(|game| game.id == skip_existing.id));

    let merged = db.get_game(merge_existing.id.clone()).unwrap();
    assert_eq!(merged.install_path, "D:\\Games\\MergeNew");
    assert!(merged.aliases.contains(&"merge old".to_string()));
    assert!(merged
        .aliases
        .contains(&"Merge Existing folder".to_string()));

    let replaced = db.get_game(replace_existing.id.clone()).unwrap();
    assert_eq!(replaced.title, "Replace New Title");
    assert_eq!(replaced.install_path, "D:\\Games\\ReplaceNew");
    assert!(!replaced.aliases.contains(&"replace old".to_string()));

    let all = db.list_games(GameFilter::default()).unwrap();
    assert_eq!(all.len(), 6);
    assert_eq!(
        all.iter()
            .filter(|game| game.install_path == "D:\\Games\\Duplicate")
            .count(),
        2
    );
    assert!(all.iter().any(|game| game.title == "Fresh Import"));
}

#[test]
fn import_scan_report_includes_auditable_item_details() {
    let db = test_db("auditable-report-details");
    let existing = db
        .add_game(add_game_input("Audit Existing", "D:\\Games\\AuditOld"))
        .unwrap();

    let report = import_scan_candidates(
        &db,
        vec![
            import_candidate(
                "Audit Existing",
                "D:\\Games\\AuditNew",
                Some("merge"),
                Some(existing.id.clone()),
            ),
            import_candidate("Fresh Audit", "D:\\Games\\FreshAudit", None, None),
        ],
    )
    .unwrap();

    let merged = report
        .items
        .iter()
        .find(|item| item.action == "merge")
        .expect("merge audit item");
    assert_eq!(merged.candidate_title, "Audit Existing");
    assert_eq!(merged.install_path, "D:\\Games\\AuditNew");
    assert_eq!(merged.game_id.as_deref(), Some(existing.id.as_str()));
    assert_eq!(merged.target_title.as_deref(), Some("Audit Existing"));
    assert_eq!(merged.conflict_reason.as_deref(), Some("标题相同"));
    assert_eq!(merged.message, "已合并到现有记录");

    let added = report
        .items
        .iter()
        .find(|item| item.action == "add")
        .expect("add audit item");
    assert_eq!(added.candidate_title, "Fresh Audit");
    assert_eq!(added.install_path, "D:\\Games\\FreshAudit");
    assert!(added.game_id.is_some());
    assert_eq!(added.target_title.as_deref(), Some("Fresh Audit"));
    assert!(added.conflict_reason.is_none());
    assert_eq!(added.message, "已新增游戏记录");
}

#[test]
fn local_windows_workflow_scans_imports_backs_up_and_validates_paths() {
    let root = std::env::temp_dir().join(format!("mikavn-local-workflow-{}", Uuid::new_v4()));
    let library = root.join("library");
    let game_dir = library.join("[240101][QA Circle] Local Workflow VN");
    let exe = game_dir.join("LocalWorkflow.exe");
    fs::create_dir_all(&game_dir).unwrap();
    fs::write(&exe, b"fake exe for local workflow smoke").unwrap();

    let db_path = root.join("mikavn.db");
    let db = Database::new_from_path(db_path.clone()).unwrap();
    let candidates = scan_path_preview(&db, library.to_string_lossy().to_string(), true).unwrap();
    let candidate = candidates
        .iter()
        .find(|item| item.install_path == game_dir.to_string_lossy())
        .expect("scanned local workflow candidate");
    assert_eq!(candidate.suggested_title, "Local Workflow VN");
    assert_eq!(
        candidate.selected_executable.as_deref(),
        Some(exe.to_string_lossy().as_ref())
    );

    let report = import_scan_candidates(
        &db,
        vec![ImportCandidate {
            title: candidate.suggested_title.clone(),
            install_path: candidate.install_path.clone(),
            executable_path: candidate.selected_executable.clone(),
            aliases: Some(candidate.aliases.clone()),
            allow_duplicate: Some(false),
            conflict_action: None,
            conflict_game_id: None,
        }],
    )
    .unwrap();
    assert_eq!(report.imported_count, 1);
    assert_eq!(db.list_games(GameFilter::default()).unwrap().len(), 1);

    let backup = root.join("backups").join("manual.db");
    db.backup_to_path(&backup).unwrap();
    assert!(backup.is_file());
    assert!(backup.metadata().unwrap().len() > 0);

    assert!(validate_reveal_target(&game_dir).is_ok());
    assert_eq!(
        validate_reveal_target(&root.join("missing"))
            .unwrap_err()
            .code,
        "PATH_NOT_FOUND"
    );

    let _ = fs::remove_dir_all(root);
}

fn validate_reveal_target(path: &Path) -> DbResult<()> {
    if path.as_os_str().is_empty() {
        return Err(DbError::validation("path is required"));
    }
    if !path.exists() {
        return Err(DbError::path_not_found("path does not exist"));
    }
    Ok(())
}
