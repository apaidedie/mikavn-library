use super::*;
use rusqlite::{params, Connection};
use uuid::Uuid;

#[test]
fn diagnostics_counts_missing_and_legacy_image_refs() {
    let root = std::env::temp_dir().join(format!("mikavn-diagnostics-{}", Uuid::new_v4()));
    let paths = AppPaths::from_root(root.join("app-data")).unwrap();

    let conn = Connection::open(paths.database()).unwrap();
    conn.execute_batch(
        r#"
            CREATE TABLE games (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              cover_image TEXT,
              banner_image TEXT,
              background_image TEXT
            );
            CREATE TABLE game_assets (
              id TEXT PRIMARY KEY,
              game_id TEXT NOT NULL,
              uri TEXT NOT NULL
            );
            INSERT INTO games (id, title, cover_image, banner_image, background_image)
            VALUES ('game', 'VN', 'https://example.com/cover.png', 'C:\Users\tester\cover.png', 'D:\Playnite\bg.jpg');
            INSERT INTO game_assets (id, game_id, uri) VALUES ('asset', 'game', 'E:\missing.png');
            "#,
    )
    .unwrap();

    let diagnostics = get_app_data_diagnostics_with_paths(&paths, "test".to_string()).unwrap();

    assert_eq!(diagnostics.database.game_count, 1);
    assert_eq!(diagnostics.database.asset_count, 1);
    assert_eq!(diagnostics.database.image_refs_count, 4);
    assert_eq!(diagnostics.database.c_drive_image_refs_count, 1);
    assert_eq!(diagnostics.database.playnite_image_refs_count, 1);
    assert_eq!(diagnostics.database.missing_image_refs_count, 3);
    assert!(!diagnostics.warnings.is_empty());
    let _ = fs::remove_dir_all(root);
}

#[test]
fn diagnostics_treats_app_data_playnite_image_cache_as_local() {
    let root = std::env::temp_dir().join(format!(
        "mikavn-diagnostics-local-playnite-{}",
        Uuid::new_v4()
    ));
    let paths = AppPaths::from_root(root.join("app-data")).unwrap();
    fs::create_dir_all(paths.images().join("Playnite/cache")).unwrap();
    let local_playnite_image = paths.images().join("Playnite/cache/cover.jpg");
    fs::write(&local_playnite_image, b"image").unwrap();

    let conn = Connection::open(paths.database()).unwrap();
    conn.execute_batch(
        r#"
            CREATE TABLE games (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              cover_image TEXT,
              banner_image TEXT,
              background_image TEXT
            );
            CREATE TABLE game_assets (
              id TEXT PRIMARY KEY,
              game_id TEXT NOT NULL,
              uri TEXT NOT NULL
            );
            "#,
    )
    .unwrap();
    conn.execute(
        "INSERT INTO games (id, title, cover_image, banner_image, background_image) VALUES ('game', 'VN', ?1, NULL, NULL)",
        params![local_playnite_image.to_string_lossy().to_string()],
    )
    .unwrap();

    let diagnostics = get_app_data_diagnostics_with_paths(&paths, "test".to_string()).unwrap();

    assert_eq!(diagnostics.database.image_refs_count, 1);
    assert_eq!(diagnostics.database.local_image_refs_count, 1);
    assert_eq!(diagnostics.database.missing_image_refs_count, 0);
    assert_eq!(diagnostics.database.playnite_image_refs_count, 0);
    assert!(!diagnostics
        .warnings
        .iter()
        .any(|warning| warning.contains("Playnite")));

    let audit = audit_image_references_with_paths(
        &paths,
        ImageReferenceAuditOptions {
            limit: Some(10),
            include_ok: Some(true),
            game_id: None,
        },
    )
    .unwrap();

    assert_eq!(audit.playnite_count, 0);
    assert!(!audit.items[0]
        .issues
        .iter()
        .any(|issue| issue == "playnite"));

    let _ = fs::remove_dir_all(root);
}

