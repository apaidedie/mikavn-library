import type { AddGameInput, AssetCacheCleanupResult, AssetDownloadInput, AssetImportInput, AssetInput, DashboardData, Game, GameAsset, GameFilter, GamePathHealth, PathCheckItem, PlayStatus, TagRecord, UpdateGameInput } from '@/types/game';
import type { AdvancedSearchInput, AdvancedSearchResult, AiConnectionTestResult, AiRecognitionResult, ApplyMetadataFields, ArtworkRepairDiagnosis, ArtworkRepairOptions, ArtworkRepairPreview, BatchMatchJob, BatchMatchStatus, DescriptionImageRepairOptions, DescriptionImageRepairPreview, DuplicateExternalIdAuditOptions, DuplicateExternalIdPreview, DuplicateGameMergeOptions, DuplicateGameMergePreview, DuplicateGameMergeResult, ExternalIdRecord, FieldLock, MatchSuggestion, MetadataProvider, MetadataSearchResponse, MetadataSearchResult, MetadataSourceRecord, NormalizedMetadata, SavedSearch, SavedSearchInput, SearchQueryValidation } from '@/types/metadata';
import type { TaskDetail, TaskLogEntry, TaskRecord } from '@/types/task';
import { mockArtworkRepairDiagnosis, mockArtworkRepairPreview, mockDescriptionImageCandidates } from './mockStoreArtworkRepair';
import { createMockStoreArchives } from './mockStoreArchives';
import { defaultSettings, mockMetadata, sampleGames, sampleHeroUrl } from './mockStoreFixtures';
import { readAssets, syncGameCompatibilityAssets, writeAssets } from './mockStoreAssets';
import { createMockStoreCollections, readCollectionLinks, writeCollectionLinks } from './mockStoreCollections';
import { mockDuplicateExternalIdPreview, mockDuplicateGameMergePreview } from './mockStoreDuplicates';
import { cleanList, ensureGameDefaults, makeGame } from './mockStoreGames';
import { mockAssetCacheCleanupResult } from './mockStoreImages';
import { createMockStoreDiagnostics } from './mockStoreDiagnostics';
import { createMockStoreLaunchProfiles } from './mockStoreLaunchProfiles';
import { cleanTitle, metadataStatusMatches, mockMatchesClause, parseMockSearch, score } from './mockStoreMetadata';
import { createMockStorePlaySessions } from './mockStorePlaySessions';
import { createMockStoreScanner } from './mockStoreScanner';
import { createMockStoreSaves } from './mockStoreSaves';
import { BATCH_KEY, FIELD_LOCKS_KEY, SAVED_SEARCHES_KEY, SETTINGS_KEY, STORAGE_KEY, readJson, readSettings, writeJson } from './mockStoreStorage';
import { syncGameTags } from './mockStoreTags';
import { addTaskLog, makeTask, readTaskLogs, readTasks, reportGapExamplesLog, reportGapSummaryLog, writeTasks } from './mockStoreTasks';

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

function mockMergeDuplicateGames(options: DuplicateGameMergeOptions): DuplicateGameMergeResult {
  const games = readGames().map(ensureGameDefaults);
  const preview = mockDuplicateGameMergePreview(games, {
    collectionLinks: readCollectionLinks(),
    assets: readAssets(),
    fieldLocks: readJson<Record<string, FieldLock[]>>(FIELD_LOCKS_KEY, {}),
  }, options);
  const target = games.find((game) => game.id === options.targetGameId);
  const sources = options.sourceGameIds.map((id) => games.find((game) => game.id === id)).filter(Boolean) as Game[];
  if (!target) throw new Error('target game not found');
  const merged = sources.reduce((current, source) => ({
    ...current,
    aliases: cleanList([...current.aliases, source.title, source.originalTitle ?? '', ...source.aliases]),
    tags: cleanList([...current.tags, ...source.tags]),
    genres: cleanList([...current.genres, ...source.genres]),
    originalTitle: current.originalTitle || source.originalTitle,
    developer: current.developer || source.developer,
    publisher: current.publisher || source.publisher,
    brand: current.brand || source.brand,
    releaseDate: current.releaseDate || source.releaseDate,
    description: current.description || source.description,
    notes: current.notes || source.notes,
    rating: current.rating ?? source.rating,
    ageRating: current.ageRating || source.ageRating,
    favorite: current.favorite || source.favorite,
    executablePath: current.executablePath || source.executablePath,
    workingDirectory: current.workingDirectory || source.workingDirectory,
    launchArgs: current.launchArgs || source.launchArgs,
    coverImage: current.coverImage || source.coverImage,
    bannerImage: current.bannerImage || source.bannerImage,
    backgroundImage: current.backgroundImage || source.backgroundImage,
    vndbId: current.vndbId || source.vndbId,
    bangumiId: current.bangumiId || source.bangumiId,
    dlsiteId: current.dlsiteId || source.dlsiteId,
    fanzaId: current.fanzaId || source.fanzaId,
    ymgalId: current.ymgalId || source.ymgalId,
    totalPlaySeconds: current.totalPlaySeconds + source.totalPlaySeconds,
    lastPlayedAt: [current.lastPlayedAt, source.lastPlayedAt].filter(Boolean).sort().at(-1) ?? null,
    updatedAt: new Date().toISOString(),
  }), target);
  const sourceIds = new Set(options.sourceGameIds);
  writeGames(games.filter((game) => !sourceIds.has(game.id)).map((game) => game.id === merged.id ? merged : game));
  writeCollectionLinks(readCollectionLinks().map((link) => sourceIds.has(link.gameId) ? { ...link, gameId: merged.id } : link)
    .filter((link, index, links) => links.findIndex((item) => item.collectionId === link.collectionId && item.gameId === link.gameId) === index));
  writeAssets(readAssets().map((asset) => sourceIds.has(asset.gameId) ? { ...asset, gameId: merged.id, updatedAt: new Date().toISOString() } : asset)
    .filter((asset, index, assets) => assets.findIndex((item) => item.gameId === asset.gameId && item.assetType === asset.assetType && item.uri === asset.uri) === index));
  syncGameCompatibilityAssets(merged);
  return { mergedGame: merged, deletedSourceGameIds: [...sourceIds], movedCounts: preview.movedCounts, warnings: preview.warnings };
}

