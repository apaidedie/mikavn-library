import type { CollectionGameLink, GameCollection } from '@/types/game';
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
