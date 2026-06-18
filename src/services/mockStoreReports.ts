import type { DashboardData, Game } from '@/types/game';
import type { TaskRecord } from '@/types/task';
import { addTaskLog, makeTask, reportGapExamplesLog, reportGapSummaryLog } from './mockStoreTasks';

export function createMockStoreReports(readGames: () => Game[]) {
  const exportReportMarkdown = (path: string, content: string) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = path || 'mikavn-report.md';
    link.click();
    URL.revokeObjectURL(url);
    return Promise.resolve();
  };

  return {
    getDashboard(): Promise<DashboardData> {
      const games = readGames();
      const totalPlaySeconds = games.reduce((sum, game) => sum + game.totalPlaySeconds, 0);
      return Promise.resolve({
        totalGames: games.length,
        plannedGames: games.filter((game) => game.playStatus === 'planned').length,
        playingGames: games.filter((game) => game.playStatus === 'playing').length,
        completedGames: games.filter((game) => game.playStatus === 'completed').length,
        totalPlaySeconds,
        weekPlaySeconds: totalPlaySeconds,
        monthPlaySeconds: totalPlaySeconds,
        recentGames: games.filter((game) => game.lastPlayedAt).slice(0, 5),
        recentlyAdded: [...games].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
      });
    },

    exportReportMarkdown,

    async exportReportMarkdownTask(path: string, content: string): Promise<TaskRecord> {
      await exportReportMarkdown(path, content);
      const task = makeTask({
        taskType: 'report.export_markdown',
        status: 'completed',
        progress: 1,
        message: `浏览器预览已导出 ${path || 'mikavn-report.md'}`,
        error: null,
        retryable: false,
      });
      addTaskLog(task.id, 'info', reportGapSummaryLog(content));
      addTaskLog(task.id, 'info', reportGapExamplesLog(content));
      return task;
    },

    backupDatabase(path: string): Promise<TaskRecord> {
      const target = path || 'mikavn-backup.db';
      const task = makeTask({
        taskType: 'database.backup',
        status: 'completed',
        progress: 1,
        message: `浏览器预览已模拟备份到 ${target}`,
        error: null,
        retryPayload: JSON.stringify({ path }),
        retryable: true,
      });
      addTaskLog(task.id, 'info', `数据库备份报告：目标 ${target}，大小 131072 bytes。`);
      return Promise.resolve(task);
    },

    restoreDatabaseBackup(path: string): Promise<TaskRecord> {
      const source = path || 'D:\\MikaVN-Backups\\mikavn.db';
      const pending = 'mock://pending-restore/mikavn.db';
      const task = makeTask({
        taskType: 'database.restore',
        status: 'completed',
        progress: 1,
        message: `浏览器预览已模拟安排下次启动恢复 ${pending}（131072 bytes）`,
        error: null,
        retryPayload: JSON.stringify({ path }),
        retryable: false,
      });
      addTaskLog(task.id, 'info', `数据库恢复来源：${source}（131072 bytes）`);
      addTaskLog(task.id, 'info', `数据库恢复待应用：${pending}（131072 bytes）`);
      return Promise.resolve(task);
    },
  };
}
