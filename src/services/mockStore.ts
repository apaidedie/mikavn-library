import type { AddGameInput, AssetCacheCleanupResult, AssetDownloadInput, AssetImportInput, AssetInput, CollectionGameLink, CollectionInput, DashboardData, Game, GameAsset, GameCollection, GameFilter, GamePathHealth, ImportCandidate, ImportScanReport, ImportScanReportItem, LibraryRoot, PathCheckItem, PlaySession, PlayStatus, ScanCandidate, ScanConflict, TagRecord, UpdateGameInput } from '@/types/game';
import type { AppDataDiagnostics, DatabaseBackupCleanupPolicy, DatabaseBackupCleanupReport, LibraryArchiveExportOptions, LibraryArchiveImportOptions, LibraryArchivePreview, LogRecord, LogRetentionPolicy } from '@/types/archive';
import type { LaunchProfile, LaunchProfileInput, LaunchProfileUpdate } from '@/types/launch';
import type { AdvancedSearchInput, AdvancedSearchResult, AiConnectionTestResult, AiRecognitionResult, ApplyMetadataFields, BatchMatchJob, BatchMatchStatus, DescriptionImageRepairOptions, DescriptionImageRepairPreview, DuplicateExternalIdAuditOptions, DuplicateExternalIdGroup, DuplicateExternalIdPreview, ExternalIdRecord, FieldLock, MatchSuggestion, MetadataProvider, MetadataSearchResponse, MetadataSearchResult, MetadataSourceRecord, NormalizedMetadata, SavedSearch, SavedSearchInput, SearchClause, SearchQueryValidation } from '@/types/metadata';
import type { SaveBackup, SavePath, SavePathCandidate } from '@/types/saves';
import type { ScanTaskStatus, TaskDetail, TaskLogEntry, TaskRecord } from '@/types/task';
import sampleHeroUrl from '@/assets/hero.png';

const STORAGE_KEY = 'mikavn-library.mock.games';
const BATCH_KEY = 'mikavn-library.mock.batch';
const SETTINGS_KEY = 'mikavn-library.mock.settings';
const SAVE_PATHS_KEY = 'mikavn-library.mock.savePaths';
const SAVE_BACKUPS_KEY = 'mikavn-library.mock.saveBackups';
const PLAY_SESSIONS_KEY = 'mikavn-library.mock.playSessions';
const SCAN_TASKS_KEY = 'mikavn-library.mock.scanTasks';
const TASKS_KEY = 'mikavn-library.mock.tasks';
const TASK_LOGS_KEY = 'mikavn-library.mock.taskLogs';
const LAUNCH_PROFILES_KEY = 'mikavn-library.mock.launchProfiles';
const FIELD_LOCKS_KEY = 'mikavn-library.mock.fieldLocks';
const COLLECTIONS_KEY = 'mikavn-library.mock.collections';
const COLLECTION_GAMES_KEY = 'mikavn-library.mock.collectionGames';
const ASSETS_KEY = 'mikavn-library.mock.assets';
const LIBRARY_ROOTS_KEY = 'mikavn-library.mock.libraryRoots';
const SAVED_SEARCHES_KEY = 'mikavn-library.mock.savedSearches';

const defaultSettings: Record<string, string> = {
  provider_vndb_enabled: 'true',
  provider_dlsite_enabled: 'true',
  provider_fanza_enabled: 'true',
  ai_base_url: '',
  ai_model: 'gpt-4o-mini',
  ui_accent_color: 'vnite',
  ui_theme_mode: 'dark',
  privacy_hide_hidden: 'false',
  privacy_blur_covers: 'false',
  privacy_filter_reports: 'true',
  save_auto_backup_before_launch: 'false',
  save_auto_backup_after_exit: 'false',
};

const mockMetadata: MetadataSearchResult[] = [
  {
    provider: 'vndb',
    id: 'v29443',
    title: '終のステラ',
    url: 'https://vndb.org/v29443',
    imageUrl: null,
    description: '文明崩坏后的世界中，少女与运输员同行的视觉小说。',
    releaseDate: '2022-09-30',
    developers: ['Key'],
    tags: ['Post-apocalyptic', 'Android', 'Kinetic Novel'],
    externalIds: { vndb: 'v29443' },
    relevanceScore: 0.98,
    fromVndbSniff: false,
  },
  {
    provider: 'dlsite',
    id: 'RJ01000000',
    title: '星之终途 模拟条目',
    url: 'https://www.dlsite.com/maniax/work/=/product_id/RJ01000000.html',
    imageUrl: null,
    description: 'DLsite mock result for development preview.',
    releaseDate: '2022-09-30',
    developers: ['Key'],
    tags: ['ADV', '全年龄'],
    externalIds: { dlsite: 'RJ01000000' },
    relevanceScore: 0.74,
    fromVndbSniff: true,
  },
  {
    provider: 'fanza',
    id: 'key_0001',
    title: '星之终途 FANZA 模拟条目',
    url: 'https://dlsoft.dmm.co.jp/detail/key_0001/',
    imageUrl: null,
    description: 'FANZA mock result for development preview.',
    releaseDate: '2022-09-30',
    developers: ['Key'],
    tags: ['PCゲーム'],
    externalIds: { fanza: 'key_0001' },
    relevanceScore: 0.62,
    fromVndbSniff: false,
  },
];

const sampleGames: Game[] = [
  {
    id: 'sample-1',
    title: '星之终途',
    originalTitle: '終のステラ',
    aliases: ['[汉化硬盘版] 星之终途 v1.02'],
    developer: 'Key',
    publisher: 'Visual Arts',
    brand: 'Key',
    releaseDate: '2022-09-30',
    description: '末世旅途题材的短篇视觉小说。此条目是浏览器预览用示例数据。',
    notes: '这里可以记录攻略进度、补丁说明、通关感想和个人备注。',
    tags: ['全年龄', '科幻', '短篇'],
    genres: ['Visual Novel'],
    rating: 88,
    ageRating: '全年龄',
    playStatus: 'playing',
    favorite: true,
    hidden: false,
    installPath: 'D:\\Games\\VN\\星之终途',
    executablePath: 'D:\\Games\\VN\\星之终途\\stella.exe',
    workingDirectory: 'D:\\Games\\VN\\星之终途',
    launchArgs: null,
    pathStatus: 'unknown',
    lastPathCheckedAt: null,
    coverImage: sampleHeroUrl,
    bannerImage: sampleHeroUrl,
    backgroundImage: sampleHeroUrl,
    vndbId: 'v29443',
    bangumiId: null,
    dlsiteId: null,
    fanzaId: null,
    ymgalId: null,
    totalPlaySeconds: 12600,
    lastPlayedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function readGames() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleGames));
    return sampleGames;
  }

  try {
    return JSON.parse(raw) as Game[];
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleGames));
    return sampleGames;
  }
}

function writeGames(games: Game[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
}

function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeMockPath(value: string) {
  return value.trim().replace(/[/]+/g, '\\').replace(/[\\/]+$/g, '').toLowerCase();
}

function readSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return defaultSettings;
  }

  try {
    return { ...defaultSettings, ...JSON.parse(raw) as Record<string, string> };
  } catch {
    return defaultSettings;
  }
}

