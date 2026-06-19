import type { Game } from '@/types/game';
import type { LaunchProfile, LaunchProfileInput, LaunchProfileUpdate } from '@/types/launch';
import { ensureGameDefaults } from './mockStoreGames';
import { LAUNCH_PROFILES_KEY, readJson, writeJson } from './mockStoreStorage';

export function createMockStoreLaunchProfiles(readGames: () => Game[]) {
  return {
    async listLaunchProfiles(gameId: string): Promise<LaunchProfile[]> {
      const profiles = readJson<LaunchProfile[]>(LAUNCH_PROFILES_KEY, []).filter((item) => item.gameId === gameId);
      if (profiles.length) return profiles.sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.createdAt.localeCompare(b.createdAt));

      const game = readGames().map(ensureGameDefaults).find((item) => item.id === gameId);
      if (!game) return Promise.reject(new Error('Game not found'));
      if (!game.executablePath) return [];
      return [{
        id: `legacy-${game.id}`,
        gameId: game.id,
        name: '默认启动',
        executablePath: game.executablePath,
        workingDirectory: game.workingDirectory ?? game.installPath,
        arguments: game.launchArgs ?? null,
        environmentVariables: null,
        runnerType: 'direct',
        localeEmulatorPath: null,
        preLaunchCommand: null,
        postLaunchCommand: null,
        runAsAdmin: false,
        isDefault: true,
        compatibilityNotes: '来自旧版游戏启动字段',
        createdAt: game.createdAt,
        updatedAt: game.updatedAt,
      }];
    },

    createLaunchProfile(input: LaunchProfileInput): Promise<LaunchProfile> {
      const now = new Date().toISOString();
      const profiles = readJson<LaunchProfile[]>(LAUNCH_PROFILES_KEY, []);
      const firstForGame = !profiles.some((item) => item.gameId === input.gameId);
      const profile: LaunchProfile = {
        id: crypto.randomUUID(),
        gameId: input.gameId,
        name: input.name.trim() || '启动配置',
        executablePath: input.executablePath.trim(),
        workingDirectory: input.workingDirectory?.trim() || null,
        arguments: input.arguments?.trim() || null,
        environmentVariables: input.environmentVariables?.trim() || null,
        runnerType: input.runnerType || 'direct',
        localeEmulatorPath: input.localeEmulatorPath?.trim() || null,
        preLaunchCommand: input.preLaunchCommand?.trim() || null,
        postLaunchCommand: input.postLaunchCommand?.trim() || null,
        runAsAdmin: Boolean(input.runAsAdmin),
        isDefault: Boolean(input.isDefault) || firstForGame,
        compatibilityNotes: input.compatibilityNotes?.trim() || null,
        createdAt: now,
        updatedAt: now,
      };
      const next = profile.isDefault ? profiles.map((item) => item.gameId === profile.gameId ? { ...item, isDefault: false } : item) : profiles;
      writeJson(LAUNCH_PROFILES_KEY, [profile, ...next]);
      return Promise.resolve(profile);
    },

    updateLaunchProfile(id: string, input: LaunchProfileUpdate): Promise<LaunchProfile> {
      const profiles = readJson<LaunchProfile[]>(LAUNCH_PROFILES_KEY, []);
      let updated: LaunchProfile | undefined;
      let next = profiles.map((profile) => {
        if (profile.id !== id) return profile;
        updated = {
          ...profile,
          ...input,
          runnerType: input.runnerType ?? profile.runnerType,
          runAsAdmin: input.runAsAdmin ?? profile.runAsAdmin,
          isDefault: input.isDefault ?? profile.isDefault,
          updatedAt: new Date().toISOString(),
        };
        return updated;
      });
      if (!updated) return Promise.reject(new Error('Launch profile not found'));
      if (updated.isDefault) {
        next = next.map((profile) => profile.gameId === updated!.gameId && profile.id !== updated!.id ? { ...profile, isDefault: false } : profile);
      }
      writeJson(LAUNCH_PROFILES_KEY, next);
      return Promise.resolve(updated);
    },

    deleteLaunchProfile(id: string) {
      writeJson(LAUNCH_PROFILES_KEY, readJson<LaunchProfile[]>(LAUNCH_PROFILES_KEY, []).filter((profile) => profile.id !== id));
      return Promise.resolve();
    },

    setDefaultLaunchProfile(id: string): Promise<LaunchProfile> {
      const profiles = readJson<LaunchProfile[]>(LAUNCH_PROFILES_KEY, []);
      const target = profiles.find((profile) => profile.id === id);
      if (!target) return Promise.reject(new Error('Launch profile not found'));
      const next = profiles.map((profile) => profile.gameId === target.gameId ? { ...profile, isDefault: profile.id === id, updatedAt: new Date().toISOString() } : profile);
      writeJson(LAUNCH_PROFILES_KEY, next);
      return Promise.resolve(next.find((profile) => profile.id === id)!);
    },
  };
}
