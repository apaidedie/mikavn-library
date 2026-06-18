import type { SavedSearch, SavedSearchInput } from '@/types/metadata';
import { SAVED_SEARCHES_KEY, readJson, writeJson } from './mockStoreStorage';

export function createMockStoreSavedSearches() {
  return {
    listSavedSearches(): Promise<SavedSearch[]> {
      return Promise.resolve(readJson<SavedSearch[]>(SAVED_SEARCHES_KEY, []));
    },

    createSavedSearch(input: SavedSearchInput): Promise<SavedSearch> {
      const now = new Date().toISOString();
      const item: SavedSearch = { id: crypto.randomUUID(), name: input.name.trim(), query: input.query.trim(), description: input.description?.trim() || null, createdAt: now, updatedAt: now };
      if (!item.name || !item.query) return Promise.reject(new Error('Saved search name and query are required'));
      writeJson(SAVED_SEARCHES_KEY, [item, ...readJson<SavedSearch[]>(SAVED_SEARCHES_KEY, []).filter((saved) => saved.name !== item.name)]);
      return Promise.resolve(item);
    },

    updateSavedSearch(id: string, input: SavedSearchInput): Promise<SavedSearch> {
      const searches = readJson<SavedSearch[]>(SAVED_SEARCHES_KEY, []);
      const existing = searches.find((item) => item.id === id);
      if (!existing) return Promise.reject(new Error('Saved search not found'));
      const updated: SavedSearch = { ...existing, name: input.name.trim(), query: input.query.trim(), description: input.description?.trim() || null, updatedAt: new Date().toISOString() };
      writeJson(SAVED_SEARCHES_KEY, searches.map((item) => item.id === id ? updated : item));
      return Promise.resolve(updated);
    },

    deleteSavedSearch(id: string) {
      writeJson(SAVED_SEARCHES_KEY, readJson<SavedSearch[]>(SAVED_SEARCHES_KEY, []).filter((item) => item.id !== id));
      return Promise.resolve();
    },
  };
}