function cleanTitle(value: string) {
  return value
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[【「『（《〈][^】」』）》〉]*[】」』）》〉]/g, ' ')
    .replace(/(?:汉化硬盘版|汉化版|硬盘版|绿色版|中文版|DL版|パッケージ版)/g, ' ')
    .replace(/v(?:er)?\.?\s*[\d.]+[a-z]?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function score(query: string, title: string) {
  const normalize = (text: string) => text.toLowerCase().replace(/[\s○×★☆◆◇■□▲△▼▽♀♂♪♡♥！!？?…．.、，,：:；;]/g, '');
  const q = normalize(query);
  const t = normalize(title);
  if (!q || !t) return 0;
  if (q === t) return 1;
  if (t.includes(q)) return 0.7 + 0.3 * (q.length / Math.max(t.length, 1));
  const chars = [...new Set(q.split(''))];
  return (chars.filter((char) => t.includes(char)).length / chars.length) * 0.6;
}

function parseMockSearch(query: string): SearchClause[] {
  return query
    .match(/"[^"]+"|'[^']+'|\S+/g)?.map((raw) => raw.replace(/^['"]|['"]$/g, '')).filter((token) => token.toUpperCase() !== 'OR' && token.toUpperCase() !== 'AND')
    .map((raw): SearchClause => {
      const negated = raw.startsWith('-');
      const token = negated ? raw.slice(1) : raw;
      const comparison = token.match(/^([a-z_]+)(>=|<=|>|<|=)(.+)$/i);
      if (comparison) return { kind: 'comparison', field: normalizeMockSearchField(comparison[1]), operator: comparison[2], value: comparison[3], negated };
      const field = token.match(/^([a-z_]+):(.+)$/i);
      if (field) return { kind: 'field', field: normalizeMockSearchField(field[1]), operator: null, value: field[2], negated };
      return { kind: 'term', field: null, operator: null, value: token, negated };
    }) ?? [];
}

function normalizeMockSearchField(field: string) {
  const normalized = field.toLowerCase();
  if (normalized === 'developer') return 'dev';
  if (normalized === 'released' || normalized === 'release' || normalized === 'date') return 'released';
  if (normalized === 'played' || normalized === 'last_played') return 'played';
  if (normalized === 'metadata') return 'meta';
  if (['tag', 'genre', 'dev', 'publisher', 'brand', 'status', 'path', 'meta', 'collection', 'age', 'rating', 'playtime'].includes(normalized)) return normalized;
  return 'unsupported';
}

function mockMatchesClause(game: Game, clause: SearchClause) {
  const value = clause.value.toLowerCase();
  if (clause.kind === 'comparison') {
    const expected = Number.parseFloat(value.replace(/[hm]$/, ''));
    const actual = clause.field === 'rating' ? game.rating ?? -1 : clause.field === 'playtime' ? game.totalPlaySeconds / (value.endsWith('m') ? 60 : 3600) : 0;
    switch (clause.operator) {
      case '>=': return actual >= expected;
      case '<=': return actual <= expected;
      case '>': return actual > expected;
      case '<': return actual < expected;
      default: return actual === expected;
    }
  }
  const fields = [game.title, game.originalTitle, game.developer, game.publisher, game.brand, game.description, game.notes, game.installPath, game.pathStatus, ...game.aliases, ...game.tags, ...game.genres].filter(Boolean).join(' ').toLowerCase();
  if (clause.kind === 'term') return fields.includes(value);
  switch (clause.field) {
    case 'tag': return game.tags.some((item) => item.toLowerCase().includes(value));
    case 'genre': return game.genres.some((item) => item.toLowerCase().includes(value));
    case 'dev': return [game.developer, game.brand].some((item) => item?.toLowerCase().includes(value));
    case 'publisher': return Boolean(game.publisher?.toLowerCase().includes(value));
    case 'brand': return Boolean(game.brand?.toLowerCase().includes(value));
    case 'status': return game.playStatus === value;
    case 'path': return game.pathStatus === value || game.installPath.toLowerCase().includes(value);
    case 'meta': return value === 'complete' ? Boolean(game.coverImage && game.description && game.releaseDate && (game.vndbId || game.dlsiteId || game.fanzaId)) : true;
    case 'age': return Boolean(game.ageRating?.toLowerCase().includes(value));
    default: return fields.includes(value);
  }
}

function readTasks() {
  return readJson<TaskRecord[]>(TASKS_KEY, []);
}

function writeTasks(tasks: TaskRecord[]) {
  writeJson(TASKS_KEY, tasks);
}

function addTaskLog(taskId: string, level: TaskLogEntry['level'], message: string) {
  const logs = readJson<Record<string, TaskLogEntry[]>>(TASK_LOGS_KEY, {});
  const entry: TaskLogEntry = {
    id: crypto.randomUUID(),
    taskId,
    level,
    message,
    createdAt: new Date().toISOString(),
  };
  writeJson(TASK_LOGS_KEY, { ...logs, [taskId]: [...(logs[taskId] ?? []), entry] });
  return entry;
}

function recordTask(task: TaskRecord, logs: string[] = []) {
  writeTasks([task, ...readTasks().filter((item) => item.id !== task.id)].slice(0, 100));
  for (const log of logs) addTaskLog(task.id, task.status === 'failed' ? 'error' : 'info', log);
  return task;
}

function makeTask(input: {
  taskType: string;
  status?: TaskRecord['status'];
  progress?: number;
  message?: string | null;
  error?: string | null;
  retryPayload?: string | null;
  retryable?: boolean;
}) {
  const now = new Date().toISOString();
  return recordTask({
    id: crypto.randomUUID(),
    taskType: input.taskType,
    status: input.status ?? 'completed',
    progress: input.progress ?? 1,
    message: input.message ?? null,
    error: input.error ?? null,
    retryPayload: input.retryPayload ?? null,
    retryable: input.retryable ?? false,
    createdAt: now,
    updatedAt: now,
  }, [input.message ?? '任务已记录'].filter(Boolean) as string[]);
}

function toMetadata(result: MetadataSearchResult): NormalizedMetadata {
  return {
    provider: result.provider,
    id: result.id,
    title: result.title,
    originalTitle: result.provider === 'vndb' ? result.title : null,
    aliases: [],
    description: result.description,
    releaseDate: result.releaseDate,
    developers: result.developers,
    publishers: [],
    tags: result.tags,
    genres: ['Visual Novel'],
    images: result.imageUrl ? [result.imageUrl] : [],
    externalIds: result.externalIds,
    ageRating: null,
  };
}

function cleanList(values?: string[]) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function makeGame(input: AddGameInput): Game {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    originalTitle: input.originalTitle?.trim() || null,
    aliases: cleanList(input.aliases),
    developer: input.developer?.trim() || null,
    publisher: input.publisher?.trim() || null,
    brand: input.brand?.trim() || null,
    releaseDate: input.releaseDate?.trim() || null,
    description: input.description?.trim() || null,
    notes: input.notes?.trim() || null,
    tags: cleanList(input.tags),
    genres: cleanList(input.genres),
    rating: input.rating ?? null,
    ageRating: input.ageRating?.trim() || null,
    playStatus: input.playStatus ?? 'planned',
    favorite: Boolean(input.favorite),
    hidden: Boolean(input.hidden),
    installPath: input.installPath.trim(),
    executablePath: input.executablePath?.trim() || null,
    workingDirectory: input.workingDirectory?.trim() || input.installPath.trim(),
    launchArgs: input.launchArgs?.trim() || null,
    pathStatus: 'unknown',
    lastPathCheckedAt: null,
    coverImage: input.coverImage?.trim() || null,
    bannerImage: input.bannerImage?.trim() || null,
    backgroundImage: input.backgroundImage?.trim() || null,
    vndbId: input.vndbId?.trim() || null,
    bangumiId: input.bangumiId?.trim() || null,
    dlsiteId: input.dlsiteId?.trim() || null,
    fanzaId: input.fanzaId?.trim() || null,
    ymgalId: input.ymgalId?.trim() || null,
    totalPlaySeconds: 0,
    lastPlayedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function ensureGameDefaults(game: Game): Game {
  const sampleMedia = game.id === 'sample-1' ? sampleHeroUrl : null;
  return {
    ...game,
    notes: game.notes ?? null,
    pathStatus: game.pathStatus ?? 'unknown',
    lastPathCheckedAt: game.lastPathCheckedAt ?? null,
    coverImage: game.coverImage ?? sampleMedia,
    bannerImage: game.bannerImage ?? sampleMedia,
    backgroundImage: game.backgroundImage ?? sampleMedia,
  };
}

function externalIdCount(game: Game) {
  return [game.vndbId, game.bangumiId, game.dlsiteId, game.fanzaId, game.ymgalId].filter((value) => value?.trim()).length;
}

function mockExternalIdEntries(options: DuplicateExternalIdAuditOptions = {}) {
  const providers = (options.providers ?? []).map((provider) => String(provider).trim().toLowerCase()).filter(Boolean);
  const providerSet = providers.length && !providers.includes('all') ? new Set(providers) : null;
  const entries: Array<{ provider: string; externalId: string; normalizedExternalId: string; game: Game; source: string }> = [];
  const push = (game: Game, provider: string, externalId: string | null | undefined, source: string) => {
    const cleanProvider = provider.trim().toLowerCase();
    const cleanId = externalId?.trim();
    if (!cleanId || (providerSet && !providerSet.has(cleanProvider))) return;
    entries.push({ provider: cleanProvider, externalId: cleanId, normalizedExternalId: cleanId.toLowerCase(), game, source });
  };
  for (const game of readGames().map(ensureGameDefaults)) {
    push(game, 'vndb', game.vndbId, 'games.vndbId');
    push(game, 'bangumi', game.bangumiId, 'games.bangumiId');
    push(game, 'dlsite', game.dlsiteId, 'games.dlsiteId');
    push(game, 'fanza', game.fanzaId, 'games.fanzaId');
    push(game, 'ymgal', game.ymgalId, 'games.ymgalId');
  }
  return entries;
}

function mockDuplicateExternalIdPreview(options: DuplicateExternalIdAuditOptions = {}): DuplicateExternalIdPreview {
  const limit = Math.max(1, Math.min(Number(options.limit ?? 50) || 50, 500));
  const groups = new Map<string, DuplicateExternalIdGroup>();
  for (const entry of mockExternalIdEntries(options)) {
    const key = `${entry.provider}:${entry.normalizedExternalId}`;
    const group = groups.get(key) ?? { provider: entry.provider, externalId: entry.externalId, gameCount: 0, games: [] };
    const existing = group.games.find((game) => game.gameId === entry.game.id);
    if (existing) {
      if (!existing.sources.includes(entry.source)) existing.sources.push(entry.source);
    } else {
      group.games.push({ gameId: entry.game.id, title: entry.game.title, installPath: entry.game.installPath, sources: [entry.source] });
      group.gameCount = group.games.length;
    }
    groups.set(key, group);
  }
  const duplicateGroups = [...groups.values()]
    .filter((group) => group.games.length > 1)
    .sort((left, right) => right.gameCount - left.gameCount || left.provider.localeCompare(right.provider) || left.externalId.localeCompare(right.externalId));
  const totalGames = new Set(duplicateGroups.flatMap((group) => group.games.map((game) => game.gameId))).size;
  return { groups: duplicateGroups.slice(0, limit), totalGroups: duplicateGroups.length, totalGames };
}

function hasMockDescriptionImage(value?: string | null) {
  return Boolean(value?.match(/!\[[^\]]*\]\([^)]+\)|<img\b|\[img\]|https?:\/\/\S+\.(?:png|jpe?g|webp|gif)/i));
}

function mockDescriptionImageCandidates(options: DescriptionImageRepairOptions = {}) {
  const provider = String(options.provider ?? 'all').toLowerCase();
  const limit = Math.max(1, Math.min(Number(options.limit ?? 20) || 20, 200));
  return readGames().map(ensureGameDefaults)
    .filter((game) => game.description?.trim() && !hasMockDescriptionImage(game.description))
    .flatMap((game) => {
      if ((provider === 'all' || provider === 'dlsite') && game.dlsiteId) {
        return [{ gameId: game.id, title: game.title, provider: 'dlsite', providerId: game.dlsiteId }];
      }
      if ((provider === 'all' || provider === 'fanza') && game.fanzaId) {
        return [{ gameId: game.id, title: game.title, provider: 'fanza', providerId: game.fanzaId }];
      }
      return [];
    })
    .slice(0, limit);
}

function metadataStatusMatches(game: Game, status?: string) {
  if (!status || status === 'all') return true;
  const hasDeveloper = Boolean(game.developer?.trim() || game.brand?.trim());
  const complete = Boolean(game.description?.trim() && game.releaseDate?.trim() && hasDeveloper && game.coverImage?.trim() && externalIdCount(game) > 0);
  if (status === 'complete') return complete;
  if (status === 'missing_cover') return !game.coverImage?.trim();
  if (status === 'missing_external_id') return externalIdCount(game) === 0;
  if (status === 'needs_metadata') return !complete;
  return true;
}

function readCollections() {
  return readJson<GameCollection[]>(COLLECTIONS_KEY, []);
}

function writeCollections(collections: GameCollection[]) {
  writeJson(COLLECTIONS_KEY, collections);
}

function readCollectionLinks() {
  return readJson<CollectionGameLink[]>(COLLECTION_GAMES_KEY, []);
}

function writeCollectionLinks(links: CollectionGameLink[]) {
  writeJson(COLLECTION_GAMES_KEY, links);
}

function withCollectionCounts(collections = readCollections()) {
  const links = readCollectionLinks();
  return collections.map((collection) => ({
    ...collection,
    gameCount: links.filter((link) => link.collectionId === collection.id).length,
  }));
}

function readAssets() {
  return readJson<GameAsset[]>(ASSETS_KEY, []);
}

function writeAssets(assets: GameAsset[]) {
  writeJson(ASSETS_KEY, assets);
}

function syncGameCompatibilityAssets(game: Game) {
  const now = new Date().toISOString();
  const existing = readAssets().filter((asset) => asset.gameId !== game.id || asset.source !== 'games');
  const assets: GameAsset[] = [
    ['cover', game.coverImage],
    ['banner', game.bannerImage],
    ['background', game.backgroundImage],
  ].flatMap(([assetType, uri]) => uri ? [{
    id: crypto.randomUUID(),
    gameId: game.id,
    assetType: assetType as string,
    uri: String(uri),
    source: 'games',
    isPrimary: true,
    createdAt: now,
    updatedAt: now,
  }] : []);
  writeAssets([...assets, ...existing]);
}

