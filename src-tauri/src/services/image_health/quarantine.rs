use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;
use tauri::AppHandle;

use crate::db::DbResult;
use crate::infrastructure::paths::AppPaths;

use super::types::{
    ImageCacheContentCandidate, ImageQuarantineManifest, ImageQuarantineManifestItem,
};
use super::{
    collect_image_references, duplicate_content_candidate_groups_from_candidates,
    normalize_path_key, scan_image_cache, ImageCacheFileIssue, ImageHealthReportOptions,
    ImageQuarantineReport, ImageQuarantineSkippedFile, DEFAULT_OVERSIZED_IMAGE_BYTES,
};

pub fn quarantine_orphan_images(
    app: &AppHandle,
    options: ImageHealthReportOptions,
) -> DbResult<ImageQuarantineReport> {
    let paths = AppPaths::from_app(app)?;
    quarantine_orphan_images_with_paths(&paths, options)
}

pub fn quarantine_duplicate_content_images(
    app: &AppHandle,
    options: ImageHealthReportOptions,
) -> DbResult<ImageQuarantineReport> {
    let paths = AppPaths::from_app(app)?;
    quarantine_duplicate_content_images_with_paths(&paths, options)
}

pub fn quarantine_invalid_image_cache_files(
    app: &AppHandle,
    options: ImageHealthReportOptions,
) -> DbResult<ImageQuarantineReport> {
    let paths = AppPaths::from_app(app)?;
    quarantine_invalid_image_cache_files_with_paths(&paths, options)
}

pub fn quarantine_oversized_image_cache_files(
    app: &AppHandle,
    options: ImageHealthReportOptions,
) -> DbResult<ImageQuarantineReport> {
    let paths = AppPaths::from_app(app)?;
    quarantine_oversized_image_cache_files_with_paths(&paths, options)
}

pub fn quarantine_content_type_mismatch_files(
    app: &AppHandle,
    options: ImageHealthReportOptions,
) -> DbResult<ImageQuarantineReport> {
    let paths = AppPaths::from_app(app)?;
    quarantine_content_type_mismatch_files_with_paths(&paths, options)
}

pub(crate) fn quarantine_orphan_images_with_paths(
    paths: &AppPaths,
    options: ImageHealthReportOptions,
) -> DbResult<ImageQuarantineReport> {
    quarantine_image_cache_files(
        paths,
        orphan_candidates(paths, options)?,
        "orphan image cache file",
    )
}

pub(crate) fn quarantine_duplicate_content_images_with_paths(
    paths: &AppPaths,
    _options: ImageHealthReportOptions,
) -> DbResult<ImageQuarantineReport> {
    quarantine_image_cache_files(
        paths,
        duplicate_content_quarantine_candidates(paths)?,
        "duplicate content image cache file",
    )
}

pub(crate) fn quarantine_invalid_image_cache_files_with_paths(
    paths: &AppPaths,
    options: ImageHealthReportOptions,
) -> DbResult<ImageQuarantineReport> {
    quarantine_image_cache_files(
        paths,
        invalid_unreferenced_candidates(paths, options)?,
        "invalid unreferenced image cache file",
    )
}

pub(crate) fn quarantine_oversized_image_cache_files_with_paths(
    paths: &AppPaths,
    options: ImageHealthReportOptions,
) -> DbResult<ImageQuarantineReport> {
    quarantine_image_cache_files(
        paths,
        oversized_unreferenced_candidates(paths, options)?,
        "oversized unreferenced image cache file",
    )
}

pub(crate) fn quarantine_content_type_mismatch_files_with_paths(
    paths: &AppPaths,
    options: ImageHealthReportOptions,
) -> DbResult<ImageQuarantineReport> {
    quarantine_image_cache_files(
        paths,
        content_type_mismatch_unreferenced_candidates(paths, options)?,
        "content type mismatch unreferenced image cache file",
    )
}

fn quarantine_image_cache_files(
    paths: &AppPaths,
    candidates: Vec<ImageCacheFileIssue>,
    reason: &str,
) -> DbResult<ImageQuarantineReport> {
    let created_at = Utc::now();
    let quarantine_dir = paths
        .root()
        .join("image-quarantine")
        .join(created_at.format("%Y%m%d-%H%M%S").to_string());
    fs::create_dir_all(&quarantine_dir)?;

    let images_root = paths.images().canonicalize().ok();
    let mut moved = Vec::new();
    let mut skipped = Vec::new();
    let mut moved_bytes = 0;

    for candidate in candidates {
        let source = PathBuf::from(&candidate.path);
        if !source.is_file() {
            skipped.push(ImageQuarantineSkippedFile {
                path: candidate.path,
                reason: "source file no longer exists".to_string(),
            });
            continue;
        }
        if let (Some(images_root), Ok(canonical_source)) =
            (images_root.as_ref(), source.canonicalize())
        {
            if !canonical_source.starts_with(images_root) {
                skipped.push(ImageQuarantineSkippedFile {
                    path: candidate.path,
                    reason: "source is outside image cache".to_string(),
                });
                continue;
            }
        }

        let target = quarantine_dir.join(&candidate.relative_path);
        if target.exists() {
            skipped.push(ImageQuarantineSkippedFile {
                path: candidate.path,
                reason: "quarantine target already exists".to_string(),
            });
            continue;
        }
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::rename(&source, &target)?;
        moved_bytes += candidate.size_bytes;
        moved.push(ImageQuarantineManifestItem {
            source_path: candidate.path,
            quarantine_path: target.to_string_lossy().to_string(),
            relative_path: candidate.relative_path,
            size_bytes: candidate.size_bytes,
            reason: reason.to_string(),
        });
    }

    let manifest_path = quarantine_dir.join("manifest.json");
    let manifest = ImageQuarantineManifest {
        app: "MikaVN Library".to_string(),
        created_at: created_at.to_rfc3339(),
        moved,
    };
    fs::write(&manifest_path, serde_json::to_string_pretty(&manifest)?)?;

    Ok(ImageQuarantineReport {
        quarantine_dir: quarantine_dir.to_string_lossy().to_string(),
        manifest_path: manifest_path.to_string_lossy().to_string(),
        moved_files: manifest.moved.len() as i64,
        moved_bytes,
        skipped_files: skipped.len() as i64,
        skipped,
    })
}

