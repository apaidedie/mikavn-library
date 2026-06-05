import type { TaskRecord } from '@/types/task';

export type LibraryArchiveExportOptions = {
  targetDir: string;
  includeImages?: boolean | null;
  includeSaveBackups?: boolean | null;
};

export type LibraryArchiveImportOptions = {
  archiveDir: string;
  includeImages?: boolean | null;
  includeSaveBackups?: boolean | null;
};

export type LibraryArchiveRestoreOptions = {
  archiveDir: string;
  restoreImages?: boolean | null;
  restoreSaveBackups?: boolean | null;
};

export type LibraryArchiveManifest = {
  app: string;
  archiveVersion: number;
  exportedAt: string;
  databaseFile: string;
  includeImages: boolean;
  includeSaveBackups: boolean;
  imagesCount: number;
  saveBackupsCount: number;
  notes: string[];
};

export type LibraryArchivePreview = {
  archiveDir: string;
  manifest: LibraryArchiveManifest;
  databasePresent: boolean;
  imagesCount: number;
  saveBackupsCount: number;
  warnings: string[];
};

export type LibraryArchiveExportTask = TaskRecord;

export type LogRecord = {
  fileName: string;
  path: string;
  sizeBytes: number;
  modifiedAt?: string | null;
  preview: string[];
};

export type LogRetentionPolicy = {
  retainDays: number;
  maxFiles: number;
};

export type DirectoryStats = {
  path: string;
  exists: boolean;
  fileCount: number;
  totalBytes: number;
};

export type DatabaseBackupFile = {
  path: string;
  fileName: string;
  sizeBytes: number;
  modifiedAt?: string | null;
};

export type DatabaseBackupSummary = {
  rootPath: string;
  fileCount: number;
  totalBytes: number;
  files: DatabaseBackupFile[];
};

export type MetadataCoverageHealth = {
  completeGameCount: number;
  needsMetadataCount: number;
  missingCoverCount: number;
  missingBannerCount: number;
  missingBackgroundCount: number;
  missingDescriptionCount: number;
  missingExternalIdCount: number;
  providerLinkedGameCount: number;
  vndbGameCount: number;
  dlsiteGameCount: number;
  fanzaGameCount: number;
};

export type DescriptionImageHealth = {
  providerGamesCount: number;
  providerGamesWithImagesCount: number;
  providerGamesWithoutImagesCount: number;
  providerGamesEmptyDescriptionCount: number;
  allGamesWithImagesCount: number;
  imageRefsCount: number;
  localImageRefsCount: number;
  missingLocalImageRefsCount: number;
};

export type ExternalIdHealth = {
  totalExternalIdCount: number;
  vndbIdCount: number;
  dlsiteIdCount: number;
  fanzaIdCount: number;
  duplicateExternalIdGroupsCount: number;
  duplicateExternalIdGamesCount: number;
  duplicateVndbIdGroupsCount: number;
  duplicateDlsiteIdGroupsCount: number;
  duplicateFanzaIdGroupsCount: number;
};

export type PathStatusHealth = {
  okCount: number;
  brokenCount: number;
  incompleteCount: number;
  uncheckedCount: number;
};

export type DatabaseHealth = {
  path: string;
  exists: boolean;
  sizeBytes: number;
  userVersion?: number | null;
  quickCheck?: string | null;
  quickCheckOk: boolean;
  foreignKeyIssues: number;
  gameCount: number;
  assetCount: number;
  imageRefsCount: number;
  localImageRefsCount: number;
  missingImageRefsCount: number;
  cDriveImageRefsCount: number;
  playniteImageRefsCount: number;
  metadataCoverage: MetadataCoverageHealth;
  descriptionImages: DescriptionImageHealth;
  externalIds: ExternalIdHealth;
  pathStatus: PathStatusHealth;
};

export type AppDataDiagnostics = {
  appDataDir: string;
  dataDirSource: string;
  database: DatabaseHealth;
  images: DirectoryStats;
  cache: DirectoryStats;
  logs: DirectoryStats;
  saveBackups: DirectoryStats;
  databaseBackups: DatabaseBackupSummary;
  warnings: string[];
};

export type DatabaseBackupCleanupPolicy = {
  retainCount?: number | null;
  retainDays?: number | null;
};

export type DatabaseBackupCleanupReport = {
  scannedFiles: number;
  removedFiles: number;
  keptFiles: number;
  removedBytes: number;
  keptBytes: number;
  retainCount: number;
  retainDays?: number | null;
  removed: DatabaseBackupFile[];
};
