use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageHealthReportOptions {
    pub oversized_bytes: Option<u64>,
    pub sample_limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageHealthReport {
    pub generated_at: String,
    pub summary: ImageHealthSummary,
    pub cache: ImageCacheHealth,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageHealthSummary {
    pub total_image_refs: i64,
    pub issue_image_refs: i64,
    pub missing_local_refs: i64,
    pub c_drive_refs: i64,
    pub playnite_refs: i64,
    pub legacy_app_data_import_refs: i64,
    pub external_legacy_refs: i64,
    pub image_files: i64,
    pub orphan_files: i64,
    pub duplicate_file_name_groups: i64,
    pub duplicate_content_groups: i64,
    pub oversized_files: i64,
    pub invalid_image_files: i64,
    pub invalid_image_refs: i64,
    pub content_type_mismatch_files: i64,
    pub content_type_mismatch_refs: i64,
    pub missing_cover_games: i64,
    pub missing_artwork_games: i64,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageCacheHealth {
    pub root_path: String,
    pub file_count: i64,
    pub total_bytes: u64,
    pub referenced_file_count: i64,
    pub orphan_file_count: i64,
    pub orphan_bytes: u64,
    pub duplicate_file_name_groups: i64,
    pub duplicate_content_groups: i64,
    pub oversized_file_count: i64,
    pub oversized_bytes: u64,
    pub invalid_image_file_count: i64,
    pub invalid_referenced_file_count: i64,
    pub invalid_image_bytes: u64,
    pub content_type_mismatch_file_count: i64,
    pub content_type_mismatch_referenced_file_count: i64,
    pub content_type_mismatch_bytes: u64,
    pub orphan_samples: Vec<ImageCacheFileIssue>,
    pub duplicate_name_samples: Vec<ImageDuplicateNameGroup>,
    pub duplicate_content_samples: Vec<ImageDuplicateContentGroup>,
    pub oversized_samples: Vec<ImageCacheFileIssue>,
    pub invalid_image_samples: Vec<ImageCacheFileIssue>,
    pub content_type_mismatch_samples: Vec<ImageCacheFileIssue>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageCacheFileIssue {
    pub path: String,
    pub relative_path: String,
    pub size_bytes: u64,
    pub reference_samples: Vec<ImageCacheReferenceSample>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageCacheReferenceSample {
    pub game_id: Option<String>,
    pub game_title: Option<String>,
    pub source_kind: String,
    pub field_name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageDuplicateNameGroup {
    pub file_name: String,
    pub count: i64,
    pub samples: Vec<String>,
}

#[derive(Debug, Clone, Default)]
pub(super) struct ImageDuplicateNameGroups {
    pub(super) total_groups: i64,
    pub(super) samples: Vec<ImageDuplicateNameGroup>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageDuplicateContentGroup {
    pub content_hash: String,
    pub size_bytes: u64,
    pub count: i64,
    pub samples: Vec<String>,
}

#[derive(Debug, Clone)]
pub(super) struct ImageCacheContentCandidate {
    pub(super) path: PathBuf,
    pub(super) relative_path: String,
    pub(super) size_bytes: u64,
}

#[derive(Debug, Clone, Default)]
pub(super) struct ImageDuplicateContentGroups {
    pub(super) total_groups: i64,
    pub(super) samples: Vec<ImageDuplicateContentGroup>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageQuarantineReport {
    pub quarantine_dir: String,
    pub manifest_path: String,
    pub moved_files: i64,
    pub moved_bytes: u64,
    pub skipped_files: i64,
    pub skipped: Vec<ImageQuarantineSkippedFile>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageQuarantineSkippedFile {
    pub path: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ImageQuarantineManifest {
    pub(super) app: String,
    pub(super) created_at: String,
    pub(super) moved: Vec<ImageQuarantineManifestItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ImageQuarantineManifestItem {
    pub(super) source_path: String,
    pub(super) quarantine_path: String,
    pub(super) relative_path: String,
    pub(super) size_bytes: u64,
    pub(super) reason: String,
}

#[derive(Debug, Default)]
pub(super) struct ImageReferenceCollection {
    pub(super) summary: ImageHealthSummary,
    pub(super) referenced_paths: HashSet<String>,
    pub(super) reference_sources: HashMap<String, Vec<ImageCacheReferenceSample>>,
}
