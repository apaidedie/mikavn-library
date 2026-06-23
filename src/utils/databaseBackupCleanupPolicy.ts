import type { DatabaseBackupCleanupPolicy } from '@/types/archive';

export const databaseBackupMaintenanceThresholds = {
  warnFileCount: 20,
  warnTotalBytes: 1024 * 1024 * 1024,
};

export const databaseBackupCleanupPolicy = {
  retainCount: 10,
  retainDays: 30,
} satisfies DatabaseBackupCleanupPolicy;

type DatabaseBackupCleanupInput = { fileCount?: number | null; totalBytes?: number | null } | null | undefined;

export function formatDatabaseBackupCleanupPolicy(policy: DatabaseBackupCleanupPolicy): string {
  const retainCount = Math.max(0, Math.round(policy.retainCount ?? 10));
  const retainDays = Math.max(0, Math.round(policy.retainDays ?? 30));
  return `保留最新 ${retainCount} 个，并保留 ${retainDays} 天内的备份`;
}

export function formatDatabaseBackupCleanupConfirmation(policy: DatabaseBackupCleanupPolicy, backups: DatabaseBackupCleanupInput): string {
  const currentState = backups ? `当前 ${formatCount(backups.fileCount ?? 0)} 个，占用 ${formatBytes(backups.totalBytes ?? 0)}。` : '';
  return `按安全规则清理旧数据库备份？${currentState}${formatDatabaseBackupCleanupPolicy(policy)}；只清理应用管理的旧数据库备份，不会删除当前 mikavn.db。`;
}

export function getDatabaseBackupCleanupSuggestion(backups: DatabaseBackupCleanupInput) {
  const fileCount = backups?.fileCount ?? 0;
  const totalBytes = backups?.totalBytes ?? 0;
  const overFileCount = fileCount > databaseBackupMaintenanceThresholds.warnFileCount;
  const overTotalBytes = totalBytes > databaseBackupMaintenanceThresholds.warnTotalBytes;
  if (!overFileCount && !overTotalBytes) return null;
  return { fileCount, totalBytes, overFileCount, overTotalBytes };
}

export function shouldSuggestDatabaseBackupCleanup(backups: DatabaseBackupCleanupInput) {
  return getDatabaseBackupCleanupSuggestion(backups) !== null;
}

function formatCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? Math.round(size) : size.toFixed(size >= 10 ? 1 : 2)} ${units[unit]}`;
}
