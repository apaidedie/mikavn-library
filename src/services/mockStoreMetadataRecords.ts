import type { Game } from '@/types/game';
import type { ExternalIdRecord, FieldLock, MetadataSearchResult, MetadataSourceRecord, NormalizedMetadata } from '@/types/metadata';
import { mockMetadata } from './mockStoreFixtures';
import { FIELD_LOCKS_KEY, readJson, writeJson } from './mockStoreStorage';

function toMetadata(result: MetadataSearchResult): NormalizedMetadata {
  return {
    provider: result.provider,
    id: result.id,
    title: result.title,
    originalTitle: result.provider === 'vndb' ? result.title : null,
    aliases: [],
    description: result.description,
    releaseDate: result.releaseDate,
    developers: result.developers,
    publishers: [],
    tags: result.tags,
    genres: ['Visual Novel'],
    images: result.imageUrl ? [result.imageUrl] : [],
    externalIds: result.externalIds,
    ageRating: null,
  };
}

export function createMockStoreMetadataRecords(getGame: (id: string) => Promise<Game>) {
  const setFieldLock = (gameId: string, fieldName: string, lockedByUser: boolean): Promise<FieldLock> => {
    const now = new Date().toISOString();
    const locks = readJson<FieldLock[]>(FIELD_LOCKS_KEY, []);
    const existing = locks.find((lock) => lock.gameId === gameId && lock.fieldName === fieldName);
    const nextLock: FieldLock = existing
      ? { ...existing, lockedByUser, updatedAt: now }
      : { id: crypto.randomUUID(), gameId, fieldName, lockedByUser, updatedAt: now };
    writeJson(FIELD_LOCKS_KEY, [nextLock, ...locks.filter((lock) => !(lock.gameId === gameId && lock.fieldName === fieldName))]);
    return Promise.resolve(nextLock);
  };

  return {
    getMetadataDetail(provider: string, id: string): Promise<NormalizedMetadata> {
      const result = mockMetadata.find((item) => item.provider === provider && item.id === id) ?? mockMetadata[0];
      return Promise.resolve(toMetadata(result));
    },

    listMetadataSources(): Promise<MetadataSourceRecord[]> {
      const now = new Date().toISOString();
      return Promise.resolve([
        { id: 'source-vndb', provider: 'vndb', label: 'VNDB', enabled: true, priority: 10, createdAt: now, updatedAt: now },
        { id: 'source-dlsite', provider: 'dlsite', label: 'DLsite', enabled: true, priority: 20, createdAt: now, updatedAt: now },
        { id: 'source-fanza', provider: 'fanza', label: 'FANZA', enabled: true, priority: 30, createdAt: now, updatedAt: now },
        { id: 'source-bangumi', provider: 'bangumi', label: 'Bangumi', enabled: true, priority: 40, createdAt: now, updatedAt: now },
        { id: 'source-ymgal', provider: 'ymgal', label: 'YMGal', enabled: true, priority: 50, createdAt: now, updatedAt: now },
      ]);
    },

    async listExternalIds(gameId: string): Promise<ExternalIdRecord[]> {
      const game = await getGame(gameId);
      const now = new Date().toISOString();
      return [
        game.vndbId ? { id: `${game.id}-vndb`, gameId: game.id, provider: 'vndb', externalId: game.vndbId, source: 'games', confidence: null, createdAt: now, updatedAt: now } : null,
        game.bangumiId ? { id: `${game.id}-bangumi`, gameId: game.id, provider: 'bangumi', externalId: game.bangumiId, source: 'games', confidence: null, createdAt: now, updatedAt: now } : null,
        game.dlsiteId ? { id: `${game.id}-dlsite`, gameId: game.id, provider: 'dlsite', externalId: game.dlsiteId, source: 'games', confidence: null, createdAt: now, updatedAt: now } : null,
        game.fanzaId ? { id: `${game.id}-fanza`, gameId: game.id, provider: 'fanza', externalId: game.fanzaId, source: 'games', confidence: null, createdAt: now, updatedAt: now } : null,
        game.ymgalId ? { id: `${game.id}-ymgal`, gameId: game.id, provider: 'ymgal', externalId: game.ymgalId, source: 'games', confidence: null, createdAt: now, updatedAt: now } : null,
      ].filter(Boolean) as ExternalIdRecord[];
    },

    listFieldLocks(gameId: string): Promise<FieldLock[]> {
      return Promise.resolve(readJson<FieldLock[]>(FIELD_LOCKS_KEY, []).filter((lock) => lock.gameId === gameId));
    },

    setFieldLock,

    async setFieldLocks(gameId: string, fieldNames: string[], lockedByUser: boolean): Promise<FieldLock[]> {
      const result: FieldLock[] = [];
      for (const fieldName of [...new Set(fieldNames.map((item) => item.trim()).filter(Boolean))]) {
        result.push(await setFieldLock(gameId, fieldName, lockedByUser));
      }
      return result;
    },
  };
}
