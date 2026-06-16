import type { AppDataDiagnostics } from '@/types/archive';
import type { Game } from '@/types/game';
import type { TaskRecord } from '@/types/task';

export type DashboardAttentionKind =
  | 'failed_tasks'
  | 'running_tasks'
  | 'path_health'
  | 'missing_artwork'
  | 'missing_external_ids'
  | 'database_backup';

export type DashboardAttentionItem = {
  kind: DashboardAttentionKind;
  title: string;
  detail: string;
  count: number;
  tone: 'danger' | 'warning' | 'info';
  action: 'tasks_attention' | 'tasks_active' | 'library_paths' | 'maintenance_artwork' | 'metadata_missing_ids' | 'settings_local';
};

type RankOptions = {
  hideHidden?: boolean;
  limit?: number;
};

type AttentionInput = {
  diagnostics?: Pick<AppDataDiagnostics, 'database' | 'databaseBackups'> | null;
  tasks: TaskRecord[];
};

export function rankContinueGames(games: Game[], options: RankOptions = {}) {
  const limit = options.limit ?? 6;
  return [...games]
    .filter((game) => !options.hideHidden || !game.hidden)
    .filter((game) => game.playStatus === 'playing' || game.lastPlayedAt || game.totalPlaySeconds > 0)
    .sort((a, b) => continueScore(b) - continueScore(a))
    .slice(0, limit);
}

export function deriveDashboardAttentionItems(input: AttentionInput): DashboardAttentionItem[] {
  const failedTasks = input.tasks.filter((task) => task.status === 'failed' || task.status === 'cancelled').length;
  const runningTasks = input.tasks.filter((task) => task.status === 'pending' || task.status === 'running').length;
  const pathStatus = input.diagnostics?.database.pathStatus;
  const metadata = input.diagnostics?.database.metadataCoverage;
  const backupCount = input.diagnostics?.databaseBackups.fileCount ?? 0;
  const pathIssueCount = (pathStatus?.brokenCount ?? 0) + (pathStatus?.incompleteCount ?? 0) + (pathStatus?.uncheckedCount ?? 0);
  const missingArtworkCount = (metadata?.missingCoverCount ?? 0) + (metadata?.missingBannerCount ?? 0) + (metadata?.missingBackgroundCount ?? 0);
  const missingExternalIdCount = metadata?.missingExternalIdCount ?? 0;
  const items: DashboardAttentionItem[] = [];

  if (failedTasks > 0) {
    items.push({
      kind: 'failed_tasks',
      title: '任务需要处理',
      detail: `${failedTasks} 个任务失败或已取消，建议先查看日志。`,
      count: failedTasks,
      tone: 'danger',
      action: 'tasks_attention',
    });
  }

  if (runningTasks > 0) {
    items.push({
      kind: 'running_tasks',
      title: '任务正在进行',
      detail: `${runningTasks} 个任务仍在运行或等待。`,
      count: runningTasks,
      tone: 'info',
      action: 'tasks_active',
    });
  }

  if (pathIssueCount > 0) {
    items.push({
      kind: 'path_health',
      title: '路径需要复核',
      detail: `${pathIssueCount} 个路径未检查、不完整或异常。`,
      count: pathIssueCount,
      tone: pathStatus?.brokenCount ? 'danger' : 'warning',
      action: 'library_paths',
    });
  }

  if (missingArtworkCount > 0) {
    items.push({
      kind: 'missing_artwork',
      title: '媒体素材不完整',
      detail: `${missingArtworkCount} 个封面、横幅或背景缺口。`,
      count: missingArtworkCount,
      tone: 'warning',
      action: 'maintenance_artwork',
    });
  }

  if (missingExternalIdCount > 0) {
    items.push({
      kind: 'missing_external_ids',
      title: '外部 ID 缺失',
      detail: `${missingExternalIdCount} 个条目缺少 VNDB / DLsite / FANZA 等外部 ID。`,
      count: missingExternalIdCount,
      tone: 'warning',
      action: 'metadata_missing_ids',
    });
  }

  if (backupCount === 0) {
    items.push({
      kind: 'database_backup',
      title: '还没有数据库备份',
      detail: '建议先做一次本地数据库备份，之后再批量整理。',
      count: 0,
      tone: 'info',
      action: 'settings_local',
    });
  }

  return items;
}

function continueScore(game: Game) {
  const statusScore = game.playStatus === 'playing' ? 1_000_000_000_000_000 : game.playStatus === 'paused' ? 700_000_000_000_000 : 0;
  const playedScore = Math.min(game.totalPlaySeconds, 500 * 60 * 60) * 1000;
  return statusScore + dateMillis(game.lastPlayedAt ?? game.updatedAt ?? game.createdAt) + playedScore;
}

function dateMillis(value?: string | null) {
  if (!value) return 0;
  const millis = new Date(value).getTime();
  return Number.isFinite(millis) ? millis : 0;
}
