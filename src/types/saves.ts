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
