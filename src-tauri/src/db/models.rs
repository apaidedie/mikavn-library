use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Game {
    pub id: String,
    pub title: String,
    pub original_title: Option<String>,
    pub aliases: Vec<String>,
    pub developer: Option<String>,
    pub publisher: Option<String>,
    pub brand: Option<String>,
    pub release_date: Option<String>,
    pub description: Option<String>,
    pub notes: Option<String>,
    pub tags: Vec<String>,
    pub genres: Vec<String>,
    pub rating: Option<i64>,
    pub age_rating: Option<String>,
    pub play_status: String,
    pub favorite: bool,
    pub hidden: bool,
    pub install_path: String,
    pub executable_path: Option<String>,
    pub working_directory: Option<String>,
    pub launch_args: Option<String>,
    pub path_status: String,
    pub last_path_checked_at: Option<String>,
    pub cover_image: Option<String>,
    pub banner_image: Option<String>,
    pub background_image: Option<String>,
    pub vndb_id: Option<String>,
    pub bangumi_id: Option<String>,
    pub dlsite_id: Option<String>,
    pub fanza_id: Option<String>,
    pub ymgal_id: Option<String>,
    pub total_play_seconds: i64,
    pub last_played_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone)]
pub struct ArchiveImportConflictRow {
    pub id: String,
    pub title: String,
    pub install_path: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddGameInput {
    pub title: String,
    pub original_title: Option<String>,
    pub aliases: Option<Vec<String>>,
    pub developer: Option<String>,
    pub publisher: Option<String>,
    pub brand: Option<String>,
    pub release_date: Option<String>,
    pub description: Option<String>,
    pub notes: Option<String>,
    pub tags: Option<Vec<String>>,
    pub genres: Option<Vec<String>>,
    pub rating: Option<i64>,
    pub age_rating: Option<String>,
    pub play_status: Option<String>,
    pub favorite: Option<bool>,
    pub hidden: Option<bool>,
    pub install_path: String,
    pub executable_path: Option<String>,
    pub working_directory: Option<String>,
    pub launch_args: Option<String>,
    pub cover_image: Option<String>,
    pub banner_image: Option<String>,
    pub background_image: Option<String>,
    pub vndb_id: Option<String>,
    pub bangumi_id: Option<String>,
    pub dlsite_id: Option<String>,
    pub fanza_id: Option<String>,
    pub ymgal_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UpdateGameInput {
    pub title: Option<String>,
    pub original_title: Option<String>,
    pub aliases: Option<Vec<String>>,
    pub developer: Option<String>,
    pub publisher: Option<String>,
    pub brand: Option<String>,
    pub release_date: Option<String>,
    pub description: Option<String>,
    pub notes: Option<String>,
    pub tags: Option<Vec<String>>,
    pub genres: Option<Vec<String>>,
    pub rating: Option<i64>,
    pub age_rating: Option<String>,
    pub play_status: Option<String>,
    pub favorite: Option<bool>,
    pub hidden: Option<bool>,
    pub install_path: Option<String>,
    pub executable_path: Option<String>,
    pub working_directory: Option<String>,
    pub launch_args: Option<String>,
    pub path_status: Option<String>,
    pub last_path_checked_at: Option<String>,
    pub cover_image: Option<String>,
    pub banner_image: Option<String>,
    pub background_image: Option<String>,
    pub vndb_id: Option<String>,
    pub bangumi_id: Option<String>,
    pub dlsite_id: Option<String>,
    pub fanza_id: Option<String>,
    pub ymgal_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GameFilter {
    pub query: Option<String>,
    pub status: Option<String>,
    pub tag: Option<String>,
    pub developer: Option<String>,
    pub favorite: Option<bool>,
    pub hidden: Option<bool>,
    pub metadata_status: Option<String>,
    pub path_status: Option<String>,
    pub collection_id: Option<String>,
    pub external_provider: Option<String>,
    pub external_id: Option<String>,
    pub sort_by: Option<String>,
    pub sort_direction: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedSearchInput {
    pub query: String,
    pub sort_by: Option<String>,
    pub sort_direction: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchClause {
    pub kind: String,
    pub field: Option<String>,
    pub operator: Option<String>,
    pub value: String,
    pub negated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchQueryValidation {
    pub valid: bool,
    pub errors: Vec<String>,
    pub clauses: Vec<SearchClause>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedSearchResult {
    pub query: String,
    pub cleaned_query: String,
    pub total: i64,
    pub games: Vec<Game>,
    pub clauses: Vec<SearchClause>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedSearch {
    pub id: String,
    pub name: String,
    pub query: String,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedSearchInput {
    pub name: String,
    pub query: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameCollection {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub game_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionInput {
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCollectionInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionGameLink {
    pub collection_id: String,
    pub game_id: String,
    pub added_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameAsset {
    pub id: String,
    pub game_id: String,
    pub asset_type: String,
    pub uri: String,
    pub source: Option<String>,
    pub is_primary: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetInput {
    pub asset_type: String,
    pub uri: String,
    pub source: Option<String>,
    pub is_primary: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetImportInput {
    pub asset_type: String,
    pub source_path: String,
    pub is_primary: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetDownloadInput {
    pub asset_type: String,
    pub url: String,
    pub is_primary: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagRecord {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub game_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathCheckItem {
    pub kind: String,
    pub label: String,
    pub path: Option<String>,
    pub status: String,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GamePathHealth {
    pub game_id: String,
    pub status: String,
    pub checked_at: String,
    pub items: Vec<PathCheckItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldLock {
    pub id: String,
    pub game_id: String,
    pub field_name: String,
    pub locked_by_user: bool,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataSourceRecord {
    pub id: String,
    pub provider: String,
    pub label: String,
    pub enabled: bool,
    pub priority: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalIdRecord {
    pub id: String,
    pub game_id: String,
    pub provider: String,
    pub external_id: String,
    pub source: Option<String>,
    pub confidence: Option<f64>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone)]
pub struct DuplicateExternalIdAuditRow {
    pub provider: String,
    pub external_id: String,
    pub game_id: String,
    pub title: String,
    pub install_path: String,
    pub source: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateGameMergeOptions {
    pub target_game_id: String,
    pub source_game_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateGameMergeExternalId {
    pub provider: String,
    pub external_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateGameMergeGameSummary {
    pub game_id: String,
    pub title: String,
    pub install_path: String,
    pub external_ids: Vec<DuplicateGameMergeExternalId>,
    pub total_play_seconds: i64,
    pub last_played_at: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateGameMergeMovedCounts {
    pub source_games: i64,
    pub play_sessions: i64,
    pub launch_profiles: i64,
    pub save_paths: i64,
    pub save_backups: i64,
    pub external_ids: i64,
    pub collection_links: i64,
    pub assets: i64,
    pub tags: i64,
    pub field_locks: i64,
    pub metadata_match_results: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateGameMergePreview {
    pub target: DuplicateGameMergeGameSummary,
    pub sources: Vec<DuplicateGameMergeGameSummary>,
    pub shared_external_ids: Vec<DuplicateGameMergeExternalId>,
    pub moved_counts: DuplicateGameMergeMovedCounts,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateGameMergeResult {
    pub merged_game: Game,
    pub deleted_source_game_ids: Vec<String>,
    pub moved_counts: DuplicateGameMergeMovedCounts,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryRoot {
    pub id: String,
    pub path: String,
    pub recursive: bool,
    pub enabled: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardData {
    pub total_games: i64,
    pub planned_games: i64,
    pub playing_games: i64,
    pub completed_games: i64,
    pub total_play_seconds: i64,
    pub week_play_seconds: i64,
    pub month_play_seconds: i64,
    pub recent_games: Vec<Game>,
    pub recently_added: Vec<Game>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportCountItem {
    pub label: String,
    pub value: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportPlaytimeItem {
    pub label: String,
    pub seconds: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportGapExample {
    pub id: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportCompleteness {
    pub cover: i64,
    pub description: i64,
    pub release_date: i64,
    pub external_ids: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportGapExamples {
    pub missing_cover: Vec<ReportGapExample>,
    pub missing_description_image: Vec<ReportGapExample>,
    pub missing_external_ids: Vec<ReportGapExample>,
    pub broken_path: Vec<ReportGapExample>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportGaps {
    pub missing_cover: i64,
    pub missing_description_image: i64,
    pub missing_external_ids: i64,
    pub broken_path: i64,
    pub examples: ReportGapExamples,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportSummary {
    pub total_games: i64,
    pub total_play_seconds: i64,
    pub week_play_seconds: i64,
    pub month_play_seconds: i64,
    pub status: Vec<ReportCountItem>,
    pub tags: Vec<ReportCountItem>,
    pub developers: Vec<ReportCountItem>,
    pub playtime: Vec<ReportPlaytimeItem>,
    pub completeness: ReportCompleteness,
    pub gaps: ReportGaps,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaySession {
    pub id: String,
    pub game_id: String,
    pub launch_profile_id: Option<String>,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub duration_seconds: i64,
    pub exit_status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchProfile {
    pub id: String,
    pub game_id: String,
    pub name: String,
    pub executable_path: String,
    pub working_directory: Option<String>,
    pub arguments: Option<String>,
    pub environment_variables: Option<String>,
    pub runner_type: String,
    pub locale_emulator_path: Option<String>,
    pub pre_launch_command: Option<String>,
    pub post_launch_command: Option<String>,
    pub run_as_admin: bool,
    pub is_default: bool,
    pub compatibility_notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLaunchProfileInput {
    pub game_id: String,
    pub name: String,
    pub executable_path: String,
    pub working_directory: Option<String>,
    pub arguments: Option<String>,
    pub environment_variables: Option<String>,
    pub runner_type: Option<String>,
    pub locale_emulator_path: Option<String>,
    pub pre_launch_command: Option<String>,
    pub post_launch_command: Option<String>,
    pub run_as_admin: Option<bool>,
    pub is_default: Option<bool>,
    pub compatibility_notes: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UpdateLaunchProfileInput {
    pub name: Option<String>,
    pub executable_path: Option<String>,
    pub working_directory: Option<String>,
    pub arguments: Option<String>,
    pub environment_variables: Option<String>,
    pub runner_type: Option<String>,
    pub locale_emulator_path: Option<String>,
    pub pre_launch_command: Option<String>,
    pub post_launch_command: Option<String>,
    pub run_as_admin: Option<bool>,
    pub is_default: Option<bool>,
    pub compatibility_notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanExecutable {
    pub path: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanCandidate {
    pub id: String,
    pub root_path: String,
    pub install_path: String,
    pub folder_name: String,
    pub suggested_title: String,
    pub aliases: Vec<String>,
    pub executables: Vec<ScanExecutable>,
    pub selected_executable: Option<String>,
    pub conflict: Option<ScanConflict>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanConflict {
    pub game_id: String,
    pub title: String,
    pub reason: String,
}

#[derive(Debug, Clone)]
pub struct ScanConflictRow {
    pub id: String,
    pub title: String,
    pub install_path: String,
    pub executable_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanTaskStatus {
    pub task: TaskRecord,
    pub path: Option<String>,
    pub recursive: Option<bool>,
    pub candidates: Vec<ScanCandidate>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportCandidate {
    pub title: String,
    pub install_path: String,
    pub executable_path: Option<String>,
    pub aliases: Option<Vec<String>>,
    pub allow_duplicate: Option<bool>,
    pub conflict_action: Option<String>,
    pub conflict_game_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ImportScanReport {
    pub requested: usize,
    pub imported_count: usize,
    pub added: usize,
    pub merged: usize,
    pub replaced: usize,
    pub duplicated: usize,
    pub skipped: usize,
    pub imported: Vec<Game>,
    pub items: Vec<ImportScanReportItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportScanReportItem {
    pub candidate_title: String,
    pub install_path: String,
    pub action: String,
    pub game_id: Option<String>,
    pub target_title: Option<String>,
    pub conflict_reason: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ExternalIds {
    pub vndb: Option<String>,
    pub bangumi: Option<String>,
    pub dlsite: Option<String>,
    pub fanza: Option<String>,
    pub ymgal: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataSearchResult {
    pub provider: String,
    pub id: String,
    pub title: String,
    pub url: String,
    pub image_url: Option<String>,
    pub description: Option<String>,
    pub release_date: Option<String>,
    pub developers: Vec<String>,
    pub tags: Vec<String>,
    pub external_ids: ExternalIds,
    pub relevance_score: f64,
    pub from_vndb_sniff: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MetadataSearchResponse {
    pub query: String,
    pub cleaned_query: String,
    pub variants: Vec<String>,
    pub results: Vec<MetadataSearchResult>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NormalizedMetadata {
    pub provider: String,
    pub id: String,
    pub title: String,
    pub original_title: Option<String>,
    pub aliases: Vec<String>,
    pub description: Option<String>,
    pub release_date: Option<String>,
    pub developers: Vec<String>,
    pub publishers: Vec<String>,
    pub tags: Vec<String>,
    pub genres: Vec<String>,
    pub images: Vec<String>,
    pub external_ids: ExternalIds,
    pub age_rating: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchSuggestion {
    pub game_id: String,
    pub original_title: String,
    pub cleaned_title: String,
    pub selected: Option<MetadataSearchResult>,
    pub candidates: Vec<MetadataSearchResult>,
    pub status: String,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchMatchJob {
    pub id: String,
    pub task_id: Option<String>,
    pub status: String,
    pub total: i64,
    pub completed: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchMatchResult {
    pub id: String,
    pub job_id: String,
    pub game_id: String,
    pub original_title: String,
    pub cleaned_title: Option<String>,
    pub selected_provider: Option<String>,
    pub selected_id: Option<String>,
    pub selected_score: Option<f64>,
    pub status: String,
    pub reason: Option<String>,
    pub candidates: Vec<MetadataSearchResult>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchMatchStatus {
    pub job: BatchMatchJob,
    pub results: Vec<BatchMatchResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskRecord {
    pub id: String,
    pub task_type: String,
    pub status: String,
    pub progress: f64,
    pub message: Option<String>,
    pub error: Option<String>,
    pub retry_payload: Option<String>,
    pub retryable: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskLogEntry {
    pub id: String,
    pub task_id: String,
    pub level: String,
    pub message: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskDetail {
    pub task: TaskRecord,
    pub logs: Vec<TaskLogEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiRecognitionResult {
    pub title: String,
    pub raw_text: String,
    pub confidence: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavePath {
    pub id: String,
    pub game_id: String,
    pub label: String,
    pub path: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavePathCandidate {
    pub label: String,
    pub path: String,
    pub reason: String,
    pub exists: bool,
    pub already_added: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBackup {
    pub id: String,
    pub game_id: String,
    pub save_path_id: String,
    pub label: String,
    pub source_path: String,
    pub backup_path: String,
    pub protection: bool,
    pub created_at: String,
}
