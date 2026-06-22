import type { DashboardData, Game } from '@/types/game';
import type { ReportCountItem, ReportGapExample, ReportSummary } from '@/types/reports';
import type { TaskRecord } from '@/types/task';
import { readSettings } from './mockStoreStorage';
import { addTaskLog, makeTask, reportGapExamplesLog, reportGapSummaryLog } from './mockStoreTasks';

export function createMockStoreReports(readGames: () => Game[]) {
  const backupSize = formatMockBytes(131072);
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

    getReportSummary(): Promise<ReportSummary> {
      return Promise.resolve(buildReportSummary(readGames()));
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
      addTaskLog(task.id, 'info', `数据库备份报告：目标 ${target}，大小 ${backupSize}，quick_check ok。`);
      return Promise.resolve(task);
    },

    restoreDatabaseBackup(path: string): Promise<TaskRecord> {
      const source = path || 'D:\\MikaVN-Backups\\mikavn.db';
      const pending = 'mock://pending-restore/mikavn.db';
      const task = makeTask({
        taskType: 'database.restore',
        status: 'completed',
        progress: 1,
        message: `浏览器预览已模拟安排下次启动恢复 ${pending}（${backupSize}）`,
        error: null,
        retryPayload: JSON.stringify({ path }),
        retryable: false,
      });
      addTaskLog(task.id, 'info', `数据库恢复来源：${source}（${backupSize}）`);
      addTaskLog(task.id, 'info', `数据库恢复待应用：${pending}（${backupSize}）`);
      return Promise.resolve(task);
    },
  };
}

function buildReportSummary(games: Game[]): ReportSummary {
  const settings = readSettings();
  const visibleGames = settings.privacy_filter_reports === 'false' ? games : games.filter((game) => !game.hidden && game.ageRating !== 'R18');
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
  const playedSince = (since: number) => visibleGames
    .filter((game) => game.lastPlayedAt && Date.parse(game.lastPlayedAt) >= since)
    .reduce((sum, game) => sum + game.totalPlaySeconds, 0);
  const missingCover = visibleGames.filter((game) => !game.coverImage?.trim());
  const missingDescriptionImage = visibleGames.filter((game) => Boolean((game.dlsiteId?.trim() || game.fanzaId?.trim()) && !hasDescriptionImage(game.description)));
  const missingExternalIds = visibleGames.filter((game) => !(game.vndbId?.trim() || game.dlsiteId?.trim() || game.fanzaId?.trim() || game.bangumiId?.trim() || game.ymgalId?.trim()));
  const brokenPath = visibleGames.filter((game) => game.pathStatus === 'broken');

  return {
    totalGames: visibleGames.length,
    totalPlaySeconds: visibleGames.reduce((sum, game) => sum + game.totalPlaySeconds, 0),
    weekPlaySeconds: playedSince(weekAgo),
    monthPlaySeconds: playedSince(monthAgo),
    status: countValues(visibleGames.map((game) => playStatusLabel(game.playStatus))),
    tags: countValues(visibleGames.flatMap((game) => game.tags)).slice(0, 8),
    developers: countValues(visibleGames.map((game) => game.developer || game.brand || '未填写')).slice(0, 8),
    playtime: [...visibleGames].sort((a, b) => b.totalPlaySeconds - a.totalPlaySeconds || a.title.localeCompare(b.title, 'zh-CN')).slice(0, 8).map((game) => ({ label: game.title, seconds: game.totalPlaySeconds })),
    completeness: {
      cover: visibleGames.filter((game) => game.coverImage?.trim()).length,
      description: visibleGames.filter((game) => game.description?.trim()).length,
      releaseDate: visibleGames.filter((game) => game.releaseDate?.trim()).length,
      externalIds: visibleGames.filter((game) => game.vndbId?.trim() || game.dlsiteId?.trim() || game.fanzaId?.trim() || game.bangumiId?.trim() || game.ymgalId?.trim()).length,
    },
    gaps: {
      missingCover: missingCover.length,
      missingDescriptionImage: missingDescriptionImage.length,
      missingExternalIds: missingExternalIds.length,
      brokenPath: brokenPath.length,
      examples: {
        missingCover: gapExamples(missingCover),
        missingDescriptionImage: gapExamples(missingDescriptionImage),
        missingExternalIds: gapExamples(missingExternalIds),
        brokenPath: gapExamples(brokenPath),
      },
    },
  };
}

function gapExamples(games: Game[]): ReportGapExample[] {
  return games.slice(0, 3).map((game) => ({ id: game.id, title: game.title }));
}

function hasDescriptionImage(description?: string | null) {
  return Boolean(description && /!\[[^\]]*\]\([^\)]+\)|<img\b/i.test(description));
}

function countValues(values: string[]): ReportCountItem[] {
  const map = new Map<string, number>();
  for (const value of values.filter(Boolean)) map.set(value, (map.get(value) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN')).map(([label, value]) => ({ label, value }));
}

function playStatusLabel(value: string) {
  if (value === 'planned') return '想玩';
  if (value === 'playing') return '游玩中';
  if (value === 'completed') return '已通关';
  if (value === 'paused') return '已搁置';
  if (value === 'archived') return '封存';
  return value;
}

function formatMockBytes(value: number) {
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${Math.max(0, Math.round(value))} B`;
}
