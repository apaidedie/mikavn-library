use super::*;
use crate::infrastructure::paths::AppPaths;
use rusqlite::Connection;
use std::fs;
use std::path::Path;
use uuid::Uuid;

#[test]
fn image_health_report_counts_reference_and_cache_issues() {
    let root = std::env::temp_dir().join(format!("mikavn-image-health-{}", Uuid::new_v4()));
    let paths = AppPaths::from_root(root.clone()).unwrap();
    fs::create_dir_all(paths.images().join("playnite-import/game")).unwrap();
    fs::create_dir_all(paths.images().join("dupes/a")).unwrap();
    fs::create_dir_all(paths.images().join("dupes/b")).unwrap();
    fs::create_dir_all(paths.images().join("content-dupes")).unwrap();

    let cover = paths.images().join("cover.jpg");
    let legacy = paths.images().join("playnite-import/game/cover.jpg");
    let orphan = paths.images().join("orphan.webp");
    let duplicate_a = paths.images().join("dupes/a/same.png");
    let duplicate_b = paths.images().join("dupes/b/same.png");
    let content_duplicate_a = paths.images().join("content-dupes/alpha.jpg");
    let content_duplicate_b = paths.images().join("content-dupes/beta.webp");
    let oversized = paths.images().join("large.jpg");
    fs::write(&cover, b"\xFF\xD8\xFFcover").unwrap();
    fs::write(&legacy, b"\xFF\xD8\xFFlegacy").unwrap();
    fs::write(&orphan, b"orphan").unwrap();
    fs::write(&duplicate_a, b"a").unwrap();
    fs::write(&duplicate_b, b"b").unwrap();
    fs::write(&content_duplicate_a, b"\xFF\xD8\xFFsame-content").unwrap();
    fs::write(&content_duplicate_b, b"\xFF\xD8\xFFsame-content").unwrap();
    fs::write(&oversized, vec![1u8; 6 * 1024 * 1024]).unwrap();

    create_health_db(
        &paths.database(),
        &cover.to_string_lossy(),
        &legacy.to_string_lossy(),
        "C:\\old\\missing.jpg",
    );

    let report =
        get_image_health_report_with_paths(&paths, ImageHealthReportOptions::default()).unwrap();

    assert_eq!(report.summary.total_image_refs, 3);
    assert_eq!(report.summary.missing_local_refs, 1);
    assert_eq!(report.summary.c_drive_refs, 1);
    assert_eq!(report.summary.playnite_refs, 1);
    assert_eq!(report.summary.legacy_app_data_import_refs, 1);
    assert_eq!(report.summary.issue_image_refs, 1);
    assert_eq!(report.cache.file_count, 8);
    assert_eq!(report.cache.orphan_file_count, 6);
    assert_eq!(report.cache.duplicate_file_name_groups, 1);
    assert_eq!(report.summary.duplicate_content_groups, 1);
    assert_eq!(report.cache.duplicate_content_groups, 1);
    assert!(report
        .cache
        .duplicate_content_samples
        .iter()
        .any(|group| group
            .samples
            .iter()
            .any(|sample| sample.ends_with("content-dupes\\alpha.jpg")
                || sample.ends_with("content-dupes/alpha.jpg"))));
    assert_eq!(report.cache.oversized_file_count, 1);
    assert!(report
        .cache
        .orphan_samples
        .iter()
        .any(|item| item.path.ends_with("orphan.webp")));
    assert!(report
        .recommendations
        .iter()
        .any(|item| item.contains("重复内容")));
    assert!(report
        .recommendations
        .iter()
        .any(|item| item.contains("过大图片")));

    let _ = fs::remove_dir_all(root);
}

#[test]
fn quarantine_orphan_images_moves_only_unreferenced_files() {
    let root = std::env::temp_dir().join(format!("mikavn-image-quarantine-{}", Uuid::new_v4()));
    let paths = AppPaths::from_root(root.clone()).unwrap();
    fs::create_dir_all(paths.images()).unwrap();
    let referenced = paths.images().join("cover.jpg");
    let orphan = paths.images().join("stale/orphan.jpg");
    fs::create_dir_all(orphan.parent().unwrap()).unwrap();
    fs::write(&referenced, b"cover").unwrap();
    fs::write(&orphan, b"orphan").unwrap();
    create_health_db(&paths.database(), &referenced.to_string_lossy(), "", "");

    let report =
        quarantine_orphan_images_with_paths(&paths, ImageHealthReportOptions::default()).unwrap();

    assert_eq!(report.moved_files, 1);
    assert_eq!(report.skipped_files, 0);
    assert!(referenced.is_file());
    assert!(!orphan.exists());
    assert!(Path::new(&report.manifest_path).is_file());
    assert!(report.quarantine_dir.contains("image-quarantine"));
    let manifest = fs::read_to_string(&report.manifest_path).unwrap();
    assert!(manifest.contains("stale"));
    assert!(manifest.contains("orphan.jpg"));

    let _ = fs::remove_dir_all(root);
}

