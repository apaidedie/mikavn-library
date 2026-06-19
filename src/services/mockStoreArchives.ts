import type { LibraryArchiveExportOptions, LibraryArchiveImportOptions, LibraryArchivePreview, LibraryArchiveRestoreOptions } from '@/types/archive';
import type { Game } from '@/types/game';
import type { TaskRecord } from '@/types/task';
import { ensureGameDefaults, makeGame } from './mockStoreGames';
import { syncGameCompatibilityAssets } from './mockStoreAssets';
import { addTaskLog, makeTask } from './mockStoreTasks';

type MockStoreArchiveDeps = {
  readGames: () => Game[];
  writeGames: (games: Game[]) => void;
};

export function createMockStoreArchives({ readGames, writeGames }: MockStoreArchiveDeps) {
  const addImportedGame = (input: { title: string; installPath: string; genres: string[] }) => {
    const game = makeGame(input);
    writeGames([game, ...readGames()]);
    syncGameCompatibilityAssets(game);
  };

  return {
    exportLibraryArchive(options: LibraryArchiveExportOptions): Promise<TaskRecord> {
      const targetDir = options.targetDir || 'Downloads';
      const includeImages = options.includeImages ?? true;
      const includeSaveBackups = options.includeSaveBackups ?? false;
      const task = makeTask({
        taskType: 'library.archive_export',
        status: 'completed',
        progress: 1,
        message: `浏览器预览已模拟导出库归档到 ${targetDir}`,
        error: null,
        retryPayload: JSON.stringify({ targetDir, includeImages, includeSaveBackups }),
        retryable: true,
      });
      addTaskLog(task.id, 'info', `归档导出目标：${targetDir}`);
      addTaskLog(task.id, 'info', `归档导出包含：图片 ${includeImages ? '是' : '否'}，存档备份 ${includeSaveBackups ? '是' : '否'}`);
      return Promise.resolve(task);
    },

    exportLibraryArchiveZip(options: LibraryArchiveExportOptions): Promise<TaskRecord> {
      const targetDir = options.targetDir || 'Downloads';
      const includeImages = options.includeImages ?? true;
      const includeSaveBackups = options.includeSaveBackups ?? false;
      const task = makeTask({
        taskType: 'library.archive_export_zip',
        status: 'completed',
        progress: 1,
        message: `浏览器预览已模拟导出 ZIP 库归档到 ${targetDir}`,
        error: null,
        retryPayload: JSON.stringify({ targetDir, includeImages, includeSaveBackups }),
        retryable: true,
      });
      addTaskLog(task.id, 'info', `ZIP 归档导出目标：${targetDir}`);
      addTaskLog(task.id, 'info', `ZIP 归档导出包含：图片 ${includeImages ? '是' : '否'}，存档备份 ${includeSaveBackups ? '是' : '否'}`);
      return Promise.resolve(task);
    },

    previewLibraryArchive(path: string): Promise<LibraryArchivePreview> {
      return Promise.resolve({
        archiveDir: path,
        manifest: {
          app: 'MikaVN Library',
          archiveVersion: 1,
          exportedAt: new Date().toISOString(),
          databaseFile: 'mikavn.db',
          includeImages: true,
          includeSaveBackups: false,
          imagesCount: 0,
          saveBackupsCount: 0,
          notes: ['Browser preview mock archive.'],
        },
        databasePresent: true,
        imagesCount: 0,
        saveBackupsCount: 0,
        warnings: [],
      });
    },

    importLibraryArchive(options: LibraryArchiveImportOptions): Promise<TaskRecord> {
      const games = readGames().map(ensureGameDefaults);
      const freshTitle = 'Browser Archive Fresh';
      const conflictTitle = games[0]?.title ?? '星之终途';
      const imported = games.some((game) => game.title === freshTitle) ? 0 : 1;
      if (imported > 0) {
        addImportedGame({
          title: freshTitle,
          installPath: 'D:\\MikaVN-Smoke-Archive\\Fresh',
          genres: ['Visual Novel'],
        });
      }
      const task = makeTask({
        taskType: 'library.archive_import',
        status: 'completed',
        progress: 1,
        message: `浏览器预览归档导入完成：导入 ${imported} 个，跳过 1 个。保护备份：mock://archive-import-protection/before-import.db`,
        error: null,
        retryPayload: JSON.stringify(options),
        retryable: true,
      });
      addTaskLog(task.id, 'info', '归档导入保护备份：mock://archive-import-protection/before-import.db');
      if (imported > 0) addTaskLog(task.id, 'info', `归档导入新增：${freshTitle}`);
      addTaskLog(task.id, 'warn', `归档导入跳过：${conflictTitle}（标题已存在：${conflictTitle}）`);
      return Promise.resolve(task);
    },

    restoreLibraryArchive(options: LibraryArchiveRestoreOptions): Promise<TaskRecord> {
      const restoreImages = options.restoreImages ?? true;
      const restoreSaveBackups = options.restoreSaveBackups ?? false;
      const task = makeTask({
        taskType: 'library.archive_restore',
        status: 'completed',
        progress: 1,
        message: `浏览器预览已模拟安排库归档完整恢复：图片 ${restoreImages ? '镜像恢复' : '跳过'}，存档备份 ${restoreSaveBackups ? '镜像恢复' : '跳过'}。`,
        error: null,
        retryPayload: JSON.stringify({ ...options, restoreImages, restoreSaveBackups }),
        retryable: true,
      });
      addTaskLog(task.id, 'warn', '完整恢复已安排：数据库将在下次启动前替换，当前数据库会先创建保护备份。');
      addTaskLog(task.id, 'info', '归档恢复保护目录：mock://archive-restore-protection/before-archive-restore');
      return Promise.resolve(task);
    },
  };
}