function addMockGame(input: AddGameInput): Promise<Game> {
  const games = readGames();
  const game = makeGame(input);
  writeGames([game, ...games]);
  syncGameCompatibilityAssets(game);
  return Promise.resolve(game);
}

function updateMockGame(id: string, input: UpdateGameInput): Promise<Game> {
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
}

const mockLaunchProfiles = createMockStoreLaunchProfiles(readGames);

export const mockStore = {
  ...createMockStoreDiagnostics(readGames),
  ...createMockStoreArchives({ readGames, writeGames }),
  ...createMockStoreSaves(readGames),
  ...createMockStoreCollections(readGames),
  ...mockLaunchProfiles,
  ...createMockStorePlaySessions({ readGames, writeGames, listLaunchProfiles: mockLaunchProfiles.listLaunchProfiles }),
  ...createMockStoreScanner({ readGames, addGame: addMockGame, updateGame: updateMockGame }),

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

  addGame: addMockGame,

  updateGame: updateMockGame,

  deleteGameRecord(id: string) {
    writeGames(readGames().filter((game) => game.id !== id));
    writeCollectionLinks(readCollectionLinks().filter((link) => link.gameId !== id));
    return Promise.resolve();
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
    return Promise.resolve(mockAssetCacheCleanupResult(assets));
  },

  previewAssetCacheCleanup(): Promise<AssetCacheCleanupResult> {
    return Promise.resolve(mockAssetCacheCleanupResult(readAssets()));
  },

  listTags(kind?: string) {
    return Promise.resolve(syncGameTags(readGames()).filter((tag) => !kind || tag.kind === kind));
  },

  renameTag(id: string, name: string): Promise<TagRecord> {
    const tag = syncGameTags(readGames()).find((item) => item.id === id);
    if (!tag) return Promise.reject(new Error('Tag not found'));
    const nextName = name.trim();
    if (!nextName) return Promise.reject(new Error('Tag name is required'));
    writeGames(readGames().map((game) => ({
      ...game,
      tags: tag.kind === 'tag' ? game.tags.map((item) => item === tag.name ? nextName : item) : game.tags,
      genres: tag.kind === 'genre' ? game.genres.map((item) => item === tag.name ? nextName : item) : game.genres,
      updatedAt: new Date().toISOString(),
    })));
    const renamed = syncGameTags(readGames()).find((item) => item.name === nextName && item.kind === tag.kind);
    return renamed ? Promise.resolve(renamed) : Promise.reject(new Error('Tag rename failed'));
  },

  mergeTags(sourceIds: string[], targetId: string): Promise<TagRecord> {
    const tags = syncGameTags(readGames());
    const target = tags.find((item) => item.id === targetId);
    if (!target) return Promise.reject(new Error('Target tag not found'));
    const sources = tags.filter((item) => sourceIds.includes(item.id) && item.kind === target.kind && item.id !== target.id);
    writeGames(readGames().map((game) => {
      const field = target.kind === 'tag' ? 'tags' : 'genres';
      const values = game[field].map((item) => sources.some((source) => source.name === item) ? target.name : item);
      return { ...game, [field]: cleanList(values), updatedAt: new Date().toISOString() };
    }));
    const merged = syncGameTags(readGames()).find((item) => item.name === target.name && item.kind === target.kind);
    return merged ? Promise.resolve(merged) : Promise.reject(new Error('Tag merge failed'));
  },

  deleteTag(id: string) {
    const tag = syncGameTags(readGames()).find((item) => item.id === id);
    if (!tag) return Promise.reject(new Error('Tag not found'));
    writeGames(readGames().map((game) => ({
      ...game,
      tags: tag.kind === 'tag' ? game.tags.filter((item) => item !== tag.name) : game.tags,
      genres: tag.kind === 'genre' ? game.genres.filter((item) => item !== tag.name) : game.genres,
      updatedAt: new Date().toISOString(),
    })));
    return Promise.resolve();
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
    const task = makeTask({
      taskType: 'report.export_markdown',
      status: 'completed',
      progress: 1,
      message: `浏览器预览已导出 ${path || 'mikavn-report.md'}`,
      error: null,
      retryable: false,
    });
    addTaskLog(task.id, 'info', reportGapSummaryLog(content));
    addTaskLog(task.id, 'info', reportGapExamplesLog(content));
    return task;
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
      input.bangumiId = metadata.externalIds.bangumi ?? undefined;
      input.dlsiteId = metadata.externalIds.dlsite ?? undefined;
      input.fanzaId = metadata.externalIds.fanza ?? undefined;
      input.ymgalId = metadata.externalIds.ymgal ?? undefined;
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
      { id: 'source-bangumi', provider: 'bangumi', label: 'Bangumi', enabled: true, priority: 40, createdAt: now, updatedAt: now },
      { id: 'source-ymgal', provider: 'ymgal', label: 'YMGal', enabled: true, priority: 50, createdAt: now, updatedAt: now },
    ]);
  },

  async listExternalIds(gameId: string): Promise<ExternalIdRecord[]> {
    const game = await this.getGame(gameId);
    const now = new Date().toISOString();
    return [
      game.vndbId ? { id: `${game.id}-vndb`, gameId: game.id, provider: 'vndb', externalId: game.vndbId, source: 'games', confidence: null, createdAt: now, updatedAt: now } : null,
      game.bangumiId ? { id: `${game.id}-bangumi`, gameId: game.id, provider: 'bangumi', externalId: game.bangumiId, source: 'games', confidence: null, createdAt: now, updatedAt: now } : null,
      game.dlsiteId ? { id: `${game.id}-dlsite`, gameId: game.id, provider: 'dlsite', externalId: game.dlsiteId, source: 'games', confidence: null, createdAt: now, updatedAt: now } : null,
      game.fanzaId ? { id: `${game.id}-fanza`, gameId: game.id, provider: 'fanza', externalId: game.fanzaId, source: 'games', confidence: null, createdAt: now, updatedAt: now } : null,
      game.ymgalId ? { id: `${game.id}-ymgal`, gameId: game.id, provider: 'ymgal', externalId: game.ymgalId, source: 'games', confidence: null, createdAt: now, updatedAt: now } : null,
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
    const candidates = mockDescriptionImageCandidates(readGames().map(ensureGameDefaults), options);
    return Promise.resolve({ candidates, totalCandidates: candidates.length });
  },

  async repairDescriptionImages(options: DescriptionImageRepairOptions = {}): Promise<TaskRecord> {
    const games = readGames().map(ensureGameDefaults);
    const candidates = mockDescriptionImageCandidates(games, options);
    if (candidates.length === 0) return Promise.reject(new Error('no description image repair candidates'));
    const updatedIds = new Set(candidates.map((candidate) => candidate.gameId));
    writeGames(games.map((game) => updatedIds.has(game.id) ? {
      ...game,
      description: `${game.description?.trim() ?? ''}\n\n![简介图片](${sampleHeroUrl})`,
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

  previewArtworkRepair(options: ArtworkRepairOptions = {}): Promise<ArtworkRepairPreview> {
    return Promise.resolve(mockArtworkRepairPreview(readGames().map(ensureGameDefaults), options));
  },

  diagnoseArtworkRepair(options: ArtworkRepairOptions = {}): Promise<ArtworkRepairDiagnosis> {
    return Promise.resolve(mockArtworkRepairDiagnosis(readGames().map(ensureGameDefaults), options));
  },

  repairArtwork(options: ArtworkRepairOptions = {}): Promise<TaskRecord> {
    const games = readGames().map(ensureGameDefaults);
    const preview = mockArtworkRepairPreview(games, options);
    if (preview.totalCandidates === 0) return Promise.reject(new Error('no artwork repair candidates'));
    const updatedIds = new Map(preview.candidates.map((candidate) => [candidate.gameId, candidate.missingFields]));
    writeGames(games.map((game) => {
      const fields = updatedIds.get(game.id);
      if (!fields) return game;
      return {
        ...game,
        coverImage: fields.includes('cover') ? sampleHeroUrl : game.coverImage,
        bannerImage: fields.includes('banner') ? sampleHeroUrl : game.bannerImage,
        backgroundImage: fields.includes('background') ? sampleHeroUrl : game.backgroundImage,
        updatedAt: new Date().toISOString(),
      };
    }));
    const task = makeTask({
      taskType: 'metadata.artwork_repair',
      status: 'completed',
      progress: 1,
      message: `浏览器预览已补全 ${preview.totalCandidates} 个条目的媒体图片`,
      retryPayload: JSON.stringify({ providers: options.providers ?? ['all'], fields: options.fields ?? ['cover', 'banner', 'background'], limit: options.limit ?? 20, retryAttempted: Boolean(options.retryAttempted) }),
      retryable: true,
    });
    for (const candidate of preview.candidates) {
      addTaskLog(task.id, 'info', `已补全：${candidate.title} [${candidate.gameId}]，字段 ${candidate.missingFields.join('/')}`);
    }
    return Promise.resolve(task);
  },

  previewDuplicateExternalIds(options: DuplicateExternalIdAuditOptions = {}): Promise<DuplicateExternalIdPreview> {
    return Promise.resolve(mockDuplicateExternalIdPreview(readGames().map(ensureGameDefaults), options));
  },

  auditDuplicateExternalIds(options: DuplicateExternalIdAuditOptions = {}): Promise<TaskRecord> {
    const preview = mockDuplicateExternalIdPreview(readGames().map(ensureGameDefaults), options);
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

  previewDuplicateGameMerge(options: DuplicateGameMergeOptions): Promise<DuplicateGameMergePreview> {
    try {
      return Promise.resolve(mockDuplicateGameMergePreview(readGames().map(ensureGameDefaults), {
        collectionLinks: readCollectionLinks(),
        assets: readAssets(),
        fieldLocks: readJson<Record<string, FieldLock[]>>(FIELD_LOCKS_KEY, {}),
      }, options));
    } catch (reason) {
      return Promise.reject(reason);
    }
  },

  mergeDuplicateGames(options: DuplicateGameMergeOptions): Promise<DuplicateGameMergeResult> {
    try {
      return Promise.resolve(mockMergeDuplicateGames(options));
    } catch (reason) {
      return Promise.reject(reason);
    }
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
    return Promise.resolve(readTaskLogs(taskId));
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
    if (task.taskType === 'library.archive_restore') return this.restoreLibraryArchive({
      archiveDir: String(payload.archiveDir ?? ''),
      restoreImages: Boolean(payload.restoreImages),
      restoreSaveBackups: Boolean(payload.restoreSaveBackups),
    });
    if (task.taskType === 'save.backup') return this.createSaveBackupTask(String(payload.savePathId ?? ''), String(payload.label ?? ''));
    if (task.taskType === 'save.restore') return this.restoreSaveBackupTask(String(payload.backupId ?? ''), payload.mode === 'mirror' ? 'mirror' : 'merge');
    if (task.taskType === 'game.path_check') return this.checkGamePathsTask(String(payload.gameId ?? ''));
    if (task.taskType === 'metadata.batch_match') return this.batchMatchMetadata(Array.isArray(payload.gameIds) ? payload.gameIds.map(String) : []).then(({ taskId }) => this.getTask(String(taskId)));
    if (task.taskType === 'metadata.description_image_repair') return this.repairDescriptionImages({
      provider: String(payload.provider ?? 'all'),
      limit: Number(payload.limit ?? 20),
      maxImages: Number(payload.maxImages ?? payload.max_images ?? 3),
      retryAttempted: true,
    });
    if (task.taskType === 'metadata.artwork_repair') return this.repairArtwork({
      providers: Array.isArray(payload.providers) ? payload.providers.map(String) : ['all'],
      fields: Array.isArray(payload.fields) ? payload.fields.map(String) : ['cover', 'banner', 'background'],
      limit: Number(payload.limit ?? 20),
      retryAttempted: true,
    });
    if (task.taskType === 'metadata.duplicate_id_audit') return this.auditDuplicateExternalIds({
      providers: Array.isArray(payload.providers) ? payload.providers.map(String) : ['all'],
      limit: Number(payload.limit ?? 50),
      retryAttempted: true,
    });
    return Promise.reject(new Error('This task type does not support retry'));
  },

};
