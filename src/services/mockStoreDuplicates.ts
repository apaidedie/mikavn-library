import type { CollectionGameLink, Game, GameAsset } from '@/types/game';
import type { DuplicateExternalIdAuditOptions, DuplicateExternalIdGroup, DuplicateExternalIdPreview, DuplicateGameMergeExternalId, DuplicateGameMergeOptions, DuplicateGameMergePreview, DuplicateGameMergeResult, FieldLock } from '@/types/metadata';
import type { TaskRecord } from '@/types/task';
import { cleanList, ensureGameDefaults } from './mockStoreGames';
import { addTaskLog, makeTask } from './mockStoreTasks';

function mockExternalIdEntries(games: Game[], options: DuplicateExternalIdAuditOptions = {}) {
  const providers = (options.providers ?? []).map((provider) => String(provider).trim().toLowerCase()).filter(Boolean);
  const providerSet = providers.length && !providers.includes('all') ? new Set(providers) : null;
  const entries: Array<{ provider: string; externalId: string; normalizedExternalId: string; game: Game; source: string }> = [];
  const push = (game: Game, provider: string, externalId: string | null | undefined, source: string) => {
    const cleanProvider = provider.trim().toLowerCase();
    const cleanId = externalId?.trim();
    if (!cleanId || (providerSet && !providerSet.has(cleanProvider))) return;
    entries.push({ provider: cleanProvider, externalId: cleanId, normalizedExternalId: cleanId.toLowerCase(), game, source });
  };
  for (const game of games) {
    push(game, 'vndb', game.vndbId, 'games.vndbId');
    push(game, 'bangumi', game.bangumiId, 'games.bangumiId');
    push(game, 'dlsite', game.dlsiteId, 'games.dlsiteId');
    push(game, 'fanza', game.fanzaId, 'games.fanzaId');
    push(game, 'ymgal', game.ymgalId, 'games.ymgalId');
  }
  return entries;
}

export function mockDuplicateExternalIdPreview(games: Game[], options: DuplicateExternalIdAuditOptions = {}): DuplicateExternalIdPreview {
  const limit = Math.max(1, Math.min(Number(options.limit ?? 50) || 50, 500));
  const groups = new Map<string, DuplicateExternalIdGroup>();
  for (const entry of mockExternalIdEntries(games, options)) {
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

export function gameExternalIds(game: Game): DuplicateGameMergeExternalId[] {
  const items: DuplicateGameMergeExternalId[] = [];
  const push = (provider: string, externalId?: string | null) => {
    const cleanId = externalId?.trim();
    if (!cleanId) return;
    if (items.some((item) => item.provider === provider && item.externalId.toLowerCase() === cleanId.toLowerCase())) return;
    items.push({ provider, externalId: cleanId });
  };
  push('vndb', game.vndbId);
  push('bangumi', game.bangumiId);
  push('dlsite', game.dlsiteId);
  push('fanza', game.fanzaId);
  push('ymgal', game.ymgalId);
  return items;
}

export function mockDuplicateGameMergePreview(
  games: Game[],
  context: { collectionLinks: CollectionGameLink[]; assets: GameAsset[]; fieldLocks: Record<string, FieldLock[]> },
  options: DuplicateGameMergeOptions
): DuplicateGameMergePreview {
  const target = games.find((game) => game.id === options.targetGameId);
  const sources = cleanList(options.sourceGameIds).map((id) => games.find((game) => game.id === id)).filter(Boolean) as Game[];
  if (!target) throw new Error('target game not found');
  if (sources.length === 0) throw new Error('at least one source game is required');
  const targetKeys = new Set(gameExternalIds(target).map((item) => `${item.provider}:${item.externalId.toLowerCase()}`));
  const shared = new Map<string, DuplicateGameMergeExternalId>();
  const warnings: string[] = [];
  for (const source of sources) {
    const sourceShared = gameExternalIds(source).filter((item) => targetKeys.has(`${item.provider}:${item.externalId.toLowerCase()}`));
    if (sourceShared.length === 0) throw new Error(`${source.title} does not share an external id with target`);
    for (const item of sourceShared) shared.set(`${item.provider}:${item.externalId.toLowerCase()}`, item);
    if (target.description?.trim() && source.description?.trim() && target.description.trim() !== source.description.trim()) warnings.push(`${source.title} 的简介与目标不同，目标已有值会保留。`);
  }
  const movedCounts = {
    sourceGames: sources.length,
    playSessions: 0,
    launchProfiles: 0,
    savePaths: 0,
    saveBackups: 0,
    externalIds: sources.reduce((sum, source) => sum + gameExternalIds(source).length, 0),
    collectionLinks: context.collectionLinks.filter((link) => options.sourceGameIds.includes(link.gameId)).length,
    assets: context.assets.filter((asset) => options.sourceGameIds.includes(asset.gameId)).length,
    tags: sources.reduce((sum, source) => sum + source.tags.length + source.genres.length, 0),
    fieldLocks: sources.reduce((sum, source) => sum + (context.fieldLocks[source.id]?.length ?? 0), 0),
    metadataMatchResults: 0,
  };
  const summary = (game: Game) => ({
    gameId: game.id,
    title: game.title,
    installPath: game.installPath,
    externalIds: gameExternalIds(game),
    totalPlaySeconds: game.totalPlaySeconds,
    lastPlayedAt: game.lastPlayedAt ?? null,
  });
  return { target: summary(target), sources: sources.map(summary), sharedExternalIds: [...shared.values()], movedCounts, warnings };
}

type MockStoreDuplicateDependencies = {
  readGames: () => Game[];
  writeGames: (games: Game[]) => void;
  readCollectionLinks: () => CollectionGameLink[];
  writeCollectionLinks: (links: CollectionGameLink[]) => void;
  readAssets: () => GameAsset[];
  writeAssets: (assets: GameAsset[]) => void;
  syncGameCompatibilityAssets: (game: Game) => void;
  readFieldLocks: () => Record<string, FieldLock[]>;
};

export function createMockStoreDuplicates({
  readGames,
  writeGames,
  readCollectionLinks,
  writeCollectionLinks,
  readAssets,
  writeAssets,
  syncGameCompatibilityAssets,
  readFieldLocks,
}: MockStoreDuplicateDependencies) {
  const mergeDuplicateGames = (options: DuplicateGameMergeOptions): DuplicateGameMergeResult => {
    const games = readGames().map(ensureGameDefaults);
    const preview = mockDuplicateGameMergePreview(games, {
      collectionLinks: readCollectionLinks(),
      assets: readAssets(),
      fieldLocks: readFieldLocks(),
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
  };

  return {
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
          fieldLocks: readFieldLocks(),
        }, options));
      } catch (reason) {
        return Promise.reject(reason);
      }
    },

    mergeDuplicateGames(options: DuplicateGameMergeOptions): Promise<DuplicateGameMergeResult> {
      try {
        return Promise.resolve(mergeDuplicateGames(options));
      } catch (reason) {
        return Promise.reject(reason);
      }
    },
  };
}
