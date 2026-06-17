use super::*;
use crate::db::models::AddGameInput;

#[test]
fn rejects_missing_save_path() {
    let path = PathBuf::from("Z:\\this-path-should-not-exist\\mikavn");
    assert!(validate_existing_dir(&path).is_err());
}

#[test]
fn suggests_existing_save_folder_under_install_dir() {
    let root = std::env::temp_dir().join(format!("mikavn-save-candidate-{}", Uuid::new_v4()));
    fs::create_dir_all(root.join("SaveData")).unwrap();

    let candidates =
        suggest_save_path_candidates("星之终途", &root.to_string_lossy(), None, &HashSet::new());

    assert!(candidates
        .iter()
        .any(|item| item.path.to_lowercase().ends_with("savedata") && item.exists));
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn marks_existing_save_path_candidate_as_added() {
    let root = std::env::temp_dir().join(format!("mikavn-save-candidate-{}", Uuid::new_v4()));
    let save_dir = root.join("save");
    fs::create_dir_all(&save_dir).unwrap();
    let mut existing = HashSet::new();
    existing.insert(normalize_path_key(&save_dir.to_string_lossy()));

    let candidates =
        suggest_save_path_candidates("星之终途", &root.to_string_lossy(), None, &existing);

    assert!(candidates
        .iter()
        .any(|item| item.path.ends_with("save") && item.already_added));
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn clear_dir_contents_removes_nested_files_but_keeps_root() {
    let root = std::env::temp_dir().join(format!("mikavn-save-clear-{}", Uuid::new_v4()));
    fs::create_dir_all(root.join("nested")).unwrap();
    fs::write(root.join("keep-root.txt"), "old").unwrap();
    fs::write(root.join("nested").join("old.dat"), "old").unwrap();

    let removed = clear_dir_contents(&root).unwrap();

    assert_eq!(removed, 2);
    assert!(root.is_dir());
    assert_eq!(fs::read_dir(&root).unwrap().count(), 0);
    let _ = fs::remove_dir_all(root);
}

#[test]
fn merge_restore_preserves_unrelated_current_files() {
    let root = std::env::temp_dir().join(format!("mikavn-save-merge-{}", Uuid::new_v4()));
    let backup = root.join("backup");
    let save = root.join("save");
    fs::create_dir_all(backup.join("nested")).unwrap();
    fs::create_dir_all(&save).unwrap();
    fs::write(backup.join("slot1.dat"), "backup").unwrap();
    fs::write(backup.join("nested").join("slot2.dat"), "backup nested").unwrap();
    fs::write(save.join("local-only.dat"), "current").unwrap();

    let report = restore_files_from_backup(&backup, &save, "merge").unwrap();

    assert_eq!(report.mode, "merge");
    assert_eq!(report.copied_files, 2);
    assert_eq!(report.removed_files, 0);
    assert_eq!(
        fs::read_to_string(save.join("slot1.dat")).unwrap(),
        "backup"
    );
    assert_eq!(
        fs::read_to_string(save.join("nested").join("slot2.dat")).unwrap(),
        "backup nested"
    );
    assert_eq!(
        fs::read_to_string(save.join("local-only.dat")).unwrap(),
        "current"
    );
    let _ = fs::remove_dir_all(root);
}

#[test]
fn mirror_restore_removes_unrelated_current_files() {
    let root = std::env::temp_dir().join(format!("mikavn-save-mirror-{}", Uuid::new_v4()));
    let backup = root.join("backup");
    let save = root.join("save");
    fs::create_dir_all(&backup).unwrap();
    fs::create_dir_all(save.join("old-nested")).unwrap();
    fs::write(backup.join("slot1.dat"), "backup").unwrap();
    fs::write(save.join("local-only.dat"), "current").unwrap();
    fs::write(save.join("old-nested").join("stale.dat"), "stale").unwrap();

    let report = restore_files_from_backup(&backup, &save, "mirror").unwrap();

    assert_eq!(report.mode, "mirror");
    assert_eq!(report.copied_files, 1);
    assert_eq!(report.removed_files, 2);
    assert_eq!(
        fs::read_to_string(save.join("slot1.dat")).unwrap(),
        "backup"
    );
    assert!(!save.join("local-only.dat").exists());
    assert!(!save.join("old-nested").exists());
    let _ = fs::remove_dir_all(root);
}

#[test]
fn restore_preview_reports_differences_without_modifying_files() {
    let root = std::env::temp_dir().join(format!("mikavn-save-preview-{}", Uuid::new_v4()));
    let backup = root.join("backup");
    let save = root.join("save");
    fs::create_dir_all(backup.join("nested")).unwrap();
    fs::create_dir_all(&save).unwrap();
    fs::write(backup.join("slot1.dat"), "backup").unwrap();
    fs::write(backup.join("nested").join("slot2.dat"), "backup nested").unwrap();
    fs::write(save.join("slot1.dat"), "current").unwrap();
    fs::write(save.join("local-only.dat"), "current only").unwrap();

    let merge = preview_restore_files(&backup, &save, "merge").unwrap();
    let mirror = preview_restore_files(&backup, &save, "mirror").unwrap();

    assert_eq!(merge.backup_file_count, 2);
    assert_eq!(merge.current_file_count, 2);
    assert_eq!(merge.new_files, 1);
    assert_eq!(merge.overwritten_files, 1);
    assert_eq!(merge.kept_files, 1);
    assert_eq!(merge.removed_files, 0);
    assert_eq!(mirror.removed_files, 2);
    assert_eq!(mirror.kept_files, 0);
    assert_eq!(
        fs::read_to_string(save.join("slot1.dat")).unwrap(),
        "current"
    );
    assert!(save.join("local-only.dat").exists());

    let _ = fs::remove_dir_all(root);
}

#[test]
fn restore_preview_log_lines_include_counts_samples_and_paths() {
    let preview = SaveRestorePreview {
        mode: "mirror".to_string(),
        backup_path: "D:\\Backups\\slot".to_string(),
        save_path: "D:\\Games\\VN\\save".to_string(),
        backup_file_count: 3,
        current_file_count: 2,
        new_files: 1,
        overwritten_files: 1,
        kept_files: 0,
        removed_files: 2,
        sample_new_files: vec!["new.dat".to_string()],
        sample_overwritten_files: vec!["slot1.dat".to_string()],
        sample_kept_files: Vec::new(),
        sample_removed_files: vec!["old.dat".to_string()],
    };

    let lines = restore_preview_log_lines(&preview, "D:\\Protection\\before-restore");

    assert!(lines.iter().any(|line| line.contains("存档恢复模式：镜像")));
    assert!(lines
        .iter()
        .any(|line| line.contains("新增 1，覆盖 1，保留 0，清理 2")));
    assert!(lines.iter().any(|line| line.contains("新增样例：new.dat")));
    assert!(lines
        .iter()
        .any(|line| line.contains("覆盖样例：slot1.dat")));
    assert!(lines.iter().any(|line| line.contains("清理样例：old.dat")));
    assert!(lines
        .iter()
        .any(|line| line.contains("保护备份：D:\\Protection\\before-restore")));
}

#[test]
fn restore_entry_creates_protection_backup_record_before_copying_files() {
    let root = std::env::temp_dir().join(format!("mikavn-save-protection-{}", Uuid::new_v4()));
    let app_root = root.join("app-data");
    let save = root.join("save");
    let backup_dir = root.join("backup");
    fs::create_dir_all(&save).unwrap();
    fs::create_dir_all(&backup_dir).unwrap();
    fs::write(save.join("slot.dat"), "current").unwrap();
    fs::write(backup_dir.join("slot.dat"), "backup").unwrap();

    let paths = AppPaths::from_root(app_root.clone()).unwrap();
    let db = Database::new_from_path(paths.database()).unwrap();
    let game = db
        .add_game(AddGameInput {
            title: "Protection VN".to_string(),
            install_path: root.join("game").to_string_lossy().to_string(),
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
        })
        .unwrap();
    let save_path = db
        .add_save_path(
            game.id.clone(),
            "main".to_string(),
            save.to_string_lossy().to_string(),
        )
        .unwrap();
    let backup = db
        .insert_save_backup(&SaveBackup {
            id: Uuid::new_v4().to_string(),
            game_id: game.id.clone(),
            save_path_id: save_path.id.clone(),
            label: "manual".to_string(),
            source_path: save_path.path.clone(),
            backup_path: backup_dir.to_string_lossy().to_string(),
            protection: false,
            created_at: Utc::now().to_rfc3339(),
        })
        .unwrap();

    let protection =
        restore_save_backup_with_paths(&paths, &db, &backup, &save_path, "merge").unwrap();

    assert!(protection.protection);
    assert_eq!(protection.label, "恢复前保护备份");
    assert_eq!(fs::read_to_string(save.join("slot.dat")).unwrap(), "backup");
    assert_eq!(
        fs::read_to_string(Path::new(&protection.backup_path).join("slot.dat")).unwrap(),
        "current"
    );
    let records = db.list_save_backups(game.id).unwrap();
    assert_eq!(records.len(), 2);
    assert!(records
        .iter()
        .any(|item| item.id == protection.id && item.protection));

    let _ = fs::remove_dir_all(root);
}
