import { defaultSettings } from './mockStoreFixtures';

export const STORAGE_KEY = 'mikavn-library.mock.games';
export const BATCH_KEY = 'mikavn-library.mock.batch';
export const SETTINGS_KEY = 'mikavn-library.mock.settings';
export const SAVE_PATHS_KEY = 'mikavn-library.mock.savePaths';
export const SAVE_BACKUPS_KEY = 'mikavn-library.mock.saveBackups';
export const PLAY_SESSIONS_KEY = 'mikavn-library.mock.playSessions';
export const SCAN_TASKS_KEY = 'mikavn-library.mock.scanTasks';
export const TASKS_KEY = 'mikavn-library.mock.tasks';
export const TASK_LOGS_KEY = 'mikavn-library.mock.taskLogs';
export const TASK_RETRY_PAYLOADS_KEY = 'mikavn-library.mock.taskRetryPayloads';
export const LAUNCH_PROFILES_KEY = 'mikavn-library.mock.launchProfiles';
export const FIELD_LOCKS_KEY = 'mikavn-library.mock.fieldLocks';
export const COLLECTIONS_KEY = 'mikavn-library.mock.collections';
export const COLLECTION_GAMES_KEY = 'mikavn-library.mock.collectionGames';
export const ASSETS_KEY = 'mikavn-library.mock.assets';
export const LIBRARY_ROOTS_KEY = 'mikavn-library.mock.libraryRoots';
export const SAVED_SEARCHES_KEY = 'mikavn-library.mock.savedSearches';

export function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function readSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return defaultSettings;
  }

  try {
    return { ...defaultSettings, ...JSON.parse(raw) as Record<string, string> };
  } catch {
    return defaultSettings;
  }
}
