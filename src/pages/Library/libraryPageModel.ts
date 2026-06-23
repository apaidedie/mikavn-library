import type { AddGameInput, Game, PlayStatus } from '@/types/game';

export const libraryStatuses: Array<PlayStatus | 'all'> = ['all', 'planned', 'playing', 'completed', 'paused', 'archived'];
export const libraryListInitialRenderCount = 240;
export const libraryListRenderBatchSize = 240;
export const libraryGridInitialRenderCount = 160;
export const libraryGridRenderBatchSize = 160;
export const librarySelectedRenderExpansionCap = 960;
export const libraryBulkSelectionConfirmThreshold = 100;
export const libraryBulkWriteBatchSize = 24;

export type LibraryGameGroup = {
  id: PlayStatus | 'recent' | 'selected' | 'all';
  label: string;
  games: Game[];
};

export type LibraryRenderWindow = {
  primaryGames: Game[];
  selectedGame: Game | null;
  selectedIndex: number;
  selectedPinned: boolean;
  renderedCount: number;
  hasMore: boolean;
};

export function buildLibraryGameLookup(games: Game[]) {
  const lookup = new Map<string, Game>();
  for (const game of games) {
    lookup.set(game.id, game);
  }
  return lookup;
}

export function buildLibraryGameIndexLookup(games: Game[]) {
  const lookup = new Map<string, number>();
  games.forEach((game, index) => {
    lookup.set(game.id, index);
  });
  return lookup;
}

export function getLibraryRenderIdentity(games: Game[]) {
  // Keep this identity compact; it is recalculated for large filtered result sets.
  let hash = 2166136261;
  for (const game of games) {
    for (let index = 0; index < game.id.length; index += 1) {
      hash ^= game.id.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= 58;
    hash = Math.imul(hash, 16777619);
  }
  return `${games.length}:${(hash >>> 0).toString(36)}`;
}

export function groupLibraryGames(games: Game[], statusLabels: Record<PlayStatus, string>): LibraryGameGroup[] {
  const recent: Game[] = [];
  const buckets = new Map<PlayStatus, Game[]>();

  for (const game of games) {
    if (game.lastPlayedAt && recent.length < 7) {
      recent.push(game);
      continue;
    }

    const items = buckets.get(game.playStatus) ?? [];
    items.push(game);
    buckets.set(game.playStatus, items);
  }

  const groups: LibraryGameGroup[] = recent.length > 0 ? [{ id: 'recent', label: '最近游玩', games: recent }] : [];
  for (const status of libraryStatuses) {
    if (status === 'all') continue;
    const items = buckets.get(status);
    if (items?.length) {
      groups.push({ id: status, label: statusLabels[status], games: items });
    }
  }

  return groups.length > 0 ? groups : [{ id: 'all', label: '全部游戏', games }];
}

export function getLibraryVisibleCount(totalCount: number, renderCount: number, selectedIndex: number) {
  const current = Math.min(totalCount, renderCount);
  if (selectedIndex < current) return current;
  const selectedTarget = selectedIndex + 1;
  return Math.min(totalCount, Math.max(current, Math.min(selectedTarget, librarySelectedRenderExpansionCap)));
}

export function getLibraryRenderWindow(games: Game[], renderCount: number, selectedId: string | null, selectedIndexLookup?: ReadonlyMap<string, number>): LibraryRenderWindow {
  const primaryCount = Math.max(0, Math.min(games.length, renderCount));
  const selectedIndex = selectedId ? selectedIndexLookup?.get(selectedId) ?? games.findIndex((game) => game.id === selectedId) : -1;
  const selectedPinned = selectedIndex >= primaryCount;
  const selectedGame = selectedPinned ? games[selectedIndex] ?? null : null;

  return {
    primaryGames: games.slice(0, primaryCount),
    selectedGame,
    selectedIndex,
    selectedPinned,
    renderedCount: primaryCount + (selectedGame ? 1 : 0),
    hasMore: primaryCount < games.length,
  };
}

export function formatLibraryCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

export function formatLibraryLoadMoreLabel(visibleCount: number, totalCount: number) {
  return `加载更多 ${formatLibraryCount(visibleCount)} / ${formatLibraryCount(totalCount)}`;
}

export function formatLibraryBulkConfirmation(count: number, label: string) {
  return `确认对当前筛选范围内已选的 ${formatLibraryCount(count)} 个游戏执行批量操作：${label}？\n此操作只修改 MikaVN 数据库记录，不会删除真实游戏文件。`;
}

export function formatLibraryBulkSelectionConfirmation(count: number) {
  return `确认选中当前筛选出的 ${formatLibraryCount(count)} 个游戏？\n后续批量操作仍会再次确认。建议先缩小筛选范围，避免误操作。`;
}

export function changedLibraryMetadataFields(game: Game, input: AddGameInput) {
  const fields: string[] = [];
  const normalize = (value?: string | null) => value?.trim() || '';
  const normalizeList = (values?: string[] | null) => (values ?? []).map((item) => item.trim()).filter(Boolean).join('\n');

  if (normalize(game.title) !== normalize(input.title)) fields.push('title');
  if (normalize(game.originalTitle) !== normalize(input.originalTitle)) fields.push('originalTitle');
  if (normalize(game.description) !== normalize(input.description)) fields.push('description');
  if (normalize(game.notes) !== normalize(input.notes)) fields.push('notes');
  if (normalize(game.releaseDate) !== normalize(input.releaseDate)) fields.push('releaseDate');
  if (normalize(game.developer) !== normalize(input.developer)) fields.push('developer');
  if (normalize(game.publisher) !== normalize(input.publisher)) fields.push('publisher');
  if (normalize(game.coverImage) !== normalize(input.coverImage)) fields.push('coverImage');
  if (normalize(game.ageRating) !== normalize(input.ageRating)) fields.push('ageRating');
  if (normalizeList(game.tags) !== normalizeList(input.tags)) fields.push('tags');
  if (normalizeList(game.genres) !== normalizeList(input.genres)) fields.push('genres');
  if (normalize(game.vndbId) !== normalize(input.vndbId) || normalize(game.dlsiteId) !== normalize(input.dlsiteId) || normalize(game.fanzaId) !== normalize(input.fanzaId) || normalize(game.bangumiId) !== normalize(input.bangumiId) || normalize(game.ymgalId) !== normalize(input.ymgalId)) fields.push('externalIds');

  return fields;
}