fn orphan_candidates(
    paths: &AppPaths,
    options: ImageHealthReportOptions,
) -> DbResult<Vec<ImageCacheFileIssue>> {
    let oversized_bytes = options
        .oversized_bytes
        .unwrap_or(DEFAULT_OVERSIZED_IMAGE_BYTES);
    let references = collect_image_references(paths)?;
    let cache = scan_image_cache(
        paths,
        &references.referenced_paths,
        &references.reference_sources,
        oversized_bytes,
        usize::MAX,
    )?;
    Ok(cache.orphan_samples)
}

fn duplicate_content_quarantine_candidates(paths: &AppPaths) -> DbResult<Vec<ImageCacheFileIssue>> {
    let references = collect_image_references(paths)?;
    let groups = duplicate_content_candidate_groups_from_candidates(
        collect_image_cache_content_candidates(&paths.images(), &paths.images())?,
    )?;
    let mut candidates = Vec::new();
    for mut group in groups {
        group.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
        let has_referenced_file = group.iter().any(|candidate| {
            references
                .referenced_paths
                .contains(&normalize_path_key(&candidate.path.to_string_lossy()))
        });
        let mut kept_unreferenced_copy = false;
        for candidate in group {
            let path_key = normalize_path_key(&candidate.path.to_string_lossy());
            if references.referenced_paths.contains(&path_key) {
                continue;
            }
            if !has_referenced_file && !kept_unreferenced_copy {
                kept_unreferenced_copy = true;
                continue;
            }
            candidates.push(ImageCacheFileIssue {
                path: candidate.path.to_string_lossy().to_string(),
                relative_path: candidate.relative_path,
                size_bytes: candidate.size_bytes,
                reference_samples: references
                    .reference_sources
                    .get(&path_key)
                    .cloned()
                    .unwrap_or_default(),
            });
        }
    }
    Ok(candidates)
}

fn invalid_unreferenced_candidates(
    paths: &AppPaths,
    options: ImageHealthReportOptions,
) -> DbResult<Vec<ImageCacheFileIssue>> {
    let oversized_bytes = options
        .oversized_bytes
        .unwrap_or(DEFAULT_OVERSIZED_IMAGE_BYTES);
    let references = collect_image_references(paths)?;
    let cache = scan_image_cache(
        paths,
        &references.referenced_paths,
        &references.reference_sources,
        oversized_bytes,
        usize::MAX,
    )?;
    Ok(cache
        .invalid_image_samples
        .into_iter()
        .filter(|item| item.reference_samples.is_empty())
        .collect())
}

fn oversized_unreferenced_candidates(
    paths: &AppPaths,
    options: ImageHealthReportOptions,
) -> DbResult<Vec<ImageCacheFileIssue>> {
    let oversized_bytes = options
        .oversized_bytes
        .unwrap_or(DEFAULT_OVERSIZED_IMAGE_BYTES);
    let references = collect_image_references(paths)?;
    let cache = scan_image_cache(
        paths,
        &references.referenced_paths,
        &references.reference_sources,
        oversized_bytes,
        usize::MAX,
    )?;
    Ok(cache
        .oversized_samples
        .into_iter()
        .filter(|item| item.reference_samples.is_empty())
        .collect())
}

fn content_type_mismatch_unreferenced_candidates(
    paths: &AppPaths,
    options: ImageHealthReportOptions,
) -> DbResult<Vec<ImageCacheFileIssue>> {
    let oversized_bytes = options
        .oversized_bytes
        .unwrap_or(DEFAULT_OVERSIZED_IMAGE_BYTES);
    let references = collect_image_references(paths)?;
    let cache = scan_image_cache(
        paths,
        &references.referenced_paths,
        &references.reference_sources,
        oversized_bytes,
        usize::MAX,
    )?;
    Ok(cache
        .content_type_mismatch_samples
        .into_iter()
        .filter(|item| item.reference_samples.is_empty())
        .collect())
}

fn collect_image_cache_content_candidates(
    root: &Path,
    path: &Path,
) -> DbResult<Vec<ImageCacheContentCandidate>> {
    let mut candidates = Vec::new();
    if !path.exists() {
        return Ok(candidates);
    }
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let path = entry.path();
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            candidates.extend(collect_image_cache_content_candidates(root, &path)?);
            continue;
        }
        if !file_type.is_file() {
            continue;
        }
        candidates.push(ImageCacheContentCandidate {
            size_bytes: entry.metadata()?.len(),
            relative_path: path
                .strip_prefix(root)
                .unwrap_or(&path)
                .to_string_lossy()
                .to_string(),
            path,
            content_hash: 0,
        });
    }
    Ok(candidates)
}
