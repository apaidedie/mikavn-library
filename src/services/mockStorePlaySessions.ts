import type { Game, PlaySession } from '@/types/game';
import type { LaunchProfile } from '@/types/launch';
import { ensureGameDefaults } from './mockStoreGames';
import { PLAY_SESSIONS_KEY, readJson, writeJson } from './mockStoreStorage';

type MockStorePlaySessionDependencies = {
  readGames: () => Game[];
  writeGames: (games: Game[]) => void;
  listLaunchProfiles: (gameId: string) => Promise<LaunchProfile[]>;
};

export function createMockStorePlaySessions({ readGames, writeGames, listLaunchProfiles }: MockStorePlaySessionDependencies) {
  const launchGameWithProfile = async (id: string, profileId?: string | null): Promise<PlaySession> => {
    const game = readGames().map(ensureGameDefaults).find((item) => item.id === id);
    if (!game) return Promise.reject(new Error('Game not found'));
    const profiles = await listLaunchProfiles(id);
    const profile = profiles.find((item) => item.id === profileId) ?? profiles.find((item) => item.isDefault) ?? profiles[0];
    if (!profile?.executablePath) {
      return Promise.reject(new Error('Launch executable does not exist'));
    }
    if (profile.runnerType === 'locale_emulator' && !profile.localeEmulatorPath) {
      return Promise.reject(new Error('Locale Emulator path is required'));
    }
    const startedAt = new Date().toISOString();
    const durationSeconds = 1800;
    const endedAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
    const session: PlaySession = {
      id: crypto.randomUUID(),
      gameId: game.id,
      launchProfileId: profile.id.startsWith('legacy-') ? null : profile.id,
      startedAt,
      endedAt,
      durationSeconds,
      exitStatus: profile.runAsAdmin ? 'mock_elevated' : 'mock',
    };
    writeJson(PLAY_SESSIONS_KEY, [session, ...readJson<PlaySession[]>(PLAY_SESSIONS_KEY, [])].slice(0, 200));
    writeGames(readGames().map((item) => item.id === id ? { ...item, lastPlayedAt: startedAt, totalPlaySeconds: item.totalPlaySeconds + durationSeconds, updatedAt: startedAt } : item));
    return session;
  };

  return {
    launchGame(id: string): Promise<PlaySession> {
      return launchGameWithProfile(id, null);
    },

    launchGameWithProfile,

    listPlaySessions(gameId: string, limit = 50): Promise<PlaySession[]> {
      const sessions = readJson<PlaySession[]>(PLAY_SESSIONS_KEY, []).filter((session) => session.gameId === gameId);
      if (sessions.length === 0 && gameId === 'sample-1') {
        const startedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        return Promise.resolve([{
          id: 'mock-session-1',
          gameId,
          launchProfileId: null,
          startedAt,
          endedAt: new Date(Date.parse(startedAt) + 1800 * 1000).toISOString(),
          durationSeconds: 1800,
          exitStatus: '0',
        }]);
      }
      return Promise.resolve(sessions.slice(0, Math.max(1, Math.min(limit, 200))));
    },
  };
}
