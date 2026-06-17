import type { CollectionGameLink, Game, GameAsset } from '@/types/game';
import type { DuplicateExternalIdAuditOptions, DuplicateExternalIdGroup, DuplicateExternalIdPreview, DuplicateGameMergeExternalId, DuplicateGameMergeOptions, DuplicateGameMergePreview, FieldLock } from '@/types/metadata';
import { cleanList } from './mockStoreGames';

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
