import type { Game, TagRecord } from '@/types/game';
import { cleanList } from './mockStoreGames';

export function syncGameTags(games: Game[]) {
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
