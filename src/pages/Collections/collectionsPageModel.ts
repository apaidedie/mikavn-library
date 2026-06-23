import type { Game } from '@/types/game';

export const collectionGamesInitialRenderCount = 120;
export const collectionGamesRenderBatchSize = 120;

export type CollectionGameRenderWindow = {
  visibleGames: Game[];
  visibleCount: number;
  totalCount: number;
  hasMore: boolean;
};

export function getCollectionGameRenderWindow(games: Game[], renderCount: number): CollectionGameRenderWindow {
  const totalCount = games.length;
  const safeRenderCount = Number.isFinite(renderCount) ? Math.max(0, Math.floor(renderCount)) : 0;
  const visibleCount = Math.min(totalCount, safeRenderCount);

  return {
    visibleGames: games.slice(0, visibleCount),
    visibleCount,
    totalCount,
    hasMore: visibleCount < totalCount,
  };
}

export function formatCollectionGamesLoadMoreLabel(visibleCount: number, totalCount: number) {
  const formatter = new Intl.NumberFormat('zh-CN');
  return `加载更多 ${formatter.format(visibleCount)} / ${formatter.format(totalCount)}`;
}
