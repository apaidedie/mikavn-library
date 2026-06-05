export type PlayStatus = 'planned' | 'playing' | 'completed' | 'paused' | 'archived';

export type Game = {
  id: string;
  title: string;
  originalTitle?: string | null;
  aliases: string[];
  developer?: string | null;
  publisher?: string | null;
  brand?: string | null;
  releaseDate?: string | null;
  description?: string | null;
  notes?: string | null;
  tags: string[];
  genres: string[];
  rating?: number | null;
  ageRating?: string | null;
  playStatus: PlayStatus;
  favorite: boolean;
  hidden: boolean;
  installPath: string;
  executablePath?: string | null;
  workingDirectory?: string | null;
  launchArgs?: string | null;
  pathStatus: 'unknown' | 'ok' | 'incomplete' | 'broken' | string;
  lastPathCheckedAt?: string | null;
  coverImage?: string | null;
  bannerImage?: string | null;
  backgroundImage?: string | null;
  vndbId?: string | null;
  bangumiId?: string | null;
  dlsiteId?: string | null;
  fanzaId?: string | null;
  ymgalId?: string | null;
  totalPlaySeconds: number;
  lastPlayedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GameFilter = {
  query?: string;
  status?: PlayStatus | 'all';
  tag?: string;
  developer?: string;
  favorite?: boolean;
  hidden?: boolean;
  metadataStatus?: 'all' | 'complete' | 'needs_metadata' | 'missing_description' | 'missing_cover' | 'missing_banner' | 'missing_background' | 'missing_artwork' | 'missing_description_image' | 'missing_external_id' | string;
  pathStatus?: 'all' | 'unknown' | 'ok' | 'incomplete' | 'broken' | string;
  collectionId?: string;
  sortBy?: 'title' | 'created_at' | 'updated_at' | 'last_played_at' | 'release_date' | 'rating';
  sortDirection?: 'asc' | 'desc';
};

export type GameCollection = {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  gameCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CollectionInput = {
  name: string;
  description?: string;
  color?: string;
};

export type CollectionGameLink = {
  collectionId: string;
  gameId: string;
  addedAt: string;
};

export type PathCheckItem = {
  kind: string;
  label: string;
  path?: string | null;
  status: 'ok' | 'missing' | 'wrong_type' | 'not_configured' | string;
  message?: string | null;
};

export type GamePathHealth = {
  gameId: string;
  status: 'ok' | 'incomplete' | 'broken' | string;
  checkedAt: string;
  items: PathCheckItem[];
};

export type GameFormInput = {
  title: string;
  originalTitle?: string;
  aliases?: string[];
  developer?: string;
  publisher?: string;
  brand?: string;
  releaseDate?: string;
  description?: string;
  notes?: string;
  tags?: string[];
  genres?: string[];
  rating?: number | null;
  ageRating?: string;
  playStatus?: PlayStatus;
  favorite?: boolean;
  hidden?: boolean;
  installPath: string;
  executablePath?: string;
  workingDirectory?: string;
  launchArgs?: string;
  coverImage?: string;
  bannerImage?: string;
  backgroundImage?: string;
  vndbId?: string;
  bangumiId?: string;
  dlsiteId?: string;
  fanzaId?: string;
  ymgalId?: string;
  pathStatus?: string;
  lastPathCheckedAt?: string | null;
};

export type AddGameInput = GameFormInput;
export type UpdateGameInput = Partial<GameFormInput>;

export type GameAsset = {
  id: string;
  gameId: string;
  assetType: 'cover' | 'banner' | 'background' | 'screenshot' | string;
  uri: string;
  source?: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AssetInput = {
  assetType: string;
  uri: string;
  source?: string;
  isPrimary?: boolean;
};

export type AssetImportInput = {
  assetType: string;
  sourcePath: string;
  isPrimary?: boolean;
};

export type AssetDownloadInput = {
  assetType: string;
  url: string;
  isPrimary?: boolean;
};

export type AssetCacheCleanupResult = {
  scannedFiles: number;
  removedFiles: number;
  keptFiles: number;
  removedBytes: number;
  keptBytes: number;
};

export type TagRecord = {
  id: string;
  name: string;
  kind: 'tag' | 'genre' | string;
  gameCount: number;
  createdAt: string;
  updatedAt: string;
};

export type LibraryRoot = {
  id: string;
  path: string;
  recursive: boolean;
  enabled: boolean;
  createdAt: string;
};

export type ScanExecutable = {
  path: string;
  name: string;
};

export type ScanCandidate = {
  id: string;
  rootPath: string;
  installPath: string;
  folderName: string;
  suggestedTitle: string;
  aliases: string[];
  executables: ScanExecutable[];
  selectedExecutable?: string | null;
  conflict?: ScanConflict | null;
};

export type ScanConflict = {
  gameId: string;
  title: string;
  reason: string;
};

export type ImportCandidate = {
  title: string;
  installPath: string;
  executablePath?: string | null;
  aliases?: string[];
  allowDuplicate?: boolean;
  conflictAction?: 'skip' | 'merge' | 'replace' | 'duplicate';
  conflictGameId?: string | null;
};

export type ImportScanReport = {
  requested: number;
  importedCount: number;
  added: number;
  merged: number;
  replaced: number;
  duplicated: number;
  skipped: number;
  imported: Game[];
  items: ImportScanReportItem[];
};

export type ImportScanReportItem = {
  candidateTitle: string;
  installPath: string;
  action: 'add' | 'merge' | 'replace' | 'duplicate' | 'skip' | string;
  gameId?: string | null;
  targetTitle?: string | null;
  conflictReason?: string | null;
  message: string;
};

export type DashboardData = {
  totalGames: number;
  plannedGames: number;
  playingGames: number;
  completedGames: number;
  totalPlaySeconds: number;
  weekPlaySeconds: number;
  monthPlaySeconds: number;
  recentGames: Game[];
  recentlyAdded: Game[];
};

export type PlaySession = {
  id: string;
  gameId: string;
  launchProfileId?: string | null;
  startedAt: string;
  endedAt?: string | null;
  durationSeconds: number;
  exitStatus?: string | null;
};

export const PLAY_STATUS_LABEL: Record<PlayStatus, string> = {
  planned: '想玩',
  playing: '游玩中',
  completed: '已通关',
  paused: '已搁置',
  archived: '封存',
};