#[test]
fn quarantine_duplicate_content_images_keeps_referenced_and_one_unreferenced_copy() {
    let root = std::env::temp_dir().join(format!(
        "mikavn-image-duplicate-content-quarantine-{}",
        Uuid::new_v4()
    ));
    let paths = AppPaths::from_root(root.clone()).unwrap();
    fs::create_dir_all(paths.images().join("referenced")).unwrap();
    fs::create_dir_all(paths.images().join("orphaned")).unwrap();

    let referenced = paths.images().join("referenced/cover.jpg");
    let unreferenced_duplicate = paths.images().join("referenced/cover-copy.webp");
    let unreferenced_kept = paths.images().join("orphaned/a.jpg");
    let unreferenced_moved = paths.images().join("orphaned/b.webp");
    fs::write(&referenced, b"\xFF\xD8\xFFsame-referenced").unwrap();
    fs::write(&unreferenced_duplicate, b"\xFF\xD8\xFFsame-referenced").unwrap();
    fs::write(&unreferenced_kept, b"\xFF\xD8\xFFsame-orphaned").unwrap();
    fs::write(&unreferenced_moved, b"\xFF\xD8\xFFsame-orphaned").unwrap();
    create_health_db(&paths.database(), &referenced.to_string_lossy(), "", "");

    let report =
        quarantine_duplicate_content_images_with_paths(&paths, ImageHealthReportOptions::default())
            .unwrap();

    assert_eq!(report.moved_files, 2);
    assert_eq!(report.skipped_files, 0);
    assert!(referenced.is_file());
    assert!(!unreferenced_duplicate.exists());
    assert!(unreferenced_kept.is_file());
    assert!(!unreferenced_moved.exists());
    let manifest = fs::read_to_string(&report.manifest_path).unwrap();
    assert!(manifest.contains("duplicate content image cache file"));
    assert!(manifest.contains("cover-copy.webp"));
    assert!(manifest.contains("b.webp"));

    let _ = fs::remove_dir_all(root);
}

#[test]
fn image_health_report_counts_invalid_image_cache_files() {
    let root = std::env::temp_dir().join(format!("mikavn-image-invalid-{}", Uuid::new_v4()));
    let paths = AppPaths::from_root(root.clone()).unwrap();
    fs::create_dir_all(paths.images()).unwrap();
    let invalid = paths.images().join("empty.jpg");
    fs::write(&invalid, b"").unwrap();
    create_health_db(&paths.database(), &invalid.to_string_lossy(), "", "");

    let report =
        get_image_health_report_with_paths(&paths, ImageHealthReportOptions::default()).unwrap();

    assert_eq!(report.summary.invalid_image_files, 1);
    assert_eq!(report.summary.invalid_image_refs, 1);
    assert_eq!(report.summary.issue_image_refs, 1);
    assert_eq!(report.cache.invalid_image_file_count, 1);
    assert_eq!(report.cache.invalid_referenced_file_count, 1);
    assert_eq!(report.cache.invalid_image_bytes, 0);
    assert_eq!(report.cache.orphan_file_count, 0);
    assert!(report
        .cache
        .invalid_image_samples
        .iter()
        .any(|item| item.relative_path.ends_with("empty.jpg")));
    let sample = report.cache.invalid_image_samples.first().unwrap();
    assert_eq!(sample.reference_samples.len(), 1);
    assert_eq!(sample.reference_samples[0].game_id.as_deref(), Some("g1"));
    assert_eq!(
        sample.reference_samples[0].game_title.as_deref(),
        Some("VN")
    );
    assert_eq!(
        sample.reference_samples[0].field_name.as_deref(),
        Some("cover_image")
    );

    let _ = fs::remove_dir_all(root);
}

#[test]
fn image_health_report_counts_content_type_mismatches_separately() {
    let root = std::env::temp_dir().join(format!("mikavn-image-mismatch-{}", Uuid::new_v4()));
    let paths = AppPaths::from_root(root.clone()).unwrap();
    fs::create_dir_all(paths.images()).unwrap();
    let mislabeled = paths.images().join("cover.jpg");
    fs::write(&mislabeled, b"\x89PNG\r\n\x1A\npng-body").unwrap();
    create_health_db(&paths.database(), &mislabeled.to_string_lossy(), "", "");

    let report =
        get_image_health_report_with_paths(&paths, ImageHealthReportOptions::default()).unwrap();

    assert_eq!(report.summary.invalid_image_files, 0);
    assert_eq!(report.summary.invalid_image_refs, 0);
    assert_eq!(report.summary.content_type_mismatch_files, 1);
    assert_eq!(report.summary.content_type_mismatch_refs, 1);
    assert_eq!(report.cache.invalid_image_file_count, 0);
    assert_eq!(report.cache.content_type_mismatch_file_count, 1);
    assert_eq!(report.cache.content_type_mismatch_referenced_file_count, 1);
    assert_eq!(report.cache.content_type_mismatch_samples.len(), 1);
    assert!(report
        .recommendations
        .iter()
        .any(|item| item.contains("扩展名")));

    let _ = fs::remove_dir_all(root);
}

