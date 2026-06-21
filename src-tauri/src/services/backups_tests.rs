use super::*;
use uuid::Uuid;

#[test]
fn pending_restore_replaces_database_after_protection_backup() {
    let root = std::env::temp_dir().join(format!("mikavn-restore-test-{}", Uuid::new_v4()));
    let paths = AppPaths::from_root(root.clone()).unwrap();
    create_mikavn_db(&paths.database(), "current");
    let source = root.join("backup.db");
    create_mikavn_db(&source, "restored");

    let report = schedule_pending_restore(&paths, &source).unwrap();
    assert!(report.pending_path.is_file());
    assert_eq!(report.source_size_bytes, report.pending_size_bytes);
    apply_pending_database_restore(&paths).unwrap();

    assert_eq!(database_marker(&paths.database()), "restored");
    assert!(!report.pending_path.exists());
    assert_eq!(
        fs::read_dir(paths.database_restore_protection())
            .unwrap()
            .count(),
        1
    );
    let _ = fs::remove_dir_all(root);
}

#[test]
fn schedule_restore_rejects_non_mikavn_sqlite_database() {
    let root = std::env::temp_dir().join(format!("mikavn-restore-test-{}", Uuid::new_v4()));
    let paths = AppPaths::from_root(root.clone()).unwrap();
    let source = root.join("foreign.db");
    Connection::open(&source)
        .unwrap()
        .execute_batch("CREATE TABLE other_app (id TEXT PRIMARY KEY);")
        .unwrap();

    let error = schedule_pending_restore(&paths, &source).unwrap_err();

    assert_eq!(error.code, "BACKUP_FAILED");
    assert!(error.message.contains("MikaVN"));
    assert!(!paths.database_restore_pending().join("mikavn.db").exists());
    let _ = fs::remove_dir_all(root);
}

#[test]
fn pending_restore_rejects_invalid_file_without_replacing_database() {
    let root = std::env::temp_dir().join(format!("mikavn-restore-test-{}", Uuid::new_v4()));
    let paths = AppPaths::from_root(root.clone()).unwrap();
    create_mikavn_db(&paths.database(), "current");
    let pending = paths.database_restore_pending().join("mikavn.db");
    fs::write(&pending, b"not sqlite").unwrap();

    apply_pending_database_restore(&paths).unwrap();

    assert_eq!(database_marker(&paths.database()), "current");
    assert!(!pending.exists());
    assert_eq!(
        fs::read_dir(paths.database_restore_pending())
            .unwrap()
            .filter(|entry| entry
                .as_ref()
                .unwrap()
                .file_name()
                .to_string_lossy()
                .starts_with("rejected-"))
            .count(),
        1
    );
    let _ = fs::remove_dir_all(root);
}

#[test]
fn cleanup_old_database_backups_removes_only_safe_old_backups() {
    let root = std::env::temp_dir().join(format!("mikavn-backup-cleanup-test-{}", Uuid::new_v4()));
    let paths = AppPaths::from_root(root.clone()).unwrap();
    create_mikavn_db(&paths.database(), "current");

    let old_backup = paths
        .root()
        .join("mikavn.before-playnite-import-20260101-000000.db");
    let newest_backup = paths
        .root()
        .join("mikavn.before-playnite-import-20260102-000000.db");
    let unrelated = paths.root().join("manual-copy.db");
    fs::write(&old_backup, b"old").unwrap();
    std::thread::sleep(std::time::Duration::from_millis(20));
    fs::write(&newest_backup, b"new").unwrap();
    fs::write(&unrelated, b"manual").unwrap();

    let report = cleanup_old_database_backups_with_paths(
        &paths,
        DatabaseBackupCleanupPolicy {
            retain_count: Some(1),
            retain_days: None,
        },
    )
    .unwrap();

    assert_eq!(report.scanned_files, 2);
    assert_eq!(report.removed_files, 1);
    assert!(!old_backup.exists());
    assert!(newest_backup.exists());
    assert!(unrelated.exists());
    assert!(paths.database().exists());
    let _ = fs::remove_dir_all(root);
}

