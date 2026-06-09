import { invoke } from '@tauri-apps/api/core';
import type { AddGameInput, AssetCacheCleanupResult, AssetDownloadInput, AssetImportInput, AssetInput, CollectionGameLink, CollectionInput, DashboardData, Game, GameAsset, GameCollection, GameFilter, GamePathHealth, ImportCandidate, ImportScanReport, LibraryRoot, PlaySession, ScanCandidate, TagRecord, UpdateGameInput } from '@/types/game';
import type { AppDataDiagnostics, DatabaseBackupCleanupPolicy, DatabaseBackupCleanupReport, ImageReferenceAudit, ImageReferenceAuditOptions, LibraryArchiveExportOptions, LibraryArchiveImportOptions, LibraryArchivePreview, LibraryArchiveRestoreOptions, LogRecord, LogRetentionPolicy, TrayStatus } from '@/types/archive';
import type { LaunchProfile, LaunchProfileInput, LaunchProfileUpdate } from '@/types/launch';
import type { AdvancedSearchInput, AdvancedSearchResult, AiConnectionTestResult, AiRecognitionResult, ApplyMetadataFields, ArtworkRepairDiagnosis, ArtworkRepairOptions, ArtworkRepairPreview, BatchMatchJob, BatchMatchStatus, DescriptionImageRepairOptions, DescriptionImageRepairPreview, DuplicateExternalIdAuditOptions, DuplicateExternalIdPreview, DuplicateGameMergeOptions, DuplicateGameMergePreview, DuplicateGameMergeResult, ExternalIdRecord, FieldLock, MatchSuggestion, MetadataProvider, MetadataSearchResponse, MetadataSourceRecord, NormalizedMetadata, SavedSearch, SavedSearchInput, SearchQueryValidation } from '@/types/metadata';
import type { SaveBackup, SavePath, SavePathCandidate, SaveRestoreMode, SaveRestorePreview } from '@/types/saves';
import { normalizeAppError } from '@/types/error';
import type { ScanTaskStatus, TaskDetail, TaskLogEntry, TaskRecord } from '@/types/task';
import { mockStore } from './mockStore';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function command<T>(name: string, args?: Record<string, unknown>, fallback?: () => Promise<T>): Promise<T> {
  try {
    if (isTauri) {
      return await invoke<T>(name, args);
    }

    if (!fallback) {
      throw new Error(`Command ${name} is only available inside Tauri.`);
    }

    return await fallback();
  } catch (reason) {
    throw normalizeAppError(reason);
  }
}

