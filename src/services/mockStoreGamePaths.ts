import type { Game, GamePathHealth, PathCheckItem, UpdateGameInput } from '@/types/game';
import type { TaskRecord } from '@/types/task';
import { makeTask } from './mockStoreTasks';

type MockStoreGamePathsDependencies = {
  getGame: (id: string) => Promise<Game>;
  updateGame: (id: string, input: UpdateGameInput) => Promise<Game>;
};

export function createMockStoreGamePaths({ getGame, updateGame }: MockStoreGamePathsDependencies) {
  const checkGamePaths = async (id: string): Promise<GamePathHealth> => {
    const game = await getGame(id);
    const checkedAt = new Date().toISOString();
    const item = (kind: string, label: string, path?: string | null): PathCheckItem => ({
      kind,
      label,
      path: path ?? null,
      status: path ? 'ok' : 'not_configured',
      message: path ? null : '未配置',
    });
    const items = [
      item('install', '安装目录', game.installPath),
      item('executable', '启动程序', game.executablePath),
      item('workingDirectory', '工作目录', game.workingDirectory),
    ];
    const status: GamePathHealth['status'] = items.some((entry) => entry.status === 'not_configured') ? 'incomplete' : 'ok';
    await updateGame(id, { pathStatus: status, lastPathCheckedAt: checkedAt } as UpdateGameInput);
    return { gameId: id, status, checkedAt, items };
  };

  return {
    checkGamePaths,

    async checkGamePathsTask(id: string): Promise<TaskRecord> {
      const payload = JSON.stringify({ gameId: id });
      try {
        const health = await checkGamePaths(id);
        return makeTask({
          taskType: 'game.path_check',
          status: 'completed',
          progress: 1,
          message: health.status === 'ok' ? '路径检查完成，所有关键路径可用。' : health.status === 'broken' ? '路径检查完成，发现不可用路径。' : '路径检查完成，有部分路径尚未配置。',
          retryPayload: payload,
          retryable: true,
        });
      } catch (reason) {
        return makeTask({
          taskType: 'game.path_check',
          status: 'failed',
          progress: 1,
          message: '路径检查失败',
          error: reason instanceof Error ? reason.message : String(reason),
          retryPayload: payload,
          retryable: true,
        });
      }
    },

    async relocateGamePaths(id: string, installPath: string): Promise<Game> {
      const game = await getGame(id);
      const rewrite = (value?: string | null) => value?.startsWith(game.installPath) ? value.replace(game.installPath, installPath) : value;
      return updateGame(id, {
        installPath,
        executablePath: rewrite(game.executablePath) ?? undefined,
        workingDirectory: rewrite(game.workingDirectory) ?? installPath,
        pathStatus: 'unknown',
        lastPathCheckedAt: undefined,
      } as UpdateGameInput);
    },

    revealPath(path: string): Promise<void> {
      if (!path.trim()) return Promise.reject(new Error('Path is required'));
      return Promise.resolve();
    },
  };
}
