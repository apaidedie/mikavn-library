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
