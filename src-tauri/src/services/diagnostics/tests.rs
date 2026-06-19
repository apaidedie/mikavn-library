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
