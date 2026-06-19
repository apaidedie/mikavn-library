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

export function createMockStoreTags(readGames: () => Game[], writeGames: (games: Game[]) => void) {
  return {
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
  };
}