function syncGameTags(games = readGames()) {
  const counts = new Map<string, TagRecord>();
  for (const game of games) {
    for (const [kind, values] of [['tag', game.tags], ['genre', game.genres]] as const) {
      for (const name of cleanList(values)) {
        const key = `${kind}:${name}`;
        const existing = counts.get(key);
        counts.set(key, {
          id: `${kind}:${encodeURIComponent(name)}`,
          name,
          kind,
          gameCount: (existing?.gameCount ?? 0) + 1,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }
  return [...counts.values()].sort((a, b) => b.gameCount - a.gameCount || a.name.localeCompare(b.name, 'zh-CN'));
}

export const mockStore = {
  listGames(filter: GameFilter = {}) {
    const query = filter.query?.trim().toLocaleLowerCase() ?? '';
    const status = filter.status;
    const tag = filter.tag?.trim().toLocaleLowerCase();
    const developer = filter.developer?.trim().toLocaleLowerCase();
    const collectionGameIds = filter.collectionId ? new Set(readCollectionLinks().filter((link) => link.collectionId === filter.collectionId).map((link) => link.gameId)) : null;
    const sortBy = filter.sortBy ?? 'updated_at';
    const sortDirection = filter.sortDirection ?? 'desc';

    const games = readGames()
      .map(ensureGameDefaults)
      .filter((game) => {
        const text = [game.title, game.originalTitle, game.developer, game.brand, ...game.aliases, ...game.tags]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase();

        const matchesQuery = !query || text.includes(query);
        const matchesStatus = !status || status === 'all' || game.playStatus === status;
        const matchesTag = !tag || [...game.tags, ...game.genres].some((item) => item.toLocaleLowerCase() === tag);
        const matchesDeveloper = !developer || [game.developer, game.brand, game.publisher].some((item) => item?.toLocaleLowerCase() === developer);
        const matchesFavorite = filter.favorite == null || game.favorite === filter.favorite;
        const matchesHidden = filter.hidden == null || game.hidden === filter.hidden;
        const matchesMetadata = metadataStatusMatches(game, filter.metadataStatus);
        const matchesPathStatus = !filter.pathStatus || filter.pathStatus === 'all' || game.pathStatus === filter.pathStatus;
        const matchesCollection = !collectionGameIds || collectionGameIds.has(game.id);
        return matchesQuery && matchesStatus && matchesTag && matchesDeveloper && matchesFavorite && matchesHidden && matchesMetadata && matchesPathStatus && matchesCollection;
      })
      .sort((a, b) => {
        const pick = (game: Game) => {
          switch (sortBy) {
            case 'title':
              return game.title;
            case 'created_at':
              return game.createdAt;
            case 'last_played_at':
              return game.lastPlayedAt ?? '';
            case 'release_date':
              return game.releaseDate ?? '';
            case 'rating':
              return game.rating ?? -1;
            case 'updated_at':
            default:
              return game.updatedAt;
          }
        };

        const left = pick(a);
        const right = pick(b);
        const result = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right), 'zh-CN');
        return sortDirection === 'asc' ? result : -result;
      });

    return Promise.resolve(games);
  },

  getGame(id: string) {
    const game = readGames().map(ensureGameDefaults).find((item) => item.id === id);
    return game ? Promise.resolve(game) : Promise.reject(new Error('Game not found'));
  },

  async checkGamePaths(id: string): Promise<GamePathHealth> {
    const game = await this.getGame(id);
    const checkedAt = new Date().toISOString();
    const item = (kind: string, label: string, path?: string | null): PathCheckItem => ({
      kind,
      label,
      path: path ?? null,
      status: path ? 'ok' : 'not_configured',
      message: path ? null : '未配置',
    });
    const items = [
      item('install', '安装目录', game.installPath),
      item('executable', '启动程序', game.executablePath),
      item('workingDirectory', '工作目录', game.workingDirectory),
    ];
    const status = items.some((entry) => entry.status === 'not_configured') ? 'incomplete' : 'ok';
    await this.updateGame(id, { pathStatus: status, lastPathCheckedAt: checkedAt } as UpdateGameInput);
    return { gameId: id, status, checkedAt, items };
  },

  async checkGamePathsTask(id: string): Promise<TaskRecord> {
    const payload = JSON.stringify({ gameId: id });
    try {
      const health = await this.checkGamePaths(id);
      return makeTask({
        taskType: 'game.path_check',
        status: 'completed',
        progress: 1,
        message: health.status === 'ok' ? '路径检查完成，所有关键路径可用。' : health.status === 'broken' ? '路径检查完成，发现不可用路径。' : '路径检查完成，有部分路径尚未配置。',
        retryPayload: payload,
        retryable: true,
      });
    } catch (reason) {
      return makeTask({
        taskType: 'game.path_check',
        status: 'failed',
        progress: 1,
        message: '路径检查失败',
        error: reason instanceof Error ? reason.message : String(reason),
        retryPayload: payload,
        retryable: true,
      });
    }
  },

  async relocateGamePaths(id: string, installPath: string): Promise<Game> {
    const game = await this.getGame(id);
    const rewrite = (value?: string | null) => value?.startsWith(game.installPath) ? value.replace(game.installPath, installPath) : value;
    return this.updateGame(id, {
      installPath,
      executablePath: rewrite(game.executablePath) ?? undefined,
      workingDirectory: rewrite(game.workingDirectory) ?? installPath,
      pathStatus: 'unknown',
      lastPathCheckedAt: undefined,
    } as UpdateGameInput);
  },

  revealPath(path: string): Promise<void> {
    if (!path.trim()) return Promise.reject(new Error('Path is required'));
    return Promise.resolve();
  },

  addGame(input: AddGameInput) {
    const games = readGames();
    const game = makeGame(input);
    writeGames([game, ...games]);
    syncGameCompatibilityAssets(game);
    return Promise.resolve(game);
  },

  updateGame(id: string, input: UpdateGameInput) {
    const games = readGames();
    let updated: Game | undefined;
    const next = games.map((game) => {
      if (game.id !== id) {
        return game;
      }

      updated = {
        ...game,
        ...input,
        aliases: input.aliases ? cleanList(input.aliases) : game.aliases,
        tags: input.tags ? cleanList(input.tags) : game.tags,
        genres: input.genres ? cleanList(input.genres) : game.genres,
        favorite: input.favorite ?? game.favorite,
        hidden: input.hidden ?? game.hidden,
        playStatus: (input.playStatus ?? game.playStatus) as PlayStatus,
        updatedAt: new Date().toISOString(),
      };
      return updated;
    });

    if (!updated) {
      return Promise.reject(new Error('Game not found'));
    }

    writeGames(next);
    syncGameCompatibilityAssets(updated);
    return Promise.resolve(updated);
  },

  deleteGameRecord(id: string) {
    writeGames(readGames().filter((game) => game.id !== id));
    writeCollectionLinks(readCollectionLinks().filter((link) => link.gameId !== id));
    return Promise.resolve();
  },

  listCollections() {
    return Promise.resolve(withCollectionCounts().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  },

  listGameAssets(gameId: string) {
    const game = readGames().map(ensureGameDefaults).find((item) => item.id === gameId);
    if (game) syncGameCompatibilityAssets(game);
    return Promise.resolve(readAssets().filter((asset) => asset.gameId === gameId).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || b.updatedAt.localeCompare(a.updatedAt)));
  },

  upsertGameAsset(gameId: string, input: AssetInput) {
    const uri = input.uri.trim();
    if (!uri) return Promise.reject(new Error('Asset uri is required'));
    const assetType = input.assetType.trim() || 'cover';
    const now = new Date().toISOString();
    const assets = readAssets().filter((asset) => !(asset.gameId === gameId && asset.assetType === assetType && asset.uri === uri));
    const nextAssets = input.isPrimary !== false ? assets.map((asset) => asset.gameId === gameId && asset.assetType === assetType ? { ...asset, isPrimary: false } : asset) : assets;
    const asset: GameAsset = {
      id: crypto.randomUUID(),
      gameId,
      assetType,
      uri,
      source: input.source?.trim() || 'manual',
      isPrimary: input.isPrimary !== false,
      createdAt: now,
      updatedAt: now,
    };
    writeAssets([asset, ...nextAssets]);
    if (asset.isPrimary) {
      const field = assetType === 'cover' ? 'coverImage' : assetType === 'banner' ? 'bannerImage' : assetType === 'background' ? 'backgroundImage' : null;
      if (field) void this.updateGame(gameId, { [field]: uri } as UpdateGameInput);
    }
    return Promise.resolve(asset);
  },

  removeGameAsset(id: string) {
    const asset = readAssets().find((item) => item.id === id);
    if (!asset) return Promise.reject(new Error('Asset not found'));
    writeAssets(readAssets().filter((item) => item.id !== id));
    const field = asset.assetType === 'cover' ? 'coverImage' : asset.assetType === 'banner' ? 'bannerImage' : asset.assetType === 'background' ? 'backgroundImage' : null;
    if (field && asset.isPrimary) {
      return this.updateGame(asset.gameId, { [field]: '' } as UpdateGameInput);
    }
    return this.getGame(asset.gameId);
  },

  setPrimaryAsset(id: string) {
    const asset = readAssets().find((item) => item.id === id);
    if (!asset) return Promise.reject(new Error('Asset not found'));
    writeAssets(readAssets().map((item) => item.gameId === asset.gameId && item.assetType === asset.assetType ? { ...item, isPrimary: item.id === id, updatedAt: new Date().toISOString() } : item));
    const field = asset.assetType === 'cover' ? 'coverImage' : asset.assetType === 'banner' ? 'bannerImage' : asset.assetType === 'background' ? 'backgroundImage' : null;
    return field ? this.updateGame(asset.gameId, { [field]: asset.uri } as UpdateGameInput) : this.getGame(asset.gameId);
  },

  importGameAssetFromPath(gameId: string, input: AssetImportInput) {
    return this.upsertGameAsset(gameId, { assetType: input.assetType, uri: input.sourcePath, source: 'user', isPrimary: input.isPrimary });
  },

  downloadGameAsset(gameId: string, input: AssetDownloadInput) {
    return this.upsertGameAsset(gameId, { assetType: input.assetType, uri: input.url, source: 'download', isPrimary: input.isPrimary });
  },

  cleanupAssetCache(): Promise<AssetCacheCleanupResult> {
    const assets = readAssets();
    return Promise.resolve({ scannedFiles: assets.length, removedFiles: 0, keptFiles: assets.length });
  },

  listTags(kind?: string) {
    return Promise.resolve(syncGameTags().filter((tag) => !kind || tag.kind === kind));
  },

  renameTag(id: string, name: string): Promise<TagRecord> {
    const tag = syncGameTags().find((item) => item.id === id);
    if (!tag) return Promise.reject(new Error('Tag not found'));
    const nextName = name.trim();
    if (!nextName) return Promise.reject(new Error('Tag name is required'));
    writeGames(readGames().map((game) => ({
      ...game,
      tags: tag.kind === 'tag' ? game.tags.map((item) => item === tag.name ? nextName : item) : game.tags,
      genres: tag.kind === 'genre' ? game.genres.map((item) => item === tag.name ? nextName : item) : game.genres,
      updatedAt: new Date().toISOString(),
    })));
    const renamed = syncGameTags().find((item) => item.name === nextName && item.kind === tag.kind);
    return renamed ? Promise.resolve(renamed) : Promise.reject(new Error('Tag rename failed'));
  },

  mergeTags(sourceIds: string[], targetId: string): Promise<TagRecord> {
    const tags = syncGameTags();
    const target = tags.find((item) => item.id === targetId);
    if (!target) return Promise.reject(new Error('Target tag not found'));
    const sources = tags.filter((item) => sourceIds.includes(item.id) && item.kind === target.kind && item.id !== target.id);
    writeGames(readGames().map((game) => {
      const field = target.kind === 'tag' ? 'tags' : 'genres';
      const values = game[field].map((item) => sources.some((source) => source.name === item) ? target.name : item);
      return { ...game, [field]: cleanList(values), updatedAt: new Date().toISOString() };
    }));
    const merged = syncGameTags().find((item) => item.name === target.name && item.kind === target.kind);
    return merged ? Promise.resolve(merged) : Promise.reject(new Error('Tag merge failed'));
  },

  deleteTag(id: string) {
    const tag = syncGameTags().find((item) => item.id === id);
    if (!tag) return Promise.reject(new Error('Tag not found'));
    writeGames(readGames().map((game) => ({
      ...game,
      tags: tag.kind === 'tag' ? game.tags.filter((item) => item !== tag.name) : game.tags,
      genres: tag.kind === 'genre' ? game.genres.filter((item) => item !== tag.name) : game.genres,
      updatedAt: new Date().toISOString(),
    })));
    return Promise.resolve();
  },

  createCollection(input: CollectionInput) {
    const now = new Date().toISOString();
    const name = input.name.trim();
    if (!name) return Promise.reject(new Error('Collection name is required'));
    const collection: GameCollection = {
      id: crypto.randomUUID(),
      name,
      description: input.description?.trim() || null,
      color: input.color?.trim() || null,
      gameCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    writeCollections([collection, ...readCollections().filter((item) => item.name !== name)]);
    return Promise.resolve(collection);
  },

  updateCollection(id: string, input: Partial<CollectionInput>) {
    const collections = readCollections();
    const existing = collections.find((item) => item.id === id);
    if (!existing) return Promise.reject(new Error('Collection not found'));
    const next: GameCollection = {
      ...existing,
      name: input.name != null ? input.name.trim() : existing.name,
      description: input.description != null ? input.description.trim() || null : existing.description,
      color: input.color != null ? input.color.trim() || null : existing.color,
      updatedAt: new Date().toISOString(),
    };
    if (!next.name) return Promise.reject(new Error('Collection name is required'));
    writeCollections(collections.map((item) => item.id === id ? next : item));
    return Promise.resolve(withCollectionCounts([next])[0]);
  },

  deleteCollection(id: string) {
    writeCollections(readCollections().filter((item) => item.id !== id));
    writeCollectionLinks(readCollectionLinks().filter((link) => link.collectionId !== id));
    return Promise.resolve();
  },

  listCollectionGames(collectionId: string) {
    const ids = new Set(readCollectionLinks().filter((link) => link.collectionId === collectionId).map((link) => link.gameId));
    return Promise.resolve(readGames().map(ensureGameDefaults).filter((game) => ids.has(game.id)));
  },

  addGameToCollection(collectionId: string, gameId: string) {
    const collection = readCollections().find((item) => item.id === collectionId);
    if (!collection) return Promise.reject(new Error('Collection not found'));
    if (!readGames().some((game) => game.id === gameId)) return Promise.reject(new Error('Game not found'));
    const link: CollectionGameLink = { collectionId, gameId, addedAt: new Date().toISOString() };
    writeCollectionLinks([link, ...readCollectionLinks().filter((item) => !(item.collectionId === collectionId && item.gameId === gameId))]);
    writeCollections(readCollections().map((item) => item.id === collectionId ? { ...item, updatedAt: link.addedAt } : item));
    return Promise.resolve(link);
  },

  removeGameFromCollection(collectionId: string, gameId: string) {
    writeCollectionLinks(readCollectionLinks().filter((item) => !(item.collectionId === collectionId && item.gameId === gameId)));
    writeCollections(readCollections().map((item) => item.id === collectionId ? { ...item, updatedAt: new Date().toISOString() } : item));
    return Promise.resolve();
  },

  launchGame(id: string): Promise<PlaySession> {
    return this.launchGameWithProfile(id, null);
  },

  async launchGameWithProfile(id: string, profileId?: string | null): Promise<PlaySession> {
    const game = await this.getGame(id);
    const profiles = await this.listLaunchProfiles(id);
    const profile = profiles.find((item) => item.id === profileId) ?? profiles.find((item) => item.isDefault) ?? profiles[0];
    if (!profile?.executablePath) {
      return Promise.reject(new Error('Launch executable does not exist'));
    }
    if (profile.runnerType === 'locale_emulator' && !profile.localeEmulatorPath) {
      return Promise.reject(new Error('Locale Emulator path is required'));
    }
    const startedAt = new Date().toISOString();
    const durationSeconds = 1800;
    const endedAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
    const session: PlaySession = {
      id: crypto.randomUUID(),
      gameId: game.id,
      launchProfileId: profile.id.startsWith('legacy-') ? null : profile.id,
      startedAt,
      endedAt,
      durationSeconds,
      exitStatus: profile.runAsAdmin ? 'mock_elevated' : 'mock',
    };
    writeJson(PLAY_SESSIONS_KEY, [session, ...readJson<PlaySession[]>(PLAY_SESSIONS_KEY, [])].slice(0, 200));
    writeGames(readGames().map((item) => item.id === id ? { ...item, lastPlayedAt: startedAt, totalPlaySeconds: item.totalPlaySeconds + durationSeconds, updatedAt: startedAt } : item));
    return session;
  },

  listPlaySessions(gameId: string, limit = 50): Promise<PlaySession[]> {
    const sessions = readJson<PlaySession[]>(PLAY_SESSIONS_KEY, []).filter((session) => session.gameId === gameId);
    if (sessions.length === 0 && gameId === 'sample-1') {
      const startedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      return Promise.resolve([{
        id: 'mock-session-1',
        gameId,
        launchProfileId: null,
        startedAt,
        endedAt: new Date(Date.parse(startedAt) + 1800 * 1000).toISOString(),
        durationSeconds: 1800,
        exitStatus: '0',
      }]);
    }
    return Promise.resolve(sessions.slice(0, Math.max(1, Math.min(limit, 200))));
  },

  async listLaunchProfiles(gameId: string): Promise<LaunchProfile[]> {
    const profiles = readJson<LaunchProfile[]>(LAUNCH_PROFILES_KEY, []).filter((item) => item.gameId === gameId);
    if (profiles.length) return profiles.sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.createdAt.localeCompare(b.createdAt));

    const game = await this.getGame(gameId);
    if (!game.executablePath) return [];
    return [{
      id: `legacy-${game.id}`,
      gameId: game.id,
      name: '默认启动',
      executablePath: game.executablePath,
      workingDirectory: game.workingDirectory ?? game.installPath,
      arguments: game.launchArgs ?? null,
      environmentVariables: null,
      runnerType: 'direct',
      localeEmulatorPath: null,
      preLaunchCommand: null,
      postLaunchCommand: null,
      runAsAdmin: false,
      isDefault: true,
      compatibilityNotes: '来自旧版游戏启动字段',
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
    }];
  },

  createLaunchProfile(input: LaunchProfileInput): Promise<LaunchProfile> {
    const now = new Date().toISOString();
    const profiles = readJson<LaunchProfile[]>(LAUNCH_PROFILES_KEY, []);
    const firstForGame = !profiles.some((item) => item.gameId === input.gameId);
    const profile: LaunchProfile = {
      id: crypto.randomUUID(),
      gameId: input.gameId,
      name: input.name.trim() || '启动配置',
      executablePath: input.executablePath.trim(),
      workingDirectory: input.workingDirectory?.trim() || null,
      arguments: input.arguments?.trim() || null,
      environmentVariables: input.environmentVariables?.trim() || null,
      runnerType: input.runnerType || 'direct',
      localeEmulatorPath: input.localeEmulatorPath?.trim() || null,
      preLaunchCommand: input.preLaunchCommand?.trim() || null,
      postLaunchCommand: input.postLaunchCommand?.trim() || null,
      runAsAdmin: Boolean(input.runAsAdmin),
      isDefault: Boolean(input.isDefault) || firstForGame,
      compatibilityNotes: input.compatibilityNotes?.trim() || null,
      createdAt: now,
      updatedAt: now,
    };
    const next = profile.isDefault ? profiles.map((item) => item.gameId === profile.gameId ? { ...item, isDefault: false } : item) : profiles;
    writeJson(LAUNCH_PROFILES_KEY, [profile, ...next]);
    return Promise.resolve(profile);
  },

  updateLaunchProfile(id: string, input: LaunchProfileUpdate): Promise<LaunchProfile> {
    const profiles = readJson<LaunchProfile[]>(LAUNCH_PROFILES_KEY, []);
    let updated: LaunchProfile | undefined;
    let next = profiles.map((profile) => {
      if (profile.id !== id) return profile;
      updated = {
        ...profile,
        ...input,
        runnerType: input.runnerType ?? profile.runnerType,
        runAsAdmin: input.runAsAdmin ?? profile.runAsAdmin,
        isDefault: input.isDefault ?? profile.isDefault,
        updatedAt: new Date().toISOString(),
      };
      return updated;
    });
    if (!updated) return Promise.reject(new Error('Launch profile not found'));
    if (updated.isDefault) {
      next = next.map((profile) => profile.gameId === updated!.gameId && profile.id !== updated!.id ? { ...profile, isDefault: false } : profile);
    }
    writeJson(LAUNCH_PROFILES_KEY, next);
    return Promise.resolve(updated);
  },

  deleteLaunchProfile(id: string) {
    writeJson(LAUNCH_PROFILES_KEY, readJson<LaunchProfile[]>(LAUNCH_PROFILES_KEY, []).filter((profile) => profile.id !== id));
    return Promise.resolve();
  },

  setDefaultLaunchProfile(id: string): Promise<LaunchProfile> {
    const profiles = readJson<LaunchProfile[]>(LAUNCH_PROFILES_KEY, []);
    const target = profiles.find((profile) => profile.id === id);
    if (!target) return Promise.reject(new Error('Launch profile not found'));
    const next = profiles.map((profile) => profile.gameId === target.gameId ? { ...profile, isDefault: profile.id === id, updatedAt: new Date().toISOString() } : profile);
    writeJson(LAUNCH_PROFILES_KEY, next);
    return Promise.resolve(next.find((profile) => profile.id === id)!);
  },

  getDashboard(): Promise<DashboardData> {
    const games = readGames();
    const totalPlaySeconds = games.reduce((sum, game) => sum + game.totalPlaySeconds, 0);
    return Promise.resolve({
      totalGames: games.length,
      plannedGames: games.filter((game) => game.playStatus === 'planned').length,
      playingGames: games.filter((game) => game.playStatus === 'playing').length,
      completedGames: games.filter((game) => game.playStatus === 'completed').length,
      totalPlaySeconds,
      weekPlaySeconds: totalPlaySeconds,
      monthPlaySeconds: totalPlaySeconds,
      recentGames: games.filter((game) => game.lastPlayedAt).slice(0, 5),
      recentlyAdded: [...games].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    });
  },

  exportReportMarkdown(path: string, content: string) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = path || 'mikavn-report.md';
    link.click();
    URL.revokeObjectURL(url);
    return Promise.resolve();
  },

  async exportReportMarkdownTask(path: string, content: string): Promise<TaskRecord> {
    await this.exportReportMarkdown(path, content);
    return makeTask({
      taskType: 'report.export_markdown',
      status: 'completed',
      progress: 1,
      message: `浏览器预览已导出 ${path || 'mikavn-report.md'}`,
      error: null,
      retryable: false,
    });
  },

  backupDatabase(path: string): Promise<TaskRecord> {
    const target = path || 'mikavn-backup.db';
    const task = makeTask({
      taskType: 'database.backup',
      status: 'completed',
      progress: 1,
      message: `浏览器预览已模拟备份到 ${target}`,
      error: null,
      retryPayload: JSON.stringify({ path }),
      retryable: true,
    });
    addTaskLog(task.id, 'info', `数据库备份报告：目标 ${target}，大小 131072 bytes。`);
    return Promise.resolve(task);
  },

  restoreDatabaseBackup(path: string): Promise<TaskRecord> {
    const source = path || 'D:\\MikaVN-Backups\\mikavn.db';
    const pending = 'mock://pending-restore/mikavn.db';
    const task = makeTask({
      taskType: 'database.restore',
      status: 'completed',
      progress: 1,
      message: `浏览器预览已模拟安排下次启动恢复 ${pending}（131072 bytes）`,
      error: null,
      retryPayload: JSON.stringify({ path }),
      retryable: false,
    });
    addTaskLog(task.id, 'info', `数据库恢复来源：${source}（131072 bytes）`);
    addTaskLog(task.id, 'info', `数据库恢复待应用：${pending}（131072 bytes）`);
    return Promise.resolve(task);
  },

  getAppDataDiagnostics(): Promise<AppDataDiagnostics> {
    const games = readGames().map(ensureGameDefaults);
    const assets = readAssets();
    const imageRefs = games.flatMap((game) => [game.coverImage, game.bannerImage, game.backgroundImage]).filter(Boolean).length + assets.length;
    const externalIdLinkedCount = games.filter((game) => externalIdCount(game) > 0).length;
    const descriptionImageGames = games.filter((game) => hasMockDescriptionImage(game.description)).length;
    const providerGames = games.filter((game) => game.dlsiteId || game.fanzaId);
    const duplicateExternalIds = mockDuplicateExternalIdPreview();
    return Promise.resolve({
      appDataDir: 'E:\\MikaVN Library\\app-data',
      dataDirSource: 'mock',
      database: {
        path: 'E:\\MikaVN Library\\app-data\\mikavn.db',
        exists: true,
        sizeBytes: 12 * 1024 * 1024,
        userVersion: 13,
        quickCheck: 'ok',
        quickCheckOk: true,
        foreignKeyIssues: 0,
        gameCount: games.length,
        assetCount: assets.length,
        imageRefsCount: imageRefs,
        localImageRefsCount: imageRefs,
        missingImageRefsCount: 0,
        cDriveImageRefsCount: 0,
        playniteImageRefsCount: 0,
        metadataCoverage: {
          completeGameCount: games.filter((game) => game.description && game.releaseDate && (game.developer || game.brand) && game.coverImage && externalIdCount(game) > 0).length,
          needsMetadataCount: games.filter((game) => !(game.description && game.releaseDate && (game.developer || game.brand) && game.coverImage && externalIdCount(game) > 0)).length,
          missingCoverCount: games.filter((game) => !game.coverImage).length,
          missingBannerCount: games.filter((game) => !game.bannerImage).length,
          missingBackgroundCount: games.filter((game) => !game.backgroundImage).length,
          missingDescriptionCount: games.filter((game) => !game.description?.trim()).length,
          missingExternalIdCount: games.length - externalIdLinkedCount,
          providerLinkedGameCount: externalIdLinkedCount,
          vndbGameCount: games.filter((game) => game.vndbId).length,
          dlsiteGameCount: games.filter((game) => game.dlsiteId).length,
          fanzaGameCount: games.filter((game) => game.fanzaId).length,
        },
        descriptionImages: {
          providerGamesCount: providerGames.length,
          providerGamesWithImagesCount: providerGames.filter((game) => hasMockDescriptionImage(game.description)).length,
          providerGamesWithoutImagesCount: providerGames.filter((game) => game.description?.trim() && !hasMockDescriptionImage(game.description)).length,
          providerGamesEmptyDescriptionCount: providerGames.filter((game) => !game.description?.trim()).length,
          allGamesWithImagesCount: descriptionImageGames,
          imageRefsCount: descriptionImageGames,
          localImageRefsCount: 0,
          missingLocalImageRefsCount: 0,
        },
        externalIds: {
          totalExternalIdCount: games.reduce((count, game) => count + externalIdCount(game), 0),
          vndbIdCount: games.filter((game) => game.vndbId).length,
          dlsiteIdCount: games.filter((game) => game.dlsiteId).length,
          fanzaIdCount: games.filter((game) => game.fanzaId).length,
          duplicateExternalIdGroupsCount: duplicateExternalIds.totalGroups,
          duplicateExternalIdGamesCount: duplicateExternalIds.totalGames,
          duplicateVndbIdGroupsCount: mockDuplicateExternalIdPreview({ providers: ['vndb'] }).totalGroups,
          duplicateDlsiteIdGroupsCount: mockDuplicateExternalIdPreview({ providers: ['dlsite'] }).totalGroups,
          duplicateFanzaIdGroupsCount: mockDuplicateExternalIdPreview({ providers: ['fanza'] }).totalGroups,
        },
        pathStatus: {
          okCount: games.filter((game) => game.pathStatus === 'ok').length,
          brokenCount: games.filter((game) => game.pathStatus === 'broken').length,
          incompleteCount: games.filter((game) => game.pathStatus === 'incomplete').length,
          uncheckedCount: games.filter((game) => !game.pathStatus || game.pathStatus === 'unknown').length,
        },
      },
      images: { path: 'E:\\MikaVN Library\\app-data\\images', exists: true, fileCount: Math.max(assets.length, 1), totalBytes: Math.max(assets.length, 1) * 96 * 1024 },
      cache: { path: 'E:\\MikaVN Library\\app-data\\cache', exists: true, fileCount: 0, totalBytes: 0 },
      logs: { path: 'E:\\MikaVN Library\\app-data\\logs', exists: true, fileCount: readTasks().length, totalBytes: readTasks().length * 512 },
      saveBackups: { path: 'E:\\MikaVN Library\\app-data\\save-backups', exists: true, fileCount: readJson<SaveBackup[]>(SAVE_BACKUPS_KEY, []).length, totalBytes: readJson<SaveBackup[]>(SAVE_BACKUPS_KEY, []).length * 2048 },
      databaseBackups: {
        rootPath: 'E:\\MikaVN Library\\app-data',
        fileCount: 2,
        totalBytes: 24 * 1024 * 1024,
        files: [
          { fileName: 'mikavn.before-playnite-import-20260603-120000.db', path: 'E:\\MikaVN Library\\app-data\\mikavn.before-playnite-import-20260603-120000.db', sizeBytes: 12 * 1024 * 1024, modifiedAt: new Date().toISOString() },
          { fileName: 'before-restore-20260603-130000.db', path: 'E:\\MikaVN Library\\app-data\\database-restore-protection\\before-restore-20260603-130000.db', sizeBytes: 12 * 1024 * 1024, modifiedAt: new Date(Date.now() - 86400000).toISOString() },
        ],
      },
      warnings: [],
    });
  },

  cleanupOldDatabaseBackups(policy: DatabaseBackupCleanupPolicy = {}): Promise<DatabaseBackupCleanupReport> {
    const retainCount = policy.retainCount ?? 10;
    const retainDays = policy.retainDays ?? 30;
    return Promise.resolve({
      scannedFiles: 2,
      removedFiles: 0,
      keptFiles: 2,
      removedBytes: 0,
      keptBytes: 24 * 1024 * 1024,
      retainCount,
      retainDays,
      removed: [],
    });
  },

  listDiagnosticLogs(limit = 30): Promise<LogRecord[]> {
    const tasks = readTasks().slice(0, limit);
    return Promise.resolve(tasks.map((task, index) => ({
      fileName: `mock-${index + 1}.log`,
      path: `localStorage://task/${task.id}`,
      sizeBytes: 256 + index * 24,
      modifiedAt: task.updatedAt,
      preview: [`${task.updatedAt} [INFO] ${task.taskType}: ${task.message ?? 'mock log'}`],
    })));
  },

  getLogRetention(): Promise<LogRetentionPolicy> {
    return Promise.resolve({ retainDays: 30, maxFiles: 60 });
  },

  pruneDiagnosticLogs(_policy: LogRetentionPolicy): Promise<number> {
    return Promise.resolve(0);
  },

  exportLibraryArchive(options: LibraryArchiveExportOptions): Promise<TaskRecord> {
    return Promise.resolve(makeTask({
      taskType: 'library.archive_export',
      status: 'completed',
      progress: 1,
      message: `浏览器预览已模拟导出库归档到 ${options.targetDir || 'Downloads'}`,
      error: null,
      retryPayload: JSON.stringify(options),
      retryable: true,
    }));
  },

  exportLibraryArchiveZip(options: LibraryArchiveExportOptions): Promise<TaskRecord> {
    return Promise.resolve(makeTask({
      taskType: 'library.archive_export_zip',
      status: 'completed',
      progress: 1,
      message: `浏览器预览已模拟导出 ZIP 库归档到 ${options.targetDir || 'Downloads'}`,
      error: null,
      retryPayload: JSON.stringify(options),
      retryable: true,
    }));
  },

  previewLibraryArchive(path: string): Promise<LibraryArchivePreview> {
    return Promise.resolve({
      archiveDir: path,
      manifest: {
        app: 'MikaVN Library',
        archiveVersion: 1,
        exportedAt: new Date().toISOString(),
        databaseFile: 'mikavn.db',
        includeImages: true,
        includeSaveBackups: false,
        imagesCount: 0,
        saveBackupsCount: 0,
        notes: ['Browser preview mock archive.'],
      },
      databasePresent: true,
      imagesCount: 0,
      saveBackupsCount: 0,
      warnings: [],
    });
  },

  importLibraryArchive(options: LibraryArchiveImportOptions): Promise<TaskRecord> {
    const games = readGames().map(ensureGameDefaults);
    const freshTitle = 'Browser Archive Fresh';
    const conflictTitle = games[0]?.title ?? '星之终途';
    const imported = games.some((game) => game.title === freshTitle) ? 0 : 1;
    if (imported > 0) {
      void this.addGame({
        title: freshTitle,
        installPath: 'D:\\MikaVN-Smoke-Archive\\Fresh',
        genres: ['Visual Novel'],
      });
    }
    const task = makeTask({
      taskType: 'library.archive_import',
      status: 'completed',
      progress: 1,
      message: `浏览器预览归档导入完成：导入 ${imported} 个，跳过 1 个。保护备份：mock://archive-import-protection/before-import.db`,
      error: null,
      retryPayload: JSON.stringify(options),
      retryable: true,
    });
    addTaskLog(task.id, 'info', '归档导入保护备份：mock://archive-import-protection/before-import.db');
    if (imported > 0) addTaskLog(task.id, 'info', `归档导入新增：${freshTitle}`);
    addTaskLog(task.id, 'warn', `归档导入跳过：${conflictTitle}（标题已存在：${conflictTitle}）`);
    return Promise.resolve(task);
  },

  searchMetadata(query: string, providers: MetadataProvider[]): Promise<MetadataSearchResponse> {
    const cleanedQuery = cleanTitle(query);
    const variants = [...new Set([query, cleanedQuery].filter(Boolean))];
    const settings = readSettings();
    const activeProviders = providers.filter((provider) => settings[`provider_${provider}_enabled`] !== 'false');
    const results = mockMetadata
      .filter((item) => activeProviders.includes(item.provider))
      .map((item) => ({ ...item, relevanceScore: Math.max(item.relevanceScore, score(cleanedQuery || query, item.title) + (item.fromVndbSniff ? 0.1 : 0)) }))
      .sort((a, b) => Number(b.fromVndbSniff) - Number(a.fromVndbSniff) || b.relevanceScore - a.relevanceScore);
    return Promise.resolve({ query, cleanedQuery, variants, results, errors: [] });
  },

  validateSearchQuery(query: string): Promise<SearchQueryValidation> {
    const clauses = parseMockSearch(query);
    const errors = clauses.filter((clause) => clause.field === 'unsupported').map((clause) => `unsupported search field: ${clause.value}`);
    return Promise.resolve({ valid: errors.length === 0, errors, clauses: clauses.filter((clause) => clause.field !== 'unsupported') });
  },

  searchGamesAdvanced(input: AdvancedSearchInput): Promise<AdvancedSearchResult> {
    const clauses = parseMockSearch(input.query);
    const errors = clauses.filter((clause) => clause.field === 'unsupported').map((clause) => `unsupported search field: ${clause.value}`);
    let games = readGames().map(ensureGameDefaults);
    if (errors.length === 0 && clauses.length > 0) {
      games = games.filter((game) => clauses.every((clause) => {
        const matched = mockMatchesClause(game, clause);
        return clause.negated ? !matched : matched;
      }));
    }
    const total = games.length;
    const limit = Math.max(1, Math.min(input.limit ?? 100, 500));
    return Promise.resolve({ query: input.query, cleanedQuery: input.query.trim(), total, games: games.slice(0, limit), clauses: clauses.filter((clause) => clause.field !== 'unsupported'), errors });
  },

  listSavedSearches(): Promise<SavedSearch[]> {
    return Promise.resolve(readJson<SavedSearch[]>(SAVED_SEARCHES_KEY, []));
  },

  createSavedSearch(input: SavedSearchInput): Promise<SavedSearch> {
    const now = new Date().toISOString();
    const item: SavedSearch = { id: crypto.randomUUID(), name: input.name.trim(), query: input.query.trim(), description: input.description?.trim() || null, createdAt: now, updatedAt: now };
    if (!item.name || !item.query) return Promise.reject(new Error('Saved search name and query are required'));
    writeJson(SAVED_SEARCHES_KEY, [item, ...readJson<SavedSearch[]>(SAVED_SEARCHES_KEY, []).filter((saved) => saved.name !== item.name)]);
    return Promise.resolve(item);
  },

  updateSavedSearch(id: string, input: SavedSearchInput): Promise<SavedSearch> {
    const searches = readJson<SavedSearch[]>(SAVED_SEARCHES_KEY, []);
    const existing = searches.find((item) => item.id === id);
    if (!existing) return Promise.reject(new Error('Saved search not found'));
    const updated: SavedSearch = { ...existing, name: input.name.trim(), query: input.query.trim(), description: input.description?.trim() || null, updatedAt: new Date().toISOString() };
    writeJson(SAVED_SEARCHES_KEY, searches.map((item) => item.id === id ? updated : item));
    return Promise.resolve(updated);
  },

  deleteSavedSearch(id: string) {
    writeJson(SAVED_SEARCHES_KEY, readJson<SavedSearch[]>(SAVED_SEARCHES_KEY, []).filter((item) => item.id !== id));
    return Promise.resolve();
  },

  getMetadataDetail(provider: string, id: string): Promise<NormalizedMetadata> {
    const result = mockMetadata.find((item) => item.provider === provider && item.id === id) ?? mockMetadata[0];
    return Promise.resolve(toMetadata(result));
  },

  async matchMetadataForGame(gameId: string): Promise<MatchSuggestion> {
    const game = await this.getGame(gameId);
    const response = await this.searchMetadata(cleanTitle(game.title), ['vndb', 'dlsite', 'fanza']);
    const selected = response.results.find((item) => item.fromVndbSniff) ?? response.results.find((item) => item.relevanceScore >= 0.3) ?? null;
    return {
      gameId,
      originalTitle: game.title,
      cleanedTitle: response.cleanedQuery,
      selected,
      candidates: response.results,
      status: selected ? 'success' : response.results.length ? 'review' : 'no_result',
      reason: selected ? null : '候选分数低于自动匹配阈值',
    };
  },

  async applyMetadataToGame(gameId: string, metadata: NormalizedMetadata, fields: ApplyMetadataFields, forceLocked = false): Promise<Game> {
    const locks = forceLocked ? [] : await this.listFieldLocks(gameId);
    const locked = new Set(locks.filter((lock) => lock.lockedByUser).map((lock) => lock.fieldName));
    const input: UpdateGameInput = {};
    const has = (field: ApplyMetadataFields[number]) => fields.includes(field) && !locked.has(field);
    if (has('title')) input.title = metadata.title;
    if (has('originalTitle')) input.originalTitle = metadata.originalTitle ?? metadata.title;
    if (has('description')) input.description = metadata.description ?? undefined;
    if (has('releaseDate')) input.releaseDate = metadata.releaseDate ?? undefined;
    if (has('developer')) input.developer = metadata.developers[0];
    if (has('publisher')) input.publisher = metadata.publishers[0];
    if (has('tags')) input.tags = metadata.tags;
    if (has('genres')) input.genres = metadata.genres;
    if (has('coverImage')) input.coverImage = metadata.images[0];
    if (has('externalIds')) {
      input.vndbId = metadata.externalIds.vndb ?? undefined;
      input.dlsiteId = metadata.externalIds.dlsite ?? undefined;
      input.fanzaId = metadata.externalIds.fanza ?? undefined;
    }
    if (has('ageRating')) input.ageRating = metadata.ageRating ?? undefined;
    return this.updateGame(gameId, input);
  },

  listMetadataSources(): Promise<MetadataSourceRecord[]> {
    const now = new Date().toISOString();
    return Promise.resolve([
      { id: 'source-vndb', provider: 'vndb', label: 'VNDB', enabled: true, priority: 10, createdAt: now, updatedAt: now },
      { id: 'source-dlsite', provider: 'dlsite', label: 'DLsite', enabled: true, priority: 20, createdAt: now, updatedAt: now },
      { id: 'source-fanza', provider: 'fanza', label: 'FANZA', enabled: true, priority: 30, createdAt: now, updatedAt: now },
    ]);
  },

  async listExternalIds(gameId: string): Promise<ExternalIdRecord[]> {
    const game = await this.getGame(gameId);
    const now = new Date().toISOString();
    return [
      game.vndbId ? { id: `${game.id}-vndb`, gameId: game.id, provider: 'vndb', externalId: game.vndbId, source: 'games', confidence: null, createdAt: now, updatedAt: now } : null,
      game.dlsiteId ? { id: `${game.id}-dlsite`, gameId: game.id, provider: 'dlsite', externalId: game.dlsiteId, source: 'games', confidence: null, createdAt: now, updatedAt: now } : null,
      game.fanzaId ? { id: `${game.id}-fanza`, gameId: game.id, provider: 'fanza', externalId: game.fanzaId, source: 'games', confidence: null, createdAt: now, updatedAt: now } : null,
    ].filter(Boolean) as ExternalIdRecord[];
  },

  listFieldLocks(gameId: string): Promise<FieldLock[]> {
    return Promise.resolve(readJson<FieldLock[]>(FIELD_LOCKS_KEY, []).filter((lock) => lock.gameId === gameId));
  },

  setFieldLock(gameId: string, fieldName: string, lockedByUser: boolean): Promise<FieldLock> {
    const now = new Date().toISOString();
    const locks = readJson<FieldLock[]>(FIELD_LOCKS_KEY, []);
    const existing = locks.find((lock) => lock.gameId === gameId && lock.fieldName === fieldName);
    const nextLock: FieldLock = existing
      ? { ...existing, lockedByUser, updatedAt: now }
      : { id: crypto.randomUUID(), gameId, fieldName, lockedByUser, updatedAt: now };
    writeJson(FIELD_LOCKS_KEY, [nextLock, ...locks.filter((lock) => !(lock.gameId === gameId && lock.fieldName === fieldName))]);
    return Promise.resolve(nextLock);
  },

  async setFieldLocks(gameId: string, fieldNames: string[], lockedByUser: boolean): Promise<FieldLock[]> {
    const result: FieldLock[] = [];
    for (const fieldName of [...new Set(fieldNames.map((item) => item.trim()).filter(Boolean))]) {
      result.push(await this.setFieldLock(gameId, fieldName, lockedByUser));
    }
    return result;
  },

  async batchMatchMetadata(gameIds: string[]): Promise<BatchMatchJob> {
    const now = new Date().toISOString();
    const task = makeTask({
      taskType: 'metadata.batch_match',
      status: 'completed',
      progress: 1,
      message: `批量匹配完成：${gameIds.length} 个条目`,
      retryPayload: JSON.stringify({ gameIds }),
      retryable: true,
    });
    const job: BatchMatchJob = { id: crypto.randomUUID(), taskId: task.id, status: 'completed', total: gameIds.length, completed: gameIds.length, createdAt: now, updatedAt: now };
    const results = await Promise.all(gameIds.map(async (gameId) => {
      const suggestion = await this.matchMetadataForGame(gameId);
      return {
        id: crypto.randomUUID(),
        jobId: job.id,
        gameId,
        originalTitle: suggestion.originalTitle,
        cleanedTitle: suggestion.cleanedTitle,
        selectedProvider: suggestion.selected?.provider ?? null,
        selectedId: suggestion.selected?.id ?? null,
        selectedScore: suggestion.selected?.relevanceScore ?? null,
        status: suggestion.status,
        reason: suggestion.reason,
        candidates: suggestion.candidates,
        createdAt: new Date().toISOString(),
      };
    }));
    localStorage.setItem(BATCH_KEY, JSON.stringify({ job, results }));
    return job;
  },

  previewDescriptionImageRepair(options: DescriptionImageRepairOptions = {}): Promise<DescriptionImageRepairPreview> {
    const candidates = mockDescriptionImageCandidates(options);
    return Promise.resolve({ candidates, totalCandidates: candidates.length });
  },

  async repairDescriptionImages(options: DescriptionImageRepairOptions = {}): Promise<TaskRecord> {
    const candidates = mockDescriptionImageCandidates(options);
    if (candidates.length === 0) return Promise.reject(new Error('no description image repair candidates'));
    const games = readGames().map(ensureGameDefaults);
    const updatedIds = new Set(candidates.map((candidate) => candidate.gameId));
    writeGames(games.map((game) => updatedIds.has(game.id) ? {
      ...game,
      description: `${game.description?.trim() ?? ''}\n\n![简介图片](mock://metadata/${game.id}/description-1.webp)`,
      updatedAt: new Date().toISOString(),
    } : game));
    const task = makeTask({
      taskType: 'metadata.description_image_repair',
      status: 'completed',
      progress: 1,
      message: `浏览器预览已修复 ${candidates.length} 个条目的简介图片`,
      retryPayload: JSON.stringify({ provider: options.provider ?? 'all', limit: options.limit ?? 20, maxImages: options.maxImages ?? 3, retryAttempted: Boolean(options.retryAttempted) }),
      retryable: true,
    });
    addTaskLog(task.id, 'info', `简介图片修复候选：${candidates.map((candidate) => `${candidate.provider}:${candidate.providerId}`).join(', ')}`);
    return task;
  },

  previewDuplicateExternalIds(options: DuplicateExternalIdAuditOptions = {}): Promise<DuplicateExternalIdPreview> {
    return Promise.resolve(mockDuplicateExternalIdPreview(options));
  },

  auditDuplicateExternalIds(options: DuplicateExternalIdAuditOptions = {}): Promise<TaskRecord> {
    const preview = mockDuplicateExternalIdPreview(options);
    if (preview.totalGroups === 0) return Promise.reject(new Error('no duplicate external ids'));
    const task = makeTask({
      taskType: 'metadata.duplicate_id_audit',
      status: 'completed',
      progress: 1,
      message: `重复外部 ID 审查完成：发现 ${preview.totalGroups} 组，涉及 ${preview.totalGames} 个游戏记录`,
      retryPayload: JSON.stringify({ providers: options.providers ?? null, limit: options.limit ?? 50, retryAttempted: Boolean(options.retryAttempted) }),
      retryable: true,
    });
    for (const group of preview.groups) {
      addTaskLog(task.id, 'warn', `重复组：${group.provider} ${group.externalId}，${group.gameCount} 个游戏：${group.games.map((game) => `${game.title} [${game.gameId}]`).join(' | ')}`);
    }
    return Promise.resolve(task);
  },

  getBatchMatchStatus(jobId: string): Promise<BatchMatchStatus> {
    const raw = localStorage.getItem(BATCH_KEY);
    if (!raw) {
      const now = new Date().toISOString();
      return Promise.resolve({ job: { id: jobId, status: 'missing', total: 0, completed: 0, createdAt: now, updatedAt: now }, results: [] });
    }
    return Promise.resolve(JSON.parse(raw) as BatchMatchStatus);
  },

  cancelBatchMatch(jobId: string) {
    const raw = localStorage.getItem(BATCH_KEY);
    if (raw) {
      const status = JSON.parse(raw) as BatchMatchStatus;
      status.job = { ...status.job, id: jobId, status: 'cancelled', updatedAt: new Date().toISOString() };
      localStorage.setItem(BATCH_KEY, JSON.stringify(status));
    }
    return Promise.resolve();
  },

  recognizeGameFromImage(imagePath: string): Promise<AiRecognitionResult> {
    return Promise.resolve({ title: '星之终途', rawText: `Mock recognition from ${imagePath}: 星之终途`, confidence: 0.6 });
  },

  testAiConnection(): Promise<AiConnectionTestResult> {
    const settings = readSettings();
    return Promise.resolve({
      ok: true,
      baseUrl: settings.ai_base_url || 'https://api.openai.com/v1',
      model: settings.ai_model || 'gpt-4o-mini',
      message: 'Browser preview mock AI connection is available',
    });
  },

  addLibraryRoot(path: string): Promise<LibraryRoot> {
    const cleanPath = path.trim();
    if (!cleanPath) return Promise.reject(new Error('Library root path is required'));
    const roots = readJson<LibraryRoot[]>(LIBRARY_ROOTS_KEY, []);
    const existing = roots.find((root) => normalizeMockPath(root.path) === normalizeMockPath(cleanPath));
    if (existing) return Promise.resolve(existing);
    const root: LibraryRoot = { id: crypto.randomUUID(), path: cleanPath, recursive: true, enabled: true, createdAt: new Date().toISOString() };
    writeJson(LIBRARY_ROOTS_KEY, [root, ...roots]);
    return Promise.resolve(root);
  },

  listLibraryRoots(): Promise<LibraryRoot[]> {
    return Promise.resolve(readJson<LibraryRoot[]>(LIBRARY_ROOTS_KEY, []));
  },

  updateLibraryRoot(id: string, input: { recursive?: boolean; enabled?: boolean }): Promise<LibraryRoot> {
    const roots = readJson<LibraryRoot[]>(LIBRARY_ROOTS_KEY, []);
    const root = roots.find((item) => item.id === id);
    if (!root) return Promise.reject(new Error('Library root not found'));
    const updated: LibraryRoot = { ...root, recursive: input.recursive ?? root.recursive, enabled: input.enabled ?? root.enabled };
    writeJson(LIBRARY_ROOTS_KEY, [updated, ...roots.filter((item) => item.id !== id)]);
    return Promise.resolve(updated);
  },

  removeLibraryRoot(id: string): Promise<void> {
    writeJson(LIBRARY_ROOTS_KEY, readJson<LibraryRoot[]>(LIBRARY_ROOTS_KEY, []).filter((root) => root.id !== id));
    return Promise.resolve();
  },

  scanLibraryRoot(id: string): Promise<ScanCandidate[]> {
    const root = readJson<LibraryRoot[]>(LIBRARY_ROOTS_KEY, []).find((item) => item.id === id);
    if (!root) return Promise.reject(new Error('Library root not found'));
    if (!root.enabled) return Promise.reject(new Error('Library root is disabled'));
    return this.scanPathPreview(root.path, root.recursive);
  },

  scanPathPreview(path: string, recursive: boolean): Promise<ScanCandidate[]> {
    const root = path.trim() || 'D:\\Games\\VisualNovel';
    const baseDepth = recursive ? 'ゆずソフト\\天使騒々' : '天使騒々';
    const games = readGames().map(ensureGameDefaults);
    const conflictFor = (installPath: string, title: string) => {
      const normalizePath = (value: string) => value.trim().replace(/[/]+/g, '\\').replace(/[\\/]+$/g, '').toLowerCase();
      const normalizeTitle = (value: string) => value.trim().replace(/[\s　_-]+/g, '').toLowerCase();
      const found = games.find((game) => normalizePath(game.installPath) === normalizePath(installPath) || normalizeTitle(game.title) === normalizeTitle(title));
      return found ? { gameId: found.id, title: found.title, reason: normalizePath(found.installPath) === normalizePath(installPath) ? '安装目录已存在' : '标题相同' } : null;
    };
    return Promise.resolve([
      {
        id: crypto.randomUUID(),
        rootPath: root,
        installPath: `${root}\\星之终途`,
        folderName: '[汉化硬盘版] 星之终途 v1.02',
        suggestedTitle: '星之终途',
        aliases: ['[汉化硬盘版] 星之终途 v1.02'],
        executables: [{ name: 'stella.exe', path: `${root}\\星之终途\\stella.exe` }],
        selectedExecutable: `${root}\\星之终途\\stella.exe`,
        conflict: conflictFor(`${root}\\星之终途`, '星之终途'),
      },
      {
        id: crypto.randomUUID(),
        rootPath: root,
        installPath: `${root}\\${baseDepth}`,
        folderName: '[230428][ゆずソフト] 天使☆騒々 RE-BOOT!',
        suggestedTitle: '天使☆騒々 RE-BOOT!',
        aliases: ['[230428][ゆずソフト] 天使☆騒々 RE-BOOT!'],
        executables: [{ name: '天使騒々.exe', path: `${root}\\${baseDepth}\\天使騒々.exe` }],
        selectedExecutable: `${root}\\${baseDepth}\\天使騒々.exe`,
        conflict: conflictFor(`${root}\\${baseDepth}`, '天使☆騒々 RE-BOOT!'),
      },
    ]);
  },

  async startScanTask(path: string, recursive: boolean): Promise<TaskRecord> {
    const task = makeTask({
      taskType: 'library.scan',
      status: 'completed',
      progress: 1,
      message: '浏览器预览扫描已完成',
      error: null,
      retryPayload: JSON.stringify({ path, recursive }),
      retryable: true,
    });
    const candidates = await this.scanPathPreview(path, recursive);
    const status: ScanTaskStatus = { task, path, recursive, candidates };
    writeJson(SCAN_TASKS_KEY, { ...readJson<Record<string, ScanTaskStatus>>(SCAN_TASKS_KEY, {}), [task.id]: status });
    return task;
  },

  getScanTaskStatus(taskId: string): Promise<ScanTaskStatus> {
    const status = readJson<Record<string, ScanTaskStatus>>(SCAN_TASKS_KEY, {})[taskId];
    if (!status) {
      return Promise.reject(new Error('Scan task not found'));
    }
    return Promise.resolve(status);
  },

  async importScanCandidates(candidates: ImportCandidate[]): Promise<ImportScanReport> {
    const imported: Game[] = [];
    const items: ImportScanReportItem[] = [];
    let added = 0;
    let merged = 0;
    let replaced = 0;
    let duplicated = 0;
    let skipped = 0;

    const reportItem = (candidate: ImportCandidate, action: ImportScanReportItem['action'], game: Game | null, conflict: ScanConflict | null, message: string): ImportScanReportItem => ({
      candidateTitle: candidate.title,
      installPath: candidate.installPath,
      action,
      gameId: game?.id ?? null,
      targetTitle: game?.title ?? conflict?.title ?? null,
      conflictReason: conflict?.reason ?? null,
      message,
    });

    for (const candidate of candidates) {
      const games = readGames().map(ensureGameDefaults);
      const normalizePath = (value: string) => value.trim().replace(/[/]+/g, '\\').replace(/[\\/]+$/g, '').toLowerCase();
      const normalizeTitle = (value: string) => value.trim().replace(/[\s　_-]+/g, '').toLowerCase();
      const found = games.find((game) => normalizePath(game.installPath) === normalizePath(candidate.installPath) || normalizeTitle(game.title) === normalizeTitle(candidate.title));
      const conflict = found ? { gameId: found.id, title: found.title, reason: normalizePath(found.installPath) === normalizePath(candidate.installPath) ? '安装目录已存在' : '标题相同' } : null;
      const action = candidate.conflictAction ?? (conflict ? 'skip' : 'duplicate');
      if (conflict && action === 'skip') {
        skipped += 1;
        items.push(reportItem(candidate, 'skip', null, conflict, '已跳过与现有记录冲突的候选'));
        continue;
      }
      if (conflict && action === 'merge') {
        if (candidate.conflictGameId && candidate.conflictGameId !== conflict.gameId) {
          return Promise.reject(new Error('Conflict target changed; rescan before merging'));
        }
        const existing = games.find((game) => game.id === conflict.gameId);
        if (!existing) return Promise.reject(new Error('Conflict game not found'));
        const aliases = [...new Set([...(existing.aliases ?? []), ...(candidate.aliases ?? []), existing.title, candidate.title].map((item) => item.trim()).filter(Boolean))];
        const updated = await this.updateGame(existing.id, {
          aliases,
          installPath: candidate.installPath,
          executablePath: candidate.executablePath ?? undefined,
          workingDirectory: candidate.installPath,
          pathStatus: 'unknown',
          lastPathCheckedAt: null,
        });
        merged += 1;
        items.push(reportItem(candidate, 'merge', updated, conflict, '已合并到现有记录'));
        imported.push(updated);
        continue;
      }
      if (conflict && action === 'replace') {
        if (candidate.conflictGameId && candidate.conflictGameId !== conflict.gameId) {
          return Promise.reject(new Error('Conflict target changed; rescan before replacing'));
        }
        const updated = await this.updateGame(conflict.gameId, {
          title: candidate.title,
          aliases: candidate.aliases ?? [],
          installPath: candidate.installPath,
          executablePath: candidate.executablePath ?? undefined,
          workingDirectory: candidate.installPath,
          pathStatus: 'unknown',
          lastPathCheckedAt: null,
        });
        replaced += 1;
        items.push(reportItem(candidate, 'replace', updated, conflict, '已替换现有数据库记录'));
        imported.push(updated);
        continue;
      }
      if (conflict && action === 'duplicate' && !candidate.allowDuplicate) {
        return Promise.reject(new Error(`Candidate conflicts with existing game: ${conflict.title}`));
      }
      if (!conflict && action === 'skip') {
        skipped += 1;
        items.push(reportItem(candidate, 'skip', null, null, '候选未冲突，仍被跳过'));
        continue;
      }
      const game = await this.addGame({
        title: candidate.title,
        installPath: candidate.installPath,
        executablePath: candidate.executablePath ?? undefined,
        workingDirectory: candidate.installPath,
        aliases: candidate.aliases,
        genres: ['Visual Novel'],
      });
      if (conflict && action === 'duplicate') {
        duplicated += 1;
        items.push(reportItem(candidate, 'duplicate', game, conflict, '已作为副本导入'));
      } else {
        added += 1;
        items.push(reportItem(candidate, 'add', game, null, '已新增游戏记录'));
      }
      imported.push(game);
    }
    return { requested: candidates.length, importedCount: imported.length, added, merged, replaced, duplicated, skipped, imported, items };
  },

  getAppSettings(): Promise<Record<string, string>> {
    return Promise.resolve(readSettings());
  },

  setAppSettings(settings: Record<string, string>) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultSettings, ...settings }));
    return Promise.resolve();
  },

  listTasks(limit = 50): Promise<TaskRecord[]> {
    return Promise.resolve(readTasks().slice(0, Math.max(1, Math.min(limit, 200))));
  },

  getTask(id: string): Promise<TaskRecord> {
    const task = readTasks().find((item) => item.id === id);
    if (!task) return Promise.reject(new Error('Task not found'));
    return Promise.resolve(task);
  },

  listTaskLogs(taskId: string): Promise<TaskLogEntry[]> {
    return Promise.resolve(readJson<Record<string, TaskLogEntry[]>>(TASK_LOGS_KEY, {})[taskId] ?? []);
  },

  async getTaskDetail(id: string): Promise<TaskDetail> {
    return { task: await this.getTask(id), logs: await this.listTaskLogs(id) };
  },

  cancelTask(id: string): Promise<TaskRecord> {
    const tasks = readTasks();
    const task = tasks.find((item) => item.id === id);
    if (!task) return Promise.reject(new Error('Task not found'));
    const next = { ...task, status: 'cancelled', progress: 1, message: '任务已取消', updatedAt: new Date().toISOString() };
    writeTasks([next, ...tasks.filter((item) => item.id !== id)]);
    addTaskLog(id, 'warn', '任务已取消');
    return Promise.resolve(next);
  },

  async retryTask(id: string): Promise<TaskRecord> {
    const task = await this.getTask(id);
    if (!task.retryable || !task.retryPayload) return Promise.reject(new Error('Task is not retryable'));
    if (task.status !== 'failed' && task.status !== 'cancelled') return Promise.reject(new Error('Only failed or cancelled tasks can be retried'));
    const payload = JSON.parse(task.retryPayload) as Record<string, unknown>;
    if (task.taskType === 'library.scan') return this.startScanTask(String(payload.path ?? ''), Boolean(payload.recursive));
    if (task.taskType === 'database.backup') return this.backupDatabase(String(payload.path ?? ''));
    if (task.taskType === 'library.archive_export') return this.exportLibraryArchive({
      targetDir: String(payload.targetDir ?? ''),
      includeImages: Boolean(payload.includeImages),
      includeSaveBackups: Boolean(payload.includeSaveBackups),
    });
    if (task.taskType === 'library.archive_export_zip') return this.exportLibraryArchiveZip({
      targetDir: String(payload.targetDir ?? ''),
      includeImages: Boolean(payload.includeImages),
      includeSaveBackups: Boolean(payload.includeSaveBackups),
    });
    if (task.taskType === 'library.archive_import') return this.importLibraryArchive({
      archiveDir: String(payload.archiveDir ?? ''),
      includeImages: Boolean(payload.includeImages),
      includeSaveBackups: Boolean(payload.includeSaveBackups),
    });
    if (task.taskType === 'save.backup') return this.createSaveBackupTask(String(payload.savePathId ?? ''), String(payload.label ?? ''));
    if (task.taskType === 'save.restore') return this.restoreSaveBackupTask(String(payload.backupId ?? ''), payload.mode === 'mirror' ? 'mirror' : 'merge');
    if (task.taskType === 'game.path_check') return this.checkGamePathsTask(String(payload.gameId ?? ''));
    if (task.taskType === 'metadata.batch_match') return this.batchMatchMetadata(Array.isArray(payload.gameIds) ? payload.gameIds.map(String) : []).then(({ taskId }) => this.getTask(String(taskId)));
    return Promise.reject(new Error('This task type does not support retry'));
  },

  listSavePaths(gameId: string): Promise<SavePath[]> {
    return Promise.resolve(readJson<SavePath[]>(SAVE_PATHS_KEY, []).filter((item) => item.gameId === gameId));
  },

  addSavePath(gameId: string, label: string, path: string): Promise<SavePath> {
    const item: SavePath = { id: crypto.randomUUID(), gameId, label: label.trim() || '存档', path: path.trim(), createdAt: new Date().toISOString() };
    writeJson(SAVE_PATHS_KEY, [item, ...readJson<SavePath[]>(SAVE_PATHS_KEY, [])]);
    return Promise.resolve(item);
  },

  removeSavePath(id: string) {
    writeJson(SAVE_PATHS_KEY, readJson<SavePath[]>(SAVE_PATHS_KEY, []).filter((item) => item.id !== id));
    return Promise.resolve();
  },

  async suggestSavePaths(gameId: string): Promise<SavePathCandidate[]> {
    const game = await this.getGame(gameId);
    const existing = new Set(readJson<SavePath[]>(SAVE_PATHS_KEY, []).filter((item) => item.gameId === gameId).map((item) => item.path.toLowerCase()));
    const install = game.installPath.replace(/[\\/]$/, '');
    return ['save', 'savedata', 'SaveData'].map((folder) => {
      const candidatePath = `${install}\\${folder}`;
      return {
        label: '游戏目录存档',
        path: candidatePath,
        reason: '浏览器预览候选：安装目录下的常见存档文件夹',
        exists: true,
        alreadyAdded: existing.has(candidatePath.toLowerCase()),
      };
    });
  },

  createSaveBackup(savePathId: string, label: string): Promise<SaveBackup> {
    const savePath = readJson<SavePath[]>(SAVE_PATHS_KEY, []).find((item) => item.id === savePathId);
    if (!savePath) return Promise.reject(new Error('Save path not found'));
    const item: SaveBackup = {
      id: crypto.randomUUID(),
      gameId: savePath.gameId,
      savePathId,
      label: label.trim() || savePath.label,
      sourcePath: savePath.path,
      backupPath: `mock://save-backups/${savePath.gameId}/${Date.now()}`,
      protection: false,
      createdAt: new Date().toISOString(),
    };
    writeJson(SAVE_BACKUPS_KEY, [item, ...readJson<SaveBackup[]>(SAVE_BACKUPS_KEY, [])]);
    return Promise.resolve(item);
  },

  async createSaveBackupTask(savePathId: string, label: string): Promise<TaskRecord> {
    const backup = await this.createSaveBackup(savePathId, label);
    return makeTask({
      taskType: 'save.backup',
      status: 'completed',
      progress: 1,
      message: `浏览器预览已创建备份：${backup.label}`,
      error: null,
      retryPayload: JSON.stringify({ savePathId, label }),
      retryable: true,
    });
  },

  listSaveBackups(gameId: string): Promise<SaveBackup[]> {
    return Promise.resolve(readJson<SaveBackup[]>(SAVE_BACKUPS_KEY, []).filter((item) => item.gameId === gameId));
  },

  restoreSaveBackup(backupId: string): Promise<SaveBackup> {
    const backup = readJson<SaveBackup[]>(SAVE_BACKUPS_KEY, []).find((item) => item.id === backupId);
    if (!backup) return Promise.reject(new Error('Save backup not found'));
    const protection: SaveBackup = { ...backup, id: crypto.randomUUID(), label: '恢复前保护备份', protection: true, createdAt: new Date().toISOString() };
    writeJson(SAVE_BACKUPS_KEY, [protection, ...readJson<SaveBackup[]>(SAVE_BACKUPS_KEY, [])]);
    return Promise.resolve(protection);
  },

  async restoreSaveBackupTask(backupId: string, mode: 'merge' | 'mirror' = 'merge'): Promise<TaskRecord> {
    const protection = await this.restoreSaveBackup(backupId);
    const copiedFiles = 2;
    const removedFiles = mode === 'mirror' ? 2 : 0;
    const task = makeTask({
      taskType: 'save.restore',
      status: 'completed',
      progress: 1,
      message: `浏览器预览已模拟${mode === 'mirror' ? '镜像' : '合并'}恢复存档：复制 ${copiedFiles} 个文件，清理 ${removedFiles} 个文件`,
      error: null,
      retryPayload: JSON.stringify({ backupId, mode }),
      retryable: true,
    });
    addTaskLog(task.id, 'info', `存档恢复保护备份：${protection.backupPath}`);
    addTaskLog(task.id, 'info', `存档恢复报告：模式 ${mode === 'mirror' ? '镜像' : '合并'}，复制 ${copiedFiles} 个文件，清理 ${removedFiles} 个文件。`);
    return task;
  },

  deleteSaveBackupRecord(id: string) {
    writeJson(SAVE_BACKUPS_KEY, readJson<SaveBackup[]>(SAVE_BACKUPS_KEY, []).filter((item) => item.id !== id));
    return Promise.resolve();
  },
};
