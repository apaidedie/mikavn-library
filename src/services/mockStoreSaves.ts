import type { Game } from '@/types/game';
import type { SaveBackup, SavePath, SavePathCandidate, SaveRestoreMode, SaveRestorePreview } from '@/types/saves';
import type { TaskRecord } from '@/types/task';
import { ensureGameDefaults } from './mockStoreGames';
import { SAVE_BACKUPS_KEY, SAVE_PATHS_KEY, readJson, writeJson } from './mockStoreStorage';
import { addTaskLog, makeTask } from './mockStoreTasks';

export function mockSavePathCandidates(game: Game, existing: Set<string>): SavePathCandidate[] {
  const install = game.installPath.replace(/[\\/]$/, '');
  return ['save', 'savedata', 'SaveData'].map((folder) => {
    const candidatePath = `${install}\\${folder}`;
    return {
      label: '游戏目录存档',
      path: candidatePath,
      reason: '浏览器预览候选：安装目录下的常见存档文件夹',
      exists: true,
      alreadyAdded: existing.has(candidatePath.toLowerCase()),
    };
  });
}

export function mockSaveRestorePreview(backup: SaveBackup, mode: SaveRestoreMode = 'merge'): SaveRestorePreview {
  return {
    mode,
    backupPath: backup.backupPath,
    savePath: backup.sourcePath,
    backupFileCount: 3,
    currentFileCount: 4,
    newFiles: 1,
    overwrittenFiles: 2,
    keptFiles: mode === 'merge' ? 2 : 0,
    removedFiles: mode === 'mirror' ? 4 : 0,
    sampleNewFiles: ['new-slot.dat'],
    sampleOverwrittenFiles: ['slot1.dat', 'nested/slot2.dat'],
    sampleKeptFiles: mode === 'merge' ? ['local-only.dat', 'config/user.ini'] : [],
    sampleRemovedFiles: mode === 'mirror' ? ['slot1.dat', 'local-only.dat', 'config/user.ini'] : [],
  };
}

export function createMockStoreSaves(readGames: () => Game[]) {
  const getGame = (id: string) => {
    const game = readGames().map(ensureGameDefaults).find((item) => item.id === id);
    return game ? Promise.resolve(game) : Promise.reject(new Error('Game not found'));
  };

  const createSaveBackup = (savePathId: string, label: string): Promise<SaveBackup> => {
    const savePath = readJson<SavePath[]>(SAVE_PATHS_KEY, []).find((item) => item.id === savePathId);
    if (!savePath) return Promise.reject(new Error('Save path not found'));
    const item: SaveBackup = {
      id: crypto.randomUUID(),
      gameId: savePath.gameId,
      savePathId,
      label: label.trim() || savePath.label,
      sourcePath: savePath.path,
      backupPath: `mock://save-backups/${savePath.gameId}/${Date.now()}`,
      protection: false,
      createdAt: new Date().toISOString(),
    };
    writeJson(SAVE_BACKUPS_KEY, [item, ...readJson<SaveBackup[]>(SAVE_BACKUPS_KEY, [])]);
    return Promise.resolve(item);
  };

  const restoreSaveBackup = (backupId: string): Promise<SaveBackup> => {
    const backup = readJson<SaveBackup[]>(SAVE_BACKUPS_KEY, []).find((item) => item.id === backupId);
    if (!backup) return Promise.reject(new Error('Save backup not found'));
    const protection: SaveBackup = { ...backup, id: crypto.randomUUID(), label: '恢复前保护备份', protection: true, createdAt: new Date().toISOString() };
    writeJson(SAVE_BACKUPS_KEY, [protection, ...readJson<SaveBackup[]>(SAVE_BACKUPS_KEY, [])]);
    return Promise.resolve(protection);
  };

  return {
    listSavePaths(gameId: string): Promise<SavePath[]> {
      return Promise.resolve(readJson<SavePath[]>(SAVE_PATHS_KEY, []).filter((item) => item.gameId === gameId));
    },

    addSavePath(gameId: string, label: string, path: string): Promise<SavePath> {
      const item: SavePath = { id: crypto.randomUUID(), gameId, label: label.trim() || '存档', path: path.trim(), createdAt: new Date().toISOString() };
      writeJson(SAVE_PATHS_KEY, [item, ...readJson<SavePath[]>(SAVE_PATHS_KEY, [])]);
      return Promise.resolve(item);
    },

    removeSavePath(id: string) {
      writeJson(SAVE_PATHS_KEY, readJson<SavePath[]>(SAVE_PATHS_KEY, []).filter((item) => item.id !== id));
      return Promise.resolve();
    },

    async suggestSavePaths(gameId: string): Promise<SavePathCandidate[]> {
      const game = await getGame(gameId);
      const existing = new Set(readJson<SavePath[]>(SAVE_PATHS_KEY, []).filter((item) => item.gameId === gameId).map((item) => item.path.toLowerCase()));
      return mockSavePathCandidates(game, existing);
    },

    createSaveBackup,

    async createSaveBackupTask(savePathId: string, label: string): Promise<TaskRecord> {
      const backup = await createSaveBackup(savePathId, label);
      return makeTask({
        taskType: 'save.backup',
        status: 'completed',
        progress: 1,
        message: `浏览器预览已创建备份：${backup.label}`,
        error: null,
        retryPayload: JSON.stringify({ savePathId, label }),
        retryable: true,
      });
    },

    listSaveBackups(gameId: string): Promise<SaveBackup[]> {
      return Promise.resolve(readJson<SaveBackup[]>(SAVE_BACKUPS_KEY, []).filter((item) => item.gameId === gameId));
    },

    restoreSaveBackup,

    async restoreSaveBackupTask(backupId: string, mode: 'merge' | 'mirror' = 'merge'): Promise<TaskRecord> {
      const protection = await restoreSaveBackup(backupId);
      const copiedFiles = 2;
      const removedFiles = mode === 'mirror' ? 2 : 0;
      const task = makeTask({
        taskType: 'save.restore',
        status: 'completed',
        progress: 1,
        message: `浏览器预览已模拟${mode === 'mirror' ? '镜像' : '合并'}恢复存档：复制 ${copiedFiles} 个文件，清理 ${removedFiles} 个文件`,
        error: null,
        retryPayload: JSON.stringify({ backupId, mode }),
        retryable: true,
      });
      addTaskLog(task.id, 'info', `存档恢复保护备份：${protection.backupPath}`);
      addTaskLog(task.id, 'info', `存档恢复报告：模式 ${mode === 'mirror' ? '镜像' : '合并'}，复制 ${copiedFiles} 个文件，清理 ${removedFiles} 个文件。`);
      return task;
    },

    previewSaveRestore(backupId: string, mode: SaveRestoreMode = 'merge'): Promise<SaveRestorePreview> {
      const backup = readJson<SaveBackup[]>(SAVE_BACKUPS_KEY, []).find((item) => item.id === backupId);
      if (!backup) return Promise.reject(new Error('Save backup not found'));
      return Promise.resolve(mockSaveRestorePreview(backup, mode));
    },

    deleteSaveBackupRecord(id: string) {
      writeJson(SAVE_BACKUPS_KEY, readJson<SaveBackup[]>(SAVE_BACKUPS_KEY, []).filter((item) => item.id !== id));
      return Promise.resolve();
    },
  };
}
