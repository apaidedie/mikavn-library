import type { Game, LibraryRoot, ScanCandidate, ScanConflict } from '@/types/game';
import type { ScanTaskStatus, TaskRecord } from '@/types/task';
import { ensureGameDefaults } from './mockStoreGames';
import { LIBRARY_ROOTS_KEY, SCAN_TASKS_KEY, readJson, writeJson } from './mockStoreStorage';
import { makeTask } from './mockStoreTasks';

export function normalizeMockPath(value: string) {
  return value.trim().replace(/[/]+/g, '\\').replace(/[\\/]+$/g, '').toLowerCase();
}

function normalizeMockTitle(value: string) {
  return value.trim().replace(/[\s　_-]+/g, '').toLowerCase();
}

export function findScanConflict(games: Game[], installPath: string, title: string): ScanConflict | null {
  const found = games.find((game) => normalizeMockPath(game.installPath) === normalizeMockPath(installPath) || normalizeMockTitle(game.title) === normalizeMockTitle(title));
  return found ? { gameId: found.id, title: found.title, reason: normalizeMockPath(found.installPath) === normalizeMockPath(installPath) ? '安装目录已存在' : '标题相同' } : null;
}

export function mockScanPathPreview(games: Game[], path: string, recursive: boolean): ScanCandidate[] {
  const root = path.trim() || 'D:\\Games\\VisualNovel';
  const baseDepth = recursive ? 'ゆずソフト\\天使騒々' : '天使騒々';
  return [
    {
      id: crypto.randomUUID(),
      rootPath: root,
      installPath: `${root}\\星之终途`,
      folderName: '[汉化硬盘版] 星之终途 v1.02',
      suggestedTitle: '星之终途',
      aliases: ['[汉化硬盘版] 星之终途 v1.02'],
      executables: [{ name: 'stella.exe', path: `${root}\\星之终途\\stella.exe` }],
      selectedExecutable: `${root}\\星之终途\\stella.exe`,
      conflict: findScanConflict(games, `${root}\\星之终途`, '星之终途'),
    },
    {
      id: crypto.randomUUID(),
      rootPath: root,
      installPath: `${root}\\${baseDepth}`,
      folderName: '[230428][ゆずソフト] 天使☆騒々 RE-BOOT!',
      suggestedTitle: '天使☆騒々 RE-BOOT!',
      aliases: ['[230428][ゆずソフト] 天使☆騒々 RE-BOOT!'],
      executables: [{ name: '天使騒々.exe', path: `${root}\\${baseDepth}\\天使騒々.exe` }],
      selectedExecutable: `${root}\\${baseDepth}\\天使騒々.exe`,
      conflict: findScanConflict(games, `${root}\\${baseDepth}`, '天使☆騒々 RE-BOOT!'),
    },
  ];
}

export function createMockStoreScanner(readGames: () => Game[]) {
  const scanPathPreview = (path: string, recursive: boolean): Promise<ScanCandidate[]> => (
    Promise.resolve(mockScanPathPreview(readGames().map(ensureGameDefaults), path, recursive))
  );

  return {
    addLibraryRoot(path: string): Promise<LibraryRoot> {
      const cleanPath = path.trim();
      if (!cleanPath) return Promise.reject(new Error('Library root path is required'));
      const roots = readJson<LibraryRoot[]>(LIBRARY_ROOTS_KEY, []);
      const existing = roots.find((root) => normalizeMockPath(root.path) === normalizeMockPath(cleanPath));
      if (existing) return Promise.resolve(existing);
      const root: LibraryRoot = { id: crypto.randomUUID(), path: cleanPath, recursive: true, enabled: true, createdAt: new Date().toISOString() };
      writeJson(LIBRARY_ROOTS_KEY, [root, ...roots]);
      return Promise.resolve(root);
    },

    listLibraryRoots(): Promise<LibraryRoot[]> {
      return Promise.resolve(readJson<LibraryRoot[]>(LIBRARY_ROOTS_KEY, []));
    },

    updateLibraryRoot(id: string, input: { recursive?: boolean; enabled?: boolean }): Promise<LibraryRoot> {
      const roots = readJson<LibraryRoot[]>(LIBRARY_ROOTS_KEY, []);
      const root = roots.find((item) => item.id === id);
      if (!root) return Promise.reject(new Error('Library root not found'));
      const updated: LibraryRoot = { ...root, recursive: input.recursive ?? root.recursive, enabled: input.enabled ?? root.enabled };
      writeJson(LIBRARY_ROOTS_KEY, [updated, ...roots.filter((item) => item.id !== id)]);
      return Promise.resolve(updated);
    },

    removeLibraryRoot(id: string): Promise<void> {
      writeJson(LIBRARY_ROOTS_KEY, readJson<LibraryRoot[]>(LIBRARY_ROOTS_KEY, []).filter((root) => root.id !== id));
      return Promise.resolve();
    },

    scanLibraryRoot(id: string): Promise<ScanCandidate[]> {
      const root = readJson<LibraryRoot[]>(LIBRARY_ROOTS_KEY, []).find((item) => item.id === id);
      if (!root) return Promise.reject(new Error('Library root not found'));
      if (!root.enabled) return Promise.reject(new Error('Library root is disabled'));
      return scanPathPreview(root.path, root.recursive);
    },

    scanPathPreview,

    async startScanTask(path: string, recursive: boolean): Promise<TaskRecord> {
      const task = makeTask({
        taskType: 'library.scan',
        status: 'completed',
        progress: 1,
        message: '浏览器预览扫描已完成',
        error: null,
        retryPayload: JSON.stringify({ path, recursive }),
        retryable: true,
      });
      const candidates = await scanPathPreview(path, recursive);
      const status: ScanTaskStatus = { task, path, recursive, candidates };
      writeJson(SCAN_TASKS_KEY, { ...readJson<Record<string, ScanTaskStatus>>(SCAN_TASKS_KEY, {}), [task.id]: status });
      return task;
    },

    getScanTaskStatus(taskId: string): Promise<ScanTaskStatus> {
      const status = readJson<Record<string, ScanTaskStatus>>(SCAN_TASKS_KEY, {})[taskId];
      if (!status) {
        return Promise.reject(new Error('Scan task not found'));
      }
      return Promise.resolve(status);
    },
  };
}
