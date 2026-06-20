import { useEffect } from 'react';
import { api } from '@/services/api';
import { deriveStartupDatabaseBackupPlan, startupDatabaseBackupCleanupPolicy } from './startupDatabaseBackup';

export function useStartupDatabaseBackup() {
  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void Promise.all([api.getAppSettings(), api.getAppDataDiagnostics()])
        .then(([settings, diagnostics]) => {
          if (cancelled) return;
          const plan = deriveStartupDatabaseBackupPlan({ settings, diagnostics });
          if (plan.kind !== 'backup') return;
          void api.backupDatabase(plan.path).then(() => api.cleanupOldDatabaseBackups(startupDatabaseBackupCleanupPolicy())).catch(() => undefined);
        })
        .catch(() => undefined);
    }, 1800);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);
}