#[test]
fn database_backup_summary_includes_restore_protection_backups() {
    let root = std::env::temp_dir().join(format!("mikavn-backup-summary-test-{}", Uuid::new_v4()));
    let paths = AppPaths::from_root(root.clone()).unwrap();
    let import_backup = paths
        .archive_import_protection()
        .join("before-import-20260101-000000.db");
    let restore_backup = paths
        .database_restore_protection()
        .join("before-restore-20260101-000000.db");
    fs::create_dir_all(paths.archive_import_protection()).unwrap();
    fs::create_dir_all(paths.database_restore_protection()).unwrap();
    fs::write(&import_backup, b"import").unwrap();
    fs::write(&restore_backup, b"restore").unwrap();

    let summary = database_backup_summary(&paths).unwrap();

    assert_eq!(summary.file_count, 2);
    assert!(summary
        .files
        .iter()
        .any(|file| file.file_name == "before-import-20260101-000000.db"));
    assert!(summary
        .files
        .iter()
        .any(|file| file.file_name == "before-restore-20260101-000000.db"));
    let _ = fs::remove_dir_all(root);
}

#[test]
fn update_protection_backup_creates_verified_database_copy() {
    let root = std::env::temp_dir().join(format!("mikavn-update-backup-test-{}", Uuid::new_v4()));
    let paths = AppPaths::from_root(root.clone()).unwrap();
    create_mikavn_db(&paths.database(), "current");

    let report = create_update_protection_backup_with_paths(&paths).unwrap();

    assert_eq!(report.quick_check, "ok");
    assert!(report.file_name.starts_with("before-update-"));
    assert!(report.file_name.ends_with(".db"));
    assert!(report.path.contains("update-protection"));
    assert!(Path::new(&report.path).is_file());
    assert!(report.size_bytes > 0);
    assert_eq!(database_marker(Path::new(&report.path)), "current");
    let _ = fs::remove_dir_all(root);
}

#[test]
fn update_protection_backup_is_listed_and_cleanup_safe() {
    let root = std::env::temp_dir().join(format!(
        "mikavn-update-backup-summary-test-{}",
        Uuid::new_v4()
    ));
    let paths = AppPaths::from_root(root.clone()).unwrap();
    create_mikavn_db(&paths.database(), "current");
    let old_backup = paths
        .database_backups()
        .join("update-protection")
        .join("before-update-20260101-000000.db");
    let newest_backup = paths
        .database_backups()
        .join("update-protection")
        .join("before-update-20260102-000000.db");
    fs::create_dir_all(old_backup.parent().unwrap()).unwrap();
    fs::write(&old_backup, b"old").unwrap();
    std::thread::sleep(std::time::Duration::from_millis(20));
    fs::write(&newest_backup, b"new").unwrap();

    let summary = database_backup_summary(&paths).unwrap();
    assert_eq!(summary.file_count, 2);
    assert!(summary
        .files
        .iter()
        .any(|file| file.file_name == "before-update-20260101-000000.db"));

    let report = cleanup_old_database_backups_with_paths(
        &paths,
        DatabaseBackupCleanupPolicy {
            retain_count: Some(1),
            retain_days: None,
        },
    )
    .unwrap();

    assert_eq!(report.scanned_files, 2);
    assert_eq!(report.removed_files, 1);
    assert!(!old_backup.exists());
    assert!(newest_backup.exists());
    assert!(paths.database().exists());
    let _ = fs::remove_dir_all(root);
}

#[test]
fn legacy_update_protection_backups_are_listed_and_cleanup_safe() {
    let root = std::env::temp_dir().join(format!(
        "mikavn-legacy-update-backup-summary-test-{}",
        Uuid::new_v4()
    ));
    let paths = AppPaths::from_root(root.clone()).unwrap();
    create_mikavn_db(&paths.database(), "current");
    let legacy_dir = paths.root().join("database-update-protection");
    let old_backup = legacy_dir.join("before-manual-install-20260101-000000.db");
    let newest_backup = legacy_dir.join("before-017-manual-install-20260102-000000.db");
    let unrelated = legacy_dir.join("manual-copy.db");
    fs::create_dir_all(&legacy_dir).unwrap();
    fs::write(&old_backup, b"old").unwrap();
    std::thread::sleep(std::time::Duration::from_millis(20));
    fs::write(&newest_backup, b"new").unwrap();
    fs::write(&unrelated, b"manual").unwrap();

    let summary = database_backup_summary(&paths).unwrap();
    assert_eq!(summary.file_count, 2);
    assert!(summary
        .files
        .iter()
        .any(|file| file.file_name == "before-manual-install-20260101-000000.db"));
    assert!(summary
        .files
        .iter()
        .any(|file| file.file_name == "before-017-manual-install-20260102-000000.db"));

    let report = cleanup_old_database_backups_with_paths(
        &paths,
        DatabaseBackupCleanupPolicy {
            retain_count: Some(1),
            retain_days: None,
        },
    )
    .unwrap();

    assert_eq!(report.scanned_files, 2);
    assert_eq!(report.removed_files, 1);
    assert!(!old_backup.exists());
    assert!(newest_backup.exists());
    assert!(unrelated.exists());
    assert!(paths.database().exists());
    let _ = fs::remove_dir_all(root);
}

