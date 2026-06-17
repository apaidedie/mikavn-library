import type { Game } from '@/types/game';
import type { DuplicateExternalIdAuditOptions, DuplicateExternalIdGroup, DuplicateExternalIdPreview, DuplicateGameMergeExternalId } from '@/types/metadata';

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
