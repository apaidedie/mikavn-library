import { useCallback, useEffect, useState } from 'react';
import { api } from '@/services/api';
import { errorMessage } from '@/utils/errorMessage';
import { deriveStartupDatabaseBackupPlan, startupDatabaseBackupCleanupPolicy } from './startupDatabaseBackup';

export function useStartupDatabaseBackup() {
  const [startupDatabaseBackupError, setStartupDatabaseBackupError] = useState<string | null>(null);
  const dismissStartupDatabaseBackupError = useCallback(() => setStartupDatabaseBackupError(null), []);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void Promise.all([api.getAppSettings(), api.getAppDataDiagnostics()])
        .then(([settings, diagnostics]) => {
          if (cancelled) return;
          const plan = deriveStartupDatabaseBackupPlan({ settings, diagnostics });
          if (plan.kind !== 'backup') return;
          void api.backupDatabase(plan.path)
            .then(() => api.cleanupOldDatabaseBackups(startupDatabaseBackupCleanupPolicy()))
            .catch((reason) => {
              if (!cancelled) setStartupDatabaseBackupError(`启动自动数据库备份失败：${errorMessage(reason)}`);
            });
        })
        .catch((reason) => {
          if (!cancelled) setStartupDatabaseBackupError(`启动自动数据库备份失败：${errorMessage(reason)}`);
        });
    }, 1800);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  return {
    dismissStartupDatabaseBackupError,
    startupDatabaseBackupError,
  };
}
