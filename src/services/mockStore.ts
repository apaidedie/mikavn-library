import type { AddGameInput, Game, GameFilter, GamePathHealth, PathCheckItem, PlayStatus, UpdateGameInput } from '@/types/game';
import type { ArtworkRepairDiagnosis, ArtworkRepairOptions, ArtworkRepairPreview, DescriptionImageRepairOptions, DescriptionImageRepairPreview, DuplicateExternalIdAuditOptions, DuplicateExternalIdPreview, DuplicateGameMergeOptions, DuplicateGameMergePreview, DuplicateGameMergeResult, FieldLock } from '@/types/metadata';
import type { TaskRecord } from '@/types/task';
import { mockArtworkRepairDiagnosis, mockArtworkRepairPreview, mockDescriptionImageCandidates } from './mockStoreArtworkRepair';
import { createMockStoreAi } from './mockStoreAi';
import { createMockStoreArchives } from './mockStoreArchives';
import { sampleGames, sampleHeroUrl } from './mockStoreFixtures';
import { createMockStoreAssets, readAssets, syncGameCompatibilityAssets, writeAssets } from './mockStoreAssets';
import { createMockStoreCollections, readCollectionLinks, writeCollectionLinks } from './mockStoreCollections';
import { mockDuplicateExternalIdPreview, mockDuplicateGameMergePreview } from './mockStoreDuplicates';
import { cleanList, ensureGameDefaults, makeGame } from './mockStoreGames';
import { createMockStoreDiagnostics } from './mockStoreDiagnostics';
import { createMockStoreLaunchProfiles } from './mockStoreLaunchProfiles';
import { createMockStoreMetadataRecords } from './mockStoreMetadataRecords';
import { createMockStoreMetadata, metadataStatusMatches } from './mockStoreMetadata';
import { createMockStorePlaySessions } from './mockStorePlaySessions';
import { createMockStoreReports } from './mockStoreReports';
import { createMockStoreSavedSearches } from './mockStoreSavedSearches';
import { createMockStoreScanner } from './mockStoreScanner';
import { createMockStoreSaves } from './mockStoreSaves';
import { createMockStoreSettings } from './mockStoreSettings';
import { FIELD_LOCKS_KEY, STORAGE_KEY, readJson } from './mockStoreStorage';
import { createMockStoreTags } from './mockStoreTags';
import { addTaskLog, createMockStoreTaskQueries, makeTask } from './mockStoreTasks';

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

function getMockGame(id: string) {
  const game = readGames().map(ensureGameDefaults).find((item) => item.id === id);
  return game ? Promise.resolve(game) : Promise.reject(new Error('Game not found'));
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
const mockMetadataRecords = createMockStoreMetadataRecords(getMockGame);

export const mockStore = {
  ...createMockStoreDiagnostics(readGames),
  ...createMockStoreArchives({ readGames, writeGames }),
  ...createMockStoreSaves(readGames),
  ...createMockStoreCollections(readGames),
  ...createMockStoreTags(readGames, writeGames),
  ...createMockStoreAssets({ readGames, getGame: getMockGame, updateGame: updateMockGame }),
  ...createMockStoreSettings(),
  ...createMockStoreTaskQueries(),
  ...createMockStoreReports(readGames),
  ...createMockStoreSavedSearches(),
  ...createMockStoreAi(),
  ...mockMetadataRecords,
  ...createMockStoreMetadata({
    readGames,
    getGame: getMockGame,
    updateGame: updateMockGame,
    listFieldLocks: mockMetadataRecords.listFieldLocks,
  }),
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

  getGame: getMockGame,

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