#[test]
fn diagnostics_warns_when_database_backup_set_needs_cleanup() {
    let root = std::env::temp_dir().join(format!(
        "mikavn-diagnostics-backup-growth-{}",
        Uuid::new_v4()
    ));
    let paths = AppPaths::from_root(root.join("app-data")).unwrap();
    let conn = Connection::open(paths.database()).unwrap();
    conn.execute_batch(
        r#"
            CREATE TABLE games (id TEXT PRIMARY KEY, title TEXT NOT NULL);
            CREATE TABLE game_assets (id TEXT PRIMARY KEY, game_id TEXT NOT NULL, uri TEXT NOT NULL);
            "#,
    )
    .unwrap();

    let backup_dir = paths.database_backups().join("metadata-repair");
    fs::create_dir_all(&backup_dir).unwrap();
    for index in 0..31 {
        fs::write(
            backup_dir.join(format!(
                "mikavn.before-metadata-repair-20260101-{:06}.db",
                index
            )),
            b"backup",
        )
        .unwrap();
    }

    let diagnostics = get_app_data_diagnostics_with_paths(&paths, "test".to_string()).unwrap();

    assert_eq!(diagnostics.database_backups.file_count, 31);
    assert!(diagnostics.warnings.iter().any(|warning| {
        warning.contains("数据库备份已有 31 个") && warning.contains("清理旧备份")
    }));

    let _ = fs::remove_dir_all(root);
}

use std::io::Read;
use zip::ZipArchive;

use crate::services::diagnostic_export::export_diagnostic_package_with_paths;

#[test]
fn startup_diagnostics_skips_deep_image_scans() {
    let root = std::env::temp_dir().join(format!(
        "mikavn-startup-diagnostics-lightweight-{}",
        Uuid::new_v4()
    ));
    let paths = AppPaths::from_root(root.join("app-data")).unwrap();
    fs::create_dir_all(paths.images().join("nested")).unwrap();
    fs::write(paths.images().join("nested").join("cover.jpg"), b"image").unwrap();

    let conn = Connection::open(paths.database()).unwrap();
    conn.execute_batch(
        r#"
            CREATE TABLE games (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              cover_image TEXT,
              path_status TEXT
            );
            CREATE TABLE game_assets (
              id TEXT PRIMARY KEY,
              game_id TEXT NOT NULL,
              uri TEXT NOT NULL
            );
            INSERT INTO games (id, title, cover_image, path_status)
            VALUES ('game', 'VN', 'E:\missing.png', 'ok');
            INSERT INTO game_assets (id, game_id, uri) VALUES ('asset', 'game', 'E:\missing-asset.png');
            "#,
    )
    .unwrap();

    let diagnostics =
        get_startup_app_data_diagnostics_with_paths(&paths, "test".to_string()).unwrap();

    assert_eq!(diagnostics.database.game_count, 1);
    assert_eq!(diagnostics.database.asset_count, 1);
    assert_eq!(diagnostics.database.quick_check.as_deref(), Some("ok"));
    assert_eq!(diagnostics.database.image_refs_count, 0);
    assert_eq!(diagnostics.database.missing_image_refs_count, 0);
    assert_eq!(diagnostics.images.file_count, 0);
    assert!(!diagnostics
        .warnings
        .iter()
        .any(|warning| warning.contains("图片引用")));

    let _ = fs::remove_dir_all(root);
}

fn zip_entry_names(path: &std::path::Path) -> Vec<String> {
    let file = std::fs::File::open(path).unwrap();
    let mut archive = ZipArchive::new(file).unwrap();
    let mut names = Vec::new();
    for index in 0..archive.len() {
        names.push(archive.by_index(index).unwrap().name().to_string());
    }
    names.sort();
    names
}

fn read_zip_entry(path: &std::path::Path, name: &str) -> String {
    let file = std::fs::File::open(path).unwrap();
    let mut archive = ZipArchive::new(file).unwrap();
    let mut entry = archive.by_name(name).unwrap();
    let mut content = String::new();
    entry.read_to_string(&mut content).unwrap();
    content
}

