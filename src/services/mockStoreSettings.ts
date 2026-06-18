import { defaultSettings } from './mockStoreFixtures';
import { SETTINGS_KEY, readSettings } from './mockStoreStorage';

export function createMockStoreSettings() {
  return {
    getAppSettings(): Promise<Record<string, string>> {
      return Promise.resolve(readSettings());
    },

    setAppSettings(settings: Record<string, string>) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultSettings, ...settings }));
      return Promise.resolve();
    },
  };
}