#[test]
fn image_health_report_counts_description_image_references() {
    let root = std::env::temp_dir().join(format!("mikavn-image-description-{}", Uuid::new_v4()));
    let paths = AppPaths::from_root(root.clone()).unwrap();
    fs::create_dir_all(paths.images()).unwrap();
    let description_image = paths.images().join("description.webp");
    fs::write(&description_image, b"RIFFxxxxWEBP").unwrap();
    let missing_description_image = paths.images().join("missing-description.webp");
    let description = format!(
        "Intro\n![local]({})\n![missing]({})",
        description_image.to_string_lossy(),
        missing_description_image.to_string_lossy()
    );
    create_description_health_db(&paths.database(), &description);

    let report =
        get_image_health_report_with_paths(&paths, ImageHealthReportOptions::default()).unwrap();

    assert_eq!(report.summary.total_image_refs, 2);
    assert_eq!(report.summary.missing_local_refs, 1);
    assert_eq!(report.cache.referenced_file_count, 1);
    assert_eq!(report.cache.orphan_file_count, 0);

    let _ = fs::remove_dir_all(root);
}

#[test]
fn duplicate_content_detection_skips_unique_size_files_before_hashing() {
    let root =
        std::env::temp_dir().join(format!("mikavn-image-content-prefilter-{}", Uuid::new_v4()));
    fs::create_dir_all(&root).unwrap();
    let duplicate_a = root.join("alpha.jpg");
    let duplicate_b = root.join("beta.webp");
    let missing_unique = root.join("missing-unique.jpg");
    fs::write(&duplicate_a, b"same-content").unwrap();
    fs::write(&duplicate_b, b"same-content").unwrap();

    let groups = duplicate_content_groups_from_candidates(
        vec![
            ImageCacheContentCandidate {
                path: duplicate_a,
                relative_path: "alpha.jpg".to_string(),
                size_bytes: 12,
                content_hash: 0,
            },
            ImageCacheContentCandidate {
                path: duplicate_b,
                relative_path: "beta.webp".to_string(),
                size_bytes: 12,
                content_hash: 0,
            },
            ImageCacheContentCandidate {
                path: missing_unique,
                relative_path: "missing-unique.jpg".to_string(),
                size_bytes: 1,
                content_hash: 0,
            },
        ],
        100,
    )
    .unwrap();

    assert_eq!(groups.total_groups, 1);
    assert_eq!(groups.samples.len(), 1);
    assert_eq!(groups.samples[0].count, 2);
    assert!(groups.samples[0].samples.contains(&"alpha.jpg".to_string()));
    assert!(groups.samples[0].samples.contains(&"beta.webp".to_string()));
    let _ = fs::remove_dir_all(root);
}

#[test]
fn duplicate_content_group_count_is_not_limited_by_sample_limit() {
    let root = std::env::temp_dir().join(format!(
        "mikavn-image-content-count-limit-{}",
        Uuid::new_v4()
    ));
    let paths = AppPaths::from_root(root.clone()).unwrap();
    fs::create_dir_all(paths.images()).unwrap();
    fs::write(paths.images().join("one-a.jpg"), b"content-one").unwrap();
    fs::write(paths.images().join("one-b.webp"), b"content-one").unwrap();
    fs::write(paths.images().join("two-a.png"), b"content-two").unwrap();
    fs::write(paths.images().join("two-b.gif"), b"content-two").unwrap();

    let report = get_image_health_report_with_paths(
        &paths,
        ImageHealthReportOptions {
            oversized_bytes: None,
            sample_limit: Some(1),
        },
    )
    .unwrap();

    assert_eq!(report.summary.duplicate_content_groups, 2);
    assert_eq!(report.cache.duplicate_content_groups, 2);
    assert_eq!(report.cache.duplicate_content_samples.len(), 1);
    let _ = fs::remove_dir_all(root);
}