export const api = {
  listGames(filter: GameFilter = {}) {
    return command<Game[]>('list_games', { filter }, () => mockStore.listGames(filter));
  },

  getGame(id: string) {
    return command<Game>('get_game', { id }, () => mockStore.getGame(id));
  },

  checkGamePaths(id: string) {
    return command<GamePathHealth>('check_game_paths', { id }, () => mockStore.checkGamePaths(id));
  },

  checkGamePathsTask(id: string) {
    return command<TaskRecord>('check_game_paths_task', { id }, () => mockStore.checkGamePathsTask(id));
  },

  relocateGamePaths(id: string, installPath: string) {
    return command<Game>('relocate_game_paths', { id, installPath }, () => mockStore.relocateGamePaths(id, installPath));
  },

  revealPath(path: string) {
    return command<void>('reveal_path', { path }, () => mockStore.revealPath(path));
  },

  addGame(input: AddGameInput) {
    return command<Game>('add_game', { input }, () => mockStore.addGame(input));
  },

  updateGame(id: string, input: UpdateGameInput) {
    return command<Game>('update_game', { id, input }, () => mockStore.updateGame(id, input));
  },

  deleteGameRecord(id: string) {
    return command<void>('delete_game_record', { id }, () => mockStore.deleteGameRecord(id));
  },

  listCollections() {
    return command<GameCollection[]>('list_collections', undefined, () => mockStore.listCollections());
  },

  listGameAssets(gameId: string) {
    return command<GameAsset[]>('list_game_assets', { gameId }, () => mockStore.listGameAssets(gameId));
  },

  upsertGameAsset(gameId: string, input: AssetInput) {
    return command<GameAsset>('upsert_game_asset', { gameId, input }, () => mockStore.upsertGameAsset(gameId, input));
  },

  removeGameAsset(id: string) {
    return command<Game>('remove_game_asset', { id }, () => mockStore.removeGameAsset(id));
  },

  setPrimaryAsset(id: string) {
    return command<Game>('set_primary_asset', { id }, () => mockStore.setPrimaryAsset(id));
  },

  importGameAssetFromPath(gameId: string, input: AssetImportInput) {
    return command<GameAsset>('import_game_asset_from_path', { gameId, input }, () => mockStore.importGameAssetFromPath(gameId, input));
  },

  downloadGameAsset(gameId: string, input: AssetDownloadInput) {
    return command<GameAsset>('download_game_asset', { gameId, input }, () => mockStore.downloadGameAsset(gameId, input));
  },

  cleanupAssetCache() {
    return command<AssetCacheCleanupResult>('cleanup_asset_cache', undefined, () => mockStore.cleanupAssetCache());
  },

  previewAssetCacheCleanup() {
    return command<AssetCacheCleanupResult>('preview_asset_cache_cleanup', undefined, () => mockStore.previewAssetCacheCleanup());
  },

  listTags(kind?: string) {
    return command<TagRecord[]>('list_tags', { kind }, () => mockStore.listTags(kind));
  },

  renameTag(id: string, name: string) {
    return command<TagRecord>('rename_tag', { id, name }, () => mockStore.renameTag(id, name));
  },

  mergeTags(sourceIds: string[], targetId: string) {
    return command<TagRecord>('merge_tags', { sourceIds, targetId }, () => mockStore.mergeTags(sourceIds, targetId));
  },

  deleteTag(id: string) {
    return command<void>('delete_tag', { id }, () => mockStore.deleteTag(id));
  },

  createCollection(input: CollectionInput) {
    return command<GameCollection>('create_collection', { input }, () => mockStore.createCollection(input));
  },

  updateCollection(id: string, input: Partial<CollectionInput>) {
    return command<GameCollection>('update_collection', { id, input }, () => mockStore.updateCollection(id, input));
  },

  deleteCollection(id: string) {
    return command<void>('delete_collection', { id }, () => mockStore.deleteCollection(id));
  },

  listCollectionGames(collectionId: string) {
    return command<Game[]>('list_collection_games', { collectionId }, () => mockStore.listCollectionGames(collectionId));
  },

  addGameToCollection(collectionId: string, gameId: string) {
    return command<CollectionGameLink>('add_game_to_collection', { collectionId, gameId }, () => mockStore.addGameToCollection(collectionId, gameId));
  },

  removeGameFromCollection(collectionId: string, gameId: string) {
    return command<void>('remove_game_from_collection', { collectionId, gameId }, () => mockStore.removeGameFromCollection(collectionId, gameId));
  },

  getDashboard() {
    return command<DashboardData>('get_dashboard', undefined, () => mockStore.getDashboard());
  },

  exportReportMarkdown(path: string, content: string) {
    return command<void>('export_report_markdown', { path, content }, () => mockStore.exportReportMarkdown(path, content));
  },

  exportReportMarkdownTask(path: string, content: string) {
    return command<TaskRecord>('export_report_markdown_task', { path, content }, () => mockStore.exportReportMarkdownTask(path, content));
  },

  backupDatabase(path: string) {
    return command<TaskRecord>('backup_database', { path }, () => mockStore.backupDatabase(path));
  },

  restoreDatabaseBackup(path: string) {
    return command<TaskRecord>('restore_database_backup', { path }, () => mockStore.restoreDatabaseBackup(path));
  },

  getAppDataDiagnostics() {
    return command<AppDataDiagnostics>('get_app_data_diagnostics', undefined, () => mockStore.getAppDataDiagnostics());
  },

  auditImageReferences(options: ImageReferenceAuditOptions = {}) {
    return command<ImageReferenceAudit>('audit_image_references', { options }, () => mockStore.auditImageReferences(options));
  },

  cleanupOldDatabaseBackups(policy: DatabaseBackupCleanupPolicy = {}) {
    return command<DatabaseBackupCleanupReport>('cleanup_old_database_backups', { policy }, () => mockStore.cleanupOldDatabaseBackups(policy));
  },

  listDiagnosticLogs(limit = 30) {
    return command<LogRecord[]>('list_diagnostic_logs', { limit }, () => mockStore.listDiagnosticLogs(limit));
  },

  getLogRetention() {
    return command<LogRetentionPolicy>('get_log_retention', undefined, () => mockStore.getLogRetention());
  },

  pruneDiagnosticLogs(policy: LogRetentionPolicy) {
    return command<number>('prune_diagnostic_logs', { policy }, () => mockStore.pruneDiagnosticLogs(policy));
  },

  getTrayStatus() {
    return command<TrayStatus>('get_tray_status', undefined, () => mockStore.getTrayStatus());
  },

  exportLibraryArchive(options: LibraryArchiveExportOptions) {
    return command<TaskRecord>('export_library_archive', { options }, () => mockStore.exportLibraryArchive(options));
  },

  exportLibraryArchiveZip(options: LibraryArchiveExportOptions) {
    return command<TaskRecord>('export_library_archive_zip', { options }, () => mockStore.exportLibraryArchiveZip(options));
  },

  previewLibraryArchive(path: string) {
    return command<LibraryArchivePreview>('preview_library_archive', { path }, () => mockStore.previewLibraryArchive(path));
  },

  importLibraryArchive(options: LibraryArchiveImportOptions) {
    return command<TaskRecord>('import_library_archive', { options }, () => mockStore.importLibraryArchive(options));
  },

  restoreLibraryArchive(options: LibraryArchiveRestoreOptions) {
    return command<TaskRecord>('restore_library_archive', { options }, () => mockStore.restoreLibraryArchive(options));
  },

  launchGame(id: string) {
    return command<PlaySession>('launch_game', { id }, () => mockStore.launchGame(id));
  },

  launchGameWithProfile(id: string, profileId?: string | null) {
    return command<PlaySession>('launch_game_with_profile', { id, profileId }, () => mockStore.launchGameWithProfile(id, profileId));
  },

  listPlaySessions(gameId: string, limit = 50) {
    return command<PlaySession[]>('list_play_sessions', { gameId, limit }, () => mockStore.listPlaySessions(gameId, limit));
  },

  listLaunchProfiles(gameId: string) {
    return command<LaunchProfile[]>('list_launch_profiles', { gameId }, () => mockStore.listLaunchProfiles(gameId));
  },

  createLaunchProfile(input: LaunchProfileInput) {
    return command<LaunchProfile>('create_launch_profile', { input }, () => mockStore.createLaunchProfile(input));
  },

  updateLaunchProfile(id: string, input: LaunchProfileUpdate) {
    return command<LaunchProfile>('update_launch_profile', { id, input }, () => mockStore.updateLaunchProfile(id, input));
  },

  deleteLaunchProfile(id: string) {
    return command<void>('delete_launch_profile', { id }, () => mockStore.deleteLaunchProfile(id));
  },

  setDefaultLaunchProfile(id: string) {
    return command<LaunchProfile>('set_default_launch_profile', { id }, () => mockStore.setDefaultLaunchProfile(id));
  },

  searchMetadata(query: string, providers: MetadataProvider[] = ['vndb', 'dlsite', 'fanza']) {
    return command<MetadataSearchResponse>('search_metadata', { query, providers }, () => mockStore.searchMetadata(query, providers));
  },

  searchGamesAdvanced(input: AdvancedSearchInput) {
    return command<AdvancedSearchResult>('search_games_advanced', { input }, () => mockStore.searchGamesAdvanced(input));
  },

  validateSearchQuery(query: string) {
    return command<SearchQueryValidation>('validate_search_query', { query }, () => mockStore.validateSearchQuery(query));
  },

  listSavedSearches() {
    return command<SavedSearch[]>('list_saved_searches', undefined, () => mockStore.listSavedSearches());
  },

  createSavedSearch(input: SavedSearchInput) {
    return command<SavedSearch>('create_saved_search', { input }, () => mockStore.createSavedSearch(input));
  },

  updateSavedSearch(id: string, input: SavedSearchInput) {
    return command<SavedSearch>('update_saved_search', { id, input }, () => mockStore.updateSavedSearch(id, input));
  },

  deleteSavedSearch(id: string) {
    return command<void>('delete_saved_search', { id }, () => mockStore.deleteSavedSearch(id));
  },

  getMetadataDetail(provider: MetadataProvider | string, id: string) {
    return command<NormalizedMetadata>('get_metadata_detail', { provider, id }, () => mockStore.getMetadataDetail(provider, id));
  },

  matchMetadataForGame(gameId: string) {
    return command<MatchSuggestion>('match_metadata_for_game', { gameId }, () => mockStore.matchMetadataForGame(gameId));
  },

  applyMetadataToGame(gameId: string, metadata: NormalizedMetadata, fields: ApplyMetadataFields, forceLocked = false) {
    return command<Game>('apply_metadata_to_game', { gameId, metadata, fields, forceLocked }, () => mockStore.applyMetadataToGame(gameId, metadata, fields, forceLocked));
  },

  listMetadataSources() {
    return command<MetadataSourceRecord[]>('list_metadata_sources', undefined, () => mockStore.listMetadataSources());
  },

  listExternalIds(gameId: string) {
    return command<ExternalIdRecord[]>('list_external_ids', { gameId }, () => mockStore.listExternalIds(gameId));
  },

  listFieldLocks(gameId: string) {
    return command<FieldLock[]>('list_field_locks', { gameId }, () => mockStore.listFieldLocks(gameId));
  },

  setFieldLock(gameId: string, fieldName: string, lockedByUser: boolean) {
    return command<FieldLock>('set_field_lock', { gameId, fieldName, lockedByUser }, () => mockStore.setFieldLock(gameId, fieldName, lockedByUser));
  },

  setFieldLocks(gameId: string, fieldNames: string[], lockedByUser: boolean) {
    return command<FieldLock[]>('set_field_locks', { gameId, fieldNames, lockedByUser }, () => mockStore.setFieldLocks(gameId, fieldNames, lockedByUser));
  },

  batchMatchMetadata(gameIds: string[]) {
    return command<BatchMatchJob>('batch_match_metadata', { gameIds }, () => mockStore.batchMatchMetadata(gameIds));
  },

  previewDescriptionImageRepair(options: DescriptionImageRepairOptions = {}) {
    return command<DescriptionImageRepairPreview>('preview_description_image_repair', { options }, () => mockStore.previewDescriptionImageRepair(options));
  },

  repairDescriptionImages(options: DescriptionImageRepairOptions = {}) {
    return command<TaskRecord>('repair_description_images', { options }, () => mockStore.repairDescriptionImages(options));
  },

  previewArtworkRepair(options: ArtworkRepairOptions = {}) {
    return command<ArtworkRepairPreview>('preview_artwork_repair', { options }, () => mockStore.previewArtworkRepair(options));
  },

  diagnoseArtworkRepair(options: ArtworkRepairOptions = {}) {
    return command<ArtworkRepairDiagnosis>('diagnose_artwork_repair', { options }, () => mockStore.diagnoseArtworkRepair(options));
  },

  repairArtwork(options: ArtworkRepairOptions = {}) {
    return command<TaskRecord>('repair_artwork', { options }, () => mockStore.repairArtwork(options));
  },

  previewDuplicateExternalIds(options: DuplicateExternalIdAuditOptions = {}) {
    return command<DuplicateExternalIdPreview>('preview_duplicate_external_ids', { options }, () => mockStore.previewDuplicateExternalIds(options));
  },

  auditDuplicateExternalIds(options: DuplicateExternalIdAuditOptions = {}) {
    return command<TaskRecord>('audit_duplicate_external_ids', { options }, () => mockStore.auditDuplicateExternalIds(options));
  },

  previewDuplicateGameMerge(options: DuplicateGameMergeOptions) {
    return command<DuplicateGameMergePreview>('preview_duplicate_game_merge', { options }, () => mockStore.previewDuplicateGameMerge(options));
  },

  mergeDuplicateGames(options: DuplicateGameMergeOptions) {
    return command<DuplicateGameMergeResult>('merge_duplicate_games', { options }, () => mockStore.mergeDuplicateGames(options));
  },

  getBatchMatchStatus(jobId: string) {
    return command<BatchMatchStatus>('get_batch_match_status', { jobId }, () => mockStore.getBatchMatchStatus(jobId));
  },

  cancelBatchMatch(jobId: string) {
    return command<void>('cancel_batch_match', { jobId }, () => mockStore.cancelBatchMatch(jobId));
  },

  recognizeGameFromImage(imagePath: string) {
    return command<AiRecognitionResult>('recognize_game_from_image', { imagePath }, () => mockStore.recognizeGameFromImage(imagePath));
  },

  testAiConnection() {
    return command<AiConnectionTestResult>('test_ai_connection', undefined, () => mockStore.testAiConnection());
  },

  scanPathPreview(path: string, recursive: boolean) {
    return command<ScanCandidate[]>('scan_path_preview', { path, recursive }, () => mockStore.scanPathPreview(path, recursive));
  },

  startScanTask(path: string, recursive: boolean) {
    return command<TaskRecord>('start_scan_task', { path, recursive }, () => mockStore.startScanTask(path, recursive));
  },

  getScanTaskStatus(taskId: string) {
    return command<ScanTaskStatus>('get_scan_task_status', { taskId }, () => mockStore.getScanTaskStatus(taskId));
  },

  importScanCandidates(candidates: ImportCandidate[]) {
    return command<ImportScanReport>('import_scan_candidates', { candidates }, () => mockStore.importScanCandidates(candidates));
  },

  addLibraryRoot(path: string) {
    return command<LibraryRoot>('add_library_root', { path }, () => mockStore.addLibraryRoot(path));
  },

  listLibraryRoots() {
    return command<LibraryRoot[]>('list_library_roots', undefined, () => mockStore.listLibraryRoots());
  },

  updateLibraryRoot(id: string, input: { recursive?: boolean; enabled?: boolean }) {
    return command<LibraryRoot>('update_library_root', { id, recursive: input.recursive, enabled: input.enabled }, () => mockStore.updateLibraryRoot(id, input));
  },

  removeLibraryRoot(id: string) {
    return command<void>('remove_library_root', { id }, () => mockStore.removeLibraryRoot(id));
  },

  scanLibraryRoot(id: string) {
    return command<ScanCandidate[]>('scan_library_root', { id }, () => mockStore.scanLibraryRoot(id));
  },

  getAppSettings() {
    return command<Record<string, string>>('get_app_settings', undefined, () => mockStore.getAppSettings());
  },

  setAppSettings(settings: Record<string, string>) {
    return command<void>('set_app_settings', { settings }, () => mockStore.setAppSettings(settings));
  },

  listTasks(limit = 50) {
    return command<TaskRecord[]>('list_tasks', { limit }, () => mockStore.listTasks(limit));
  },

  getTask(id: string) {
    return command<TaskRecord>('get_task', { id }, () => mockStore.getTask(id));
  },

  getTaskDetail(id: string) {
    return command<TaskDetail>('get_task_detail', { id }, () => mockStore.getTaskDetail(id));
  },

  listTaskLogs(taskId: string) {
    return command<TaskLogEntry[]>('list_task_logs', { taskId }, () => mockStore.listTaskLogs(taskId));
  },

  createTask(taskType: string, message?: string | null) {
    return command<TaskRecord>('create_task', { taskType, message });
  },

  updateTask(id: string, status: string, progress: number, message?: string | null, error?: string | null) {
    return command<TaskRecord>('update_task', { id, status, progress, message, error });
  },

  cancelTask(id: string) {
    return command<TaskRecord>('cancel_task', { id }, () => mockStore.cancelTask(id));
  },

  retryTask(id: string) {
    return command<TaskRecord>('retry_task', { id }, () => mockStore.retryTask(id));
  },

  listSavePaths(gameId: string) {
    return command<SavePath[]>('list_save_paths', { gameId }, () => mockStore.listSavePaths(gameId));
  },

  addSavePath(gameId: string, label: string, path: string) {
    return command<SavePath>('add_save_path', { gameId, label, path }, () => mockStore.addSavePath(gameId, label, path));
  },

  removeSavePath(id: string) {
    return command<void>('remove_save_path', { id }, () => mockStore.removeSavePath(id));
  },

  suggestSavePaths(gameId: string) {
    return command<SavePathCandidate[]>('suggest_save_paths', { gameId }, () => mockStore.suggestSavePaths(gameId));
  },

  createSaveBackup(savePathId: string, label: string) {
    return command<SaveBackup>('create_save_backup', { savePathId, label }, () => mockStore.createSaveBackup(savePathId, label));
  },

  createSaveBackupTask(savePathId: string, label: string) {
    return command<TaskRecord>('create_save_backup_task', { savePathId, label }, () => mockStore.createSaveBackupTask(savePathId, label));
  },

  listSaveBackups(gameId: string) {
    return command<SaveBackup[]>('list_save_backups', { gameId }, () => mockStore.listSaveBackups(gameId));
  },

  restoreSaveBackup(backupId: string) {
    return command<SaveBackup>('restore_save_backup', { backupId }, () => mockStore.restoreSaveBackup(backupId));
  },

  restoreSaveBackupTask(backupId: string, mode: 'merge' | 'mirror' = 'merge') {
    return command<TaskRecord>('restore_save_backup_task', { backupId, options: { mode } }, () => mockStore.restoreSaveBackupTask(backupId, mode));
  },

  previewSaveRestore(backupId: string, mode: SaveRestoreMode = 'merge') {
    return command<SaveRestorePreview>('preview_save_restore', { backupId, options: { mode } }, () => mockStore.previewSaveRestore(backupId, mode));
  },

  deleteSaveBackupRecord(id: string) {
    return command<void>('delete_save_backup_record', { id }, () => mockStore.deleteSaveBackupRecord(id));
  },
};