#[test]
fn diagnostic_export_includes_generated_files_only() {
    let root = std::env::temp_dir().join(format!("mikavn-diagnostic-export-{}", Uuid::new_v4()));
    let paths = AppPaths::from_root(root.join("app-data")).unwrap();
    fs::create_dir_all(paths.images()).unwrap();
    fs::create_dir_all(paths.save_backups().join("game-1")).unwrap();
    fs::write(paths.images().join("cover.jpg"), b"image").unwrap();
    fs::write(
        paths.save_backups().join("game-1").join("slot.dat"),
        b"save",
    )
    .unwrap();
    fs::write(paths.logs().join("mikavn.log"), "startup ok").unwrap();
    let conn = Connection::open(paths.database()).unwrap();
    conn.execute_batch(
        r#"
        PRAGMA user_version = 13;
        CREATE TABLE games (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          original_title TEXT,
          developer TEXT,
          publisher TEXT,
          release_date TEXT,
          description TEXT,
          tags TEXT,
          cover_image TEXT,
          banner_image TEXT,
          background_image TEXT,
          install_path TEXT,
          executable_path TEXT,
          play_status TEXT NOT NULL DEFAULT 'unplayed',
          rating INTEGER,
          notes TEXT,
          source TEXT,
          source_id TEXT,
          vndb_id TEXT,
          dlsite_id TEXT,
          fanza_id TEXT,
          favorite INTEGER NOT NULL DEFAULT 0,
          hidden INTEGER NOT NULL DEFAULT 0,
          path_status TEXT NOT NULL DEFAULT 'unknown',
          last_path_check_at TEXT,
          play_time_minutes INTEGER NOT NULL DEFAULT 0,
          last_played_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE game_assets (
          id TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          path TEXT NOT NULL,
          title TEXT,
          source_url TEXT,
          is_primary INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE metadata_sources (
          id TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          provider_id TEXT NOT NULL,
          url TEXT,
          fetched_at TEXT NOT NULL,
          raw_json TEXT NOT NULL
        );
        CREATE TABLE external_ids (
          id TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          provider_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        INSERT INTO games (id, title, cover_image, play_status, created_at, updated_at)
        VALUES ('game-1', 'Diagnostic VN', 'images/cover.jpg', 'unplayed', '2026-06-21T00:00:00Z', '2026-06-21T00:00:00Z');
        "#,
    )
    .unwrap();

    let report = export_diagnostic_package_with_paths(&paths, "test".to_string()).unwrap();
    let names = zip_entry_names(std::path::Path::new(&report.path));

    assert_eq!(
        names,
        vec![
            "diagnostics.json".to_string(),
            "environment.json".to_string(),
            "logs-preview.json".to_string(),
            "manifest.json".to_string(),
            "summary.md".to_string(),
        ]
    );
    assert!(!names.iter().any(|name| name.ends_with(".db")));
    assert!(!names.iter().any(|name| name.contains("cover.jpg")));
    assert!(!names.iter().any(|name| name.contains("slot.dat")));
    assert!(report.size_bytes > 0);
    assert!(report.path.contains("diagnostic-exports"));
    let _ = fs::remove_dir_all(root);
}

#[test]
fn diagnostic_export_redacts_log_preview() {
    let root = std::env::temp_dir().join(format!("mikavn-diagnostic-redact-{}", Uuid::new_v4()));
    let paths = AppPaths::from_root(root.join("app-data")).unwrap();
    let conn = Connection::open(paths.database()).unwrap();
    conn.execute_batch(
        r#"
        PRAGMA user_version = 13;
        CREATE TABLE games (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          play_status TEXT NOT NULL DEFAULT 'unplayed',
          favorite INTEGER NOT NULL DEFAULT 0,
          hidden INTEGER NOT NULL DEFAULT 0,
          path_status TEXT NOT NULL DEFAULT 'unknown',
          play_time_minutes INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE game_assets (
          id TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          path TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE metadata_sources (
          id TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          provider_id TEXT NOT NULL,
          fetched_at TEXT NOT NULL,
          raw_json TEXT NOT NULL
        );
        CREATE TABLE external_ids (
          id TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          provider_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        "#,
    )
    .unwrap();
    fs::write(
        paths.logs().join("mikavn.log"),
        r"API_KEY=secret password=hunter2 token:abc C:\Users\alice\AppData\Roaming\MikaVN\mikavn.db",
    )
    .unwrap();

    let report = export_diagnostic_package_with_paths(&paths, "test".to_string()).unwrap();
    let logs = read_zip_entry(std::path::Path::new(&report.path), "logs-preview.json");
    let diagnostics = read_zip_entry(std::path::Path::new(&report.path), "diagnostics.json");

    assert!(logs.contains("[redacted]"));
    assert!(!logs.contains("secret"));
    assert!(!logs.contains("hunter2"));
    assert!(!logs.contains("token:abc"));
    assert!(!logs.contains("alice"));
    assert!(!diagnostics.contains("alice"));
    let _ = fs::remove_dir_all(root);
}

#[test]
fn diagnostic_export_summary_reports_core_counts() {
    let root = std::env::temp_dir().join(format!("mikavn-diagnostic-summary-{}", Uuid::new_v4()));
    let paths = AppPaths::from_root(root.join("app-data")).unwrap();
    let conn = Connection::open(paths.database()).unwrap();
    conn.execute_batch(
        r#"
        PRAGMA user_version = 13;
        CREATE TABLE games (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          play_status TEXT NOT NULL DEFAULT 'unplayed',
          favorite INTEGER NOT NULL DEFAULT 0,
          hidden INTEGER NOT NULL DEFAULT 0,
          path_status TEXT NOT NULL DEFAULT 'unknown',
          play_time_minutes INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE game_assets (
          id TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          path TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE metadata_sources (
          id TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          provider_id TEXT NOT NULL,
          fetched_at TEXT NOT NULL,
          raw_json TEXT NOT NULL
        );
        CREATE TABLE external_ids (
          id TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          provider_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        INSERT INTO games (id, title, created_at, updated_at)
        VALUES ('game-1', 'Diagnostic VN', '2026-06-21T00:00:00Z', '2026-06-21T00:00:00Z');
        "#,
    )
    .unwrap();

    let report = export_diagnostic_package_with_paths(&paths, "test".to_string()).unwrap();
    let summary = read_zip_entry(std::path::Path::new(&report.path), "summary.md");

    assert!(summary.contains("quick_check"));
    assert!(summary.contains("应用版本：test"));
    assert!(summary.contains("ok"));
    assert!(summary.contains("游戏数量：1"));
    assert!(summary.contains("图片文件"));
    assert!(summary.contains("警告数量"));
    let _ = fs::remove_dir_all(root);
}

#[test]
fn diagnostic_export_summary_lists_warning_samples() {
    let root = std::env::temp_dir().join(format!(
        "mikavn-diagnostic-warning-summary-{}",
        Uuid::new_v4()
    ));
    let paths = AppPaths::from_root(root.join("app-data")).unwrap();
    let missing_cover = paths.images().join("missing-cover.jpg");
    let conn = Connection::open(paths.database()).unwrap();
    conn.execute_batch(
        r#"
        PRAGMA user_version = 13;
        CREATE TABLE games (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          cover_image TEXT,
          play_status TEXT NOT NULL DEFAULT 'unplayed',
          favorite INTEGER NOT NULL DEFAULT 0,
          hidden INTEGER NOT NULL DEFAULT 0,
          path_status TEXT NOT NULL DEFAULT 'unknown',
          play_time_minutes INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE game_assets (
          id TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          path TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE metadata_sources (
          id TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          provider_id TEXT NOT NULL,
          fetched_at TEXT NOT NULL,
          raw_json TEXT NOT NULL
        );
        CREATE TABLE external_ids (
          id TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          provider_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        "#,
    )
    .unwrap();
    conn.execute(
        "INSERT INTO games (id, title, cover_image, created_at, updated_at) VALUES ('game-1', 'Missing Cover VN', ?1, '2026-06-21T00:00:00Z', '2026-06-21T00:00:00Z')",
        [missing_cover.to_string_lossy().to_string()],
    )
    .unwrap();

    let report = export_diagnostic_package_with_paths(&paths, "test".to_string()).unwrap();
    let summary = read_zip_entry(std::path::Path::new(&report.path), "summary.md");

    assert!(summary.contains("## 警告摘要"));
    assert!(summary.contains("- 有 1 条本地图片引用找不到文件。"));
    let _ = fs::remove_dir_all(root);
}

#[test]
fn diagnostics_counts_maintenance_metrics() {
    let root = std::env::temp_dir().join(format!("mikavn-diagnostics-{}", Uuid::new_v4()));
    let paths = AppPaths::from_root(root.join("app-data")).unwrap();
    fs::create_dir_all(paths.images()).unwrap();
    let description_image = paths.images().join("desc.webp");
    fs::write(&description_image, b"image").unwrap();
    let description_image = description_image.to_string_lossy().to_string();

    let conn = Connection::open(paths.database()).unwrap();
    conn.execute_batch(
        r#"
            CREATE TABLE games (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              description TEXT,
              release_date TEXT,
              developer TEXT,
              brand TEXT,
              cover_image TEXT,
              banner_image TEXT,
              background_image TEXT,
              vndb_id TEXT,
              bangumi_id TEXT,
              dlsite_id TEXT,
              fanza_id TEXT,
              ymgal_id TEXT,
              path_status TEXT
            );
            "#,
    )
    .unwrap();
    conn.execute(
        r#"
            INSERT INTO games (id, title, description, release_date, developer, cover_image, dlsite_id, path_status)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            "#,
        params![
            "g1",
            "Image VN",
            format!("Story ![scene]({description_image})"),
            "2026-01-01",
            "Studio",
            "https://example.com/cover.jpg",
            "RJ01000000",
            "ok"
        ],
    )
    .unwrap();
    conn.execute(
        r#"
            INSERT INTO games (id, title, description, release_date, developer, cover_image, dlsite_id, path_status)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            "#,
        params![
            "g2",
            "Plain VN",
            "Plain description",
            "2026-01-02",
            "Studio",
            "https://example.com/plain.jpg",
            "RJ01000000",
            "broken"
        ],
    )
    .unwrap();
    conn.execute(
        r#"
            INSERT INTO games (id, title, description, release_date, developer, cover_image, fanza_id, path_status)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            "#,
        params![
            "g3",
            "Empty VN",
            "",
            "",
            "",
            Option::<String>::None,
            "abc_1234",
            "incomplete"
        ],
    )
    .unwrap();
    conn.execute(
        r#"
            INSERT INTO games (id, title, description, release_date, brand, cover_image, bangumi_id, path_status)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            "#,
        params![
            "g4",
            "Bangumi VN",
            "Bangumi-only metadata",
            "2026-01-04",
            "Studio",
            "https://example.com/bangumi.jpg",
            "bgm-29443",
            "unknown"
        ],
    )
    .unwrap();
    conn.execute(
        r#"
            INSERT INTO games (id, title, description, release_date, developer, cover_image, ymgal_id)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            "#,
        params![
            "g5",
            "YMGal VN",
            "YMGal-only metadata",
            "2026-01-05",
            "Studio",
            "https://example.com/ymgal.jpg",
            "ymgal-29443"
        ],
    )
    .unwrap();

    let diagnostics = get_app_data_diagnostics_with_paths(&paths, "test".to_string()).unwrap();

    assert_eq!(
        diagnostics.database.metadata_coverage.complete_game_count,
        4
    );
    assert_eq!(
        diagnostics.database.metadata_coverage.needs_metadata_count,
        1
    );
    assert_eq!(
        diagnostics.database.metadata_coverage.missing_cover_count,
        1
    );
    assert_eq!(
        diagnostics
            .database
            .metadata_coverage
            .missing_description_count,
        1
    );
    assert_eq!(
        diagnostics
            .database
            .metadata_coverage
            .provider_linked_game_count,
        5
    );
    assert_eq!(diagnostics.database.metadata_coverage.dlsite_game_count, 2);
    assert_eq!(diagnostics.database.metadata_coverage.fanza_game_count, 1);
    assert_eq!(
        diagnostics.database.description_images.provider_games_count,
        3
    );
    assert_eq!(
        diagnostics
            .database
            .description_images
            .provider_games_with_images_count,
        1
    );
    assert_eq!(
        diagnostics
            .database
            .description_images
            .provider_games_without_images_count,
        1
    );
    assert_eq!(
        diagnostics
            .database
            .description_images
            .provider_games_empty_description_count,
        1
    );
    assert_eq!(diagnostics.database.description_images.image_refs_count, 1);
    assert_eq!(
        diagnostics
            .database
            .description_images
            .local_image_refs_count,
        1
    );
    assert_eq!(
        diagnostics
            .database
            .description_images
            .missing_local_image_refs_count,
        0
    );
    assert_eq!(
        diagnostics
            .database
            .external_ids
            .duplicate_external_id_groups_count,
        1
    );
    assert_eq!(
        diagnostics
            .database
            .external_ids
            .duplicate_external_id_games_count,
        2
    );
    assert_eq!(
        diagnostics
            .database
            .external_ids
            .duplicate_dlsite_id_groups_count,
        1
    );
    assert_eq!(diagnostics.database.path_status.ok_count, 1);
    assert_eq!(diagnostics.database.path_status.broken_count, 1);
    assert_eq!(diagnostics.database.path_status.incomplete_count, 1);
    assert!(diagnostics
        .warnings
        .iter()
        .any(|warning| warning.contains("重复外部 ID")));
    assert!(diagnostics
        .warnings
        .iter()
        .any(|warning| warning.contains("简介图片")));
    let _ = fs::remove_dir_all(root);
}

#[test]
fn image_reference_audit_reports_specific_sources_and_resolved_paths() {
    let root = std::env::temp_dir().join(format!("mikavn-image-audit-{}", Uuid::new_v4()));
    let paths = AppPaths::from_root(root.join("app-data")).unwrap();
    fs::create_dir_all(paths.images()).unwrap();
    let relative_image = paths.images().join("relative.webp");
    fs::write(&relative_image, b"image").unwrap();

    let conn = Connection::open(paths.database()).unwrap();
    conn.execute_batch(
        r#"
            CREATE TABLE games (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              description TEXT,
              cover_image TEXT,
              banner_image TEXT,
              background_image TEXT
            );
            CREATE TABLE game_assets (
              id TEXT PRIMARY KEY,
              game_id TEXT NOT NULL,
              asset_type TEXT,
              uri TEXT NOT NULL
            );
            INSERT INTO games (id, title, description, cover_image, banner_image, background_image)
            VALUES (
              'game',
              'Audit VN',
              'Intro ![relative](images/relative.webp)',
              'missing-cover.webp',
              'D:\Playnite\banner.jpg',
              'https://example.com/background.jpg'
            );
            INSERT INTO games (id, title, description, cover_image, banner_image, background_image)
            VALUES ('other', 'Other VN', NULL, 'other-missing.webp', NULL, NULL);
            INSERT INTO game_assets (id, game_id, asset_type, uri)
            VALUES ('asset', 'game', 'cover', 'C:\Users\tester\old-cover.jpg');
            "#,
    )
    .unwrap();

    let audit = audit_image_references_with_paths(
        &paths,
        ImageReferenceAuditOptions {
            limit: Some(10),
            include_ok: Some(true),
            game_id: None,
        },
    )
    .unwrap();

    assert_eq!(audit.total_refs, 6);
    assert_eq!(audit.local_count, 5);
    assert_eq!(audit.remote_count, 1);
    assert_eq!(audit.missing_count, 4);
    assert_eq!(audit.c_drive_count, 1);
    assert_eq!(audit.playnite_count, 1);
    assert_eq!(audit.issue_count, 4);
    assert!(!audit.truncated);

    let scoped_audit = audit_image_references_with_paths(
        &paths,
        ImageReferenceAuditOptions {
            limit: Some(10),
            include_ok: Some(true),
            game_id: Some("game".to_string()),
        },
    )
    .unwrap();
    assert_eq!(scoped_audit.total_refs, 5);
    assert_eq!(scoped_audit.missing_count, 3);
    assert!(scoped_audit
        .items
        .iter()
        .all(|item| item.game_id.as_deref() == Some("game")));

    let relative = audit
        .items
        .iter()
        .find(|item| item.value == "images/relative.webp")
        .unwrap();
    assert_eq!(relative.status, "ok");
    assert_eq!(relative.source_kind, "description");
    let relative_image_text = relative_image.to_string_lossy().to_string();
    assert_eq!(
        relative.resolved_path.as_deref(),
        Some(relative_image_text.as_str())
    );

    let cover = audit
        .items
        .iter()
        .find(|item| item.field_name.as_deref() == Some("cover_image"))
        .unwrap();
    assert_eq!(cover.game_title.as_deref(), Some("Audit VN"));
    assert!(cover.issues.iter().any(|issue| issue == "missing"));

    let playnite = audit
        .items
        .iter()
        .find(|item| item.value.contains("Playnite"))
        .unwrap();
    assert!(playnite.issues.iter().any(|issue| issue == "playnite"));
    assert!(playnite.issues.iter().any(|issue| issue == "missing"));

    let c_drive = audit
        .items
        .iter()
        .find(|item| item.value.starts_with("C:\\"))
        .unwrap();
    assert_eq!(c_drive.source_kind, "game_asset");
    assert!(c_drive.issues.iter().any(|issue| issue == "c_drive"));

    let _ = fs::remove_dir_all(root);
}
