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
