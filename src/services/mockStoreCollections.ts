import type { CollectionGameLink, CollectionInput, Game, GameCollection } from '@/types/game';
import { ensureGameDefaults } from './mockStoreGames';
import { COLLECTION_GAMES_KEY, COLLECTIONS_KEY, readJson, writeJson } from './mockStoreStorage';

export function readCollections() {
  return readJson<GameCollection[]>(COLLECTIONS_KEY, []);
}

export function writeCollections(collections: GameCollection[]) {
  writeJson(COLLECTIONS_KEY, collections);
}

export function readCollectionLinks() {
  return readJson<CollectionGameLink[]>(COLLECTION_GAMES_KEY, []);
}

export function writeCollectionLinks(links: CollectionGameLink[]) {
  writeJson(COLLECTION_GAMES_KEY, links);
}

export function withCollectionCounts(collections = readCollections()) {
  const links = readCollectionLinks();
  return collections.map((collection) => ({
    ...collection,
    gameCount: links.filter((link) => link.collectionId === collection.id).length,
  }));
}

export function createMockStoreCollections(readGames: () => Game[]) {
  return {
    listCollections() {
      return Promise.resolve(withCollectionCounts().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
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
  };
}