#[test]
fn duplicate_content_groups_and_samples_are_stably_sorted() {
    let root = std::env::temp_dir().join(format!(
        "mikavn-image-content-stable-sort-{}",
        Uuid::new_v4()
    ));
    fs::create_dir_all(&root).unwrap();
    let beta = root.join("z-beta.webp");
    let alpha = root.join("a-alpha.jpg");
    let first_large = root.join("large-first.jpg");
    let second_large = root.join("large-second.jpg");
    let third_large = root.join("large-third.jpg");
    fs::write(&beta, b"same-small").unwrap();
    fs::write(&alpha, b"same-small").unwrap();
    fs::write(&first_large, b"same-large-content").unwrap();
    fs::write(&second_large, b"same-large-content").unwrap();
    fs::write(&third_large, b"same-large-content").unwrap();

    let groups = duplicate_content_groups_from_candidates(
        vec![
            ImageCacheContentCandidate {
                path: beta,
                relative_path: "z-beta.webp".to_string(),
                size_bytes: 10,
                content_hash: 0,
            },
            ImageCacheContentCandidate {
                path: alpha,
                relative_path: "a-alpha.jpg".to_string(),
                size_bytes: 10,
                content_hash: 0,
            },
            ImageCacheContentCandidate {
                path: third_large,
                relative_path: "large-third.jpg".to_string(),
                size_bytes: 18,
                content_hash: 0,
            },
            ImageCacheContentCandidate {
                path: first_large,
                relative_path: "large-first.jpg".to_string(),
                size_bytes: 18,
                content_hash: 0,
            },
            ImageCacheContentCandidate {
                path: second_large,
                relative_path: "large-second.jpg".to_string(),
                size_bytes: 18,
                content_hash: 0,
            },
        ],
        10,
    )
    .unwrap();

    assert_eq!(groups.total_groups, 2);
    assert_eq!(groups.samples[0].count, 3);
    assert_eq!(
        groups.samples[0].samples,
        vec![
            "large-first.jpg".to_string(),
            "large-second.jpg".to_string(),
            "large-third.jpg".to_string(),
        ]
    );
    assert_eq!(groups.samples[1].count, 2);
    assert_eq!(
        groups.samples[1].samples,
        vec!["a-alpha.jpg".to_string(), "z-beta.webp".to_string()]
    );
    let _ = fs::remove_dir_all(root);
}

#[test]
fn duplicate_file_name_groups_and_samples_are_stably_sorted() {
    let groups = duplicate_name_groups_from_names(
        HashMap::from([
            (
                "same.jpg".to_string(),
                vec![
                    "small\\z\\same.jpg".to_string(),
                    "small\\a\\same.jpg".to_string(),
                ],
            ),
            (
                "dup.webp".to_string(),
                vec![
                    "large\\c\\dup.webp".to_string(),
                    "large\\a\\dup.webp".to_string(),
                    "large\\b\\dup.webp".to_string(),
                ],
            ),
        ]),
        1,
    );

    assert_eq!(groups.total_groups, 2);
    assert_eq!(groups.samples.len(), 1);
    assert_eq!(groups.samples[0].file_name, "dup.webp");
    assert_eq!(groups.samples[0].count, 3);
    assert_eq!(
        groups.samples[0].samples,
        vec![
            "large\\a\\dup.webp".to_string(),
            "large\\b\\dup.webp".to_string(),
            "large\\c\\dup.webp".to_string(),
        ]
    );
}

fn create_health_db(path: &std::path::Path, cover: &str, legacy: &str, missing: &str) {
    let conn = Connection::open(path).unwrap();
    conn.execute_batch(
        r#"
            CREATE TABLE games (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              cover_image TEXT,
              banner_image TEXT,
              background_image TEXT,
              description TEXT
            );
            CREATE TABLE game_assets (
              id TEXT PRIMARY KEY,
              game_id TEXT NOT NULL,
              asset_type TEXT NOT NULL,
              uri TEXT NOT NULL,
              source TEXT,
              is_primary INTEGER NOT NULL DEFAULT 0
            );
            "#,
    )
    .unwrap();
    conn.execute(
        "INSERT INTO games (id, title, cover_image, banner_image, background_image, description) VALUES ('g1', 'VN', ?1, ?2, ?3, '')",
        (cover, legacy, missing),
    )
    .unwrap();
}

fn create_description_health_db(path: &std::path::Path, description: &str) {
    let conn = Connection::open(path).unwrap();
    conn.execute_batch(
        r#"
            CREATE TABLE games (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              cover_image TEXT,
              banner_image TEXT,
              background_image TEXT,
              description TEXT
            );
            "#,
    )
    .unwrap();
    conn.execute(
        "INSERT INTO games (id, title, cover_image, banner_image, background_image, description) VALUES ('g1', 'VN', '', '', '', ?1)",
        [description],
    )
    .unwrap();
}
