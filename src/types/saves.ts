export type SavePath = {
  id: string;
  gameId: string;
  label: string;
  path: string;
  createdAt: string;
};

export type SavePathCandidate = {
  label: string;
  path: string;
  reason: string;
  exists: boolean;
  alreadyAdded: boolean;
};

export type SaveBackup = {
  id: string;
  gameId: string;
  savePathId: string;
  label: string;
  sourcePath: string;
  backupPath: string;
  protection: boolean;
  createdAt: string;
};

export type SaveRestoreMode = 'merge' | 'mirror';

export type SaveRestorePreview = {
  mode: SaveRestoreMode | string;
  backupPath: string;
  savePath: string;
  backupFileCount: number;
  currentFileCount: number;
  newFiles: number;
  overwrittenFiles: number;
  keptFiles: number;
  removedFiles: number;
  sampleNewFiles: string[];
  sampleOverwrittenFiles: string[];
  sampleKeptFiles: string[];
  sampleRemovedFiles: string[];
};
