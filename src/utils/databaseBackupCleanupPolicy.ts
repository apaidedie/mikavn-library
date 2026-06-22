import type { DatabaseBackupCleanupPolicy } from '@/types/archive';

export const databaseBackupCleanupPolicy = {
  retainCount: 10,
  retainDays: 30,
} satisfies DatabaseBackupCleanupPolicy;

export function formatDatabaseBackupCleanupPolicy(policy: DatabaseBackupCleanupPolicy): string {
  const retainCount = Math.max(0, Math.round(policy.retainCount ?? 10));
  const retainDays = Math.max(0, Math.round(policy.retainDays ?? 30));
  return `保留最新 ${retainCount} 个，并保留 ${retainDays} 天内的备份`;
}