#[test]
fn startup_automatic_backup_creates_when_no_recent_backup_exists() {
    let root = std::env::temp_dir().join(format!(
        "mikavn-startup-auto-backup-test-{}",
        Uuid::new_v4()
    ));
    let paths = AppPaths::from_root(root.clone()).unwrap();
    create_mikavn_db(&paths.database(), "current");

    let report = create_startup_automatic_backup_if_needed_with_paths(&paths).unwrap();

    let report = report.expect("startup auto backup should be created");
    assert_eq!(report.quick_check, "ok");
    assert!(report.file_name.starts_with("startup-auto-"));
    assert!(report.file_name.ends_with(".db"));
    assert!(report.path.contains("database-backups"));
    assert!(report.path.contains("auto"));
    assert!(Path::new(&report.path).is_file());
    assert_eq!(database_marker(Path::new(&report.path)), "current");

    let summary = database_backup_summary(&paths).unwrap();
    assert_eq!(summary.file_count, 1);
    assert_eq!(summary.files[0].file_name, report.file_name);
    let _ = fs::remove_dir_all(root);
}

#[test]
fn startup_automatic_backup_skips_when_recent_backup_exists() {
    let root = std::env::temp_dir().join(format!(
        "mikavn-startup-auto-backup-skip-test-{}",
        Uuid::new_v4()
    ));
    let paths = AppPaths::from_root(root.clone()).unwrap();
    create_mikavn_db(&paths.database(), "current");

    let first = create_startup_automatic_backup_if_needed_with_paths(&paths).unwrap();
    let second = create_startup_automatic_backup_if_needed_with_paths(&paths).unwrap();

    assert!(first.is_some());
    assert!(second.is_none());
    let summary = database_backup_summary(&paths).unwrap();
    assert_eq!(summary.file_count, 1);
    let _ = fs::remove_dir_all(root);
}

#[test]
fn database_backup_report_log_describes_target_and_size() {
    let message = database_backup_report_log("D:\\MikaVN-Backups\\manual.db", 131072, "ok");

    assert_eq!(
        message,
        "数据库备份报告：目标 D:\\MikaVN-Backups\\manual.db，大小 131072 bytes，quick_check ok。"
    );
}

#[test]
fn manual_database_backup_creates_verified_database_copy() {
    let root = std::env::temp_dir().join(format!("mikavn-manual-backup-test-{}", Uuid::new_v4()));
    let paths = AppPaths::from_root(root.clone()).unwrap();
    create_mikavn_db(&paths.database(), "current");
    let target = paths.database_backups().join("manual").join("manual.db");

    let report = create_verified_database_backup_with_paths(&paths, &target).unwrap();

    assert_eq!(report.quick_check, "ok");
    assert_eq!(report.target_path, target);
    assert_eq!(
        report.size_bytes,
        fs::metadata(&report.target_path).unwrap().len()
    );
    assert_eq!(database_marker(&report.target_path), "current");
    let _ = fs::remove_dir_all(root);
}

fn create_mikavn_db(path: &Path, title: &str) {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    let conn = Connection::open(path).unwrap();
    conn.execute_batch(
        r#"
            CREATE TABLE games (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              install_path TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
            CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            "#,
    )
    .unwrap();
    conn.execute(
        "INSERT INTO games (id, title, install_path, created_at, updated_at) VALUES ('game', ?1, 'D:\\Game', 'now', 'now')",
        [title],
    )
    .unwrap();
}

fn database_marker(path: &Path) -> String {
    Connection::open(path)
        .unwrap()
        .query_row("SELECT title FROM games WHERE id = 'game'", [], |row| {
            row.get(0)
        })
        .unwrap()
}
