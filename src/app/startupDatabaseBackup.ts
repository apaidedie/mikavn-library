import type { AppDataDiagnostics } from '@/types/archive';

export type StartupDatabaseBackupPlan =
  | { kind: 'backup'; path: string; reason: 'missing' | 'stale' | 'unknown-age' }
  | { kind: 'skip'; reason: 'disabled' | 'fresh' | 'missing-root' };

type StartupDatabaseBackupInput = {
  settings: Record<string, string>;
  diagnostics: Pick<AppDataDiagnostics, 'databaseBackups'>;
  now?: string | Date;
  intervalHours?: number;
};

const DEFAULT_INTERVAL_HOURS = 24;

export function startupDatabaseBackupCleanupPolicy() {
  return {
    retainCount: 30,
    retainDays: 90,
  };
}

export function deriveStartupDatabaseBackupPlan({
  settings,
  diagnostics,
  now = new Date(),
  intervalHours = DEFAULT_INTERVAL_HOURS,
}: StartupDatabaseBackupInput): StartupDatabaseBackupPlan {
  if (settings.database_auto_backup_on_startup === 'false') {
    return { kind: 'skip', reason: 'disabled' };
  }

  const rootPath = diagnostics.databaseBackups.rootPath?.trim();
  if (!rootPath) {
    return { kind: 'skip', reason: 'missing-root' };
  }

  const referenceDate = typeof now === 'string' ? new Date(now) : now;
  const latestBackupAt = latestModifiedAt(diagnostics.databaseBackups.files ?? []);
  if (!latestBackupAt) {
    return {
      kind: 'backup',
      path: buildStartupDatabaseBackupPath(rootPath, referenceDate),
      reason: diagnostics.databaseBackups.fileCount > 0 ? 'unknown-age' : 'missing',
    };
  }

  const ageMs = referenceDate.getTime() - latestBackupAt.getTime();
  if (ageMs >= intervalHours * 60 * 60 * 1000) {
    return { kind: 'backup', path: buildStartupDatabaseBackupPath(rootPath, referenceDate), reason: 'stale' };
  }

  return { kind: 'skip', reason: 'fresh' };
}

export function buildStartupDatabaseBackupPath(rootPath: string, now: Date): string {
  const separator = rootPath.includes('\\') ? '\\' : '/';
  const trimmedRoot = rootPath.replace(/[\\/]+$/, '');
  return `${trimmedRoot}${separator}auto${separator}mikavn.before-auto-${formatUtcStamp(now)}.db`;
}

function latestModifiedAt(files: Array<{ modifiedAt?: string | null }>): Date | null {
  let latest: Date | null = null;
  for (const file of files) {
    if (!file.modifiedAt) continue;
    const value = new Date(file.modifiedAt);
    if (Number.isNaN(value.getTime())) continue;
    if (!latest || value.getTime() > latest.getTime()) {
      latest = value;
    }
  }
  return latest;
}

function formatUtcStamp(value: Date): string {
  const pad = (input: number) => String(input).padStart(2, '0');
  return [
    value.getUTCFullYear(),
    pad(value.getUTCMonth() + 1),
    pad(value.getUTCDate()),
    '-',
    pad(value.getUTCHours()),
    pad(value.getUTCMinutes()),
    pad(value.getUTCSeconds()),
  ].join('');
}
