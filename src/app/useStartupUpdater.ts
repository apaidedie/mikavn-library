import { useEffect, useState } from 'react';
import { checkForAppUpdate, installAppUpdate, restartAfterUpdate, type AppUpdateHandle } from '@/services/updater';
import { formatUpdaterError, formatUpdaterInstallProgress, type UpdateProtectionBackupInfo, type UpdaterCheckResult } from '@/services/updaterModel';

export function useStartupUpdater() {
  const [notice, setNotice] = useState<UpdaterCheckResult | null>(null);
  const [update, setUpdate] = useState<AppUpdateHandle | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [installProgress, setInstallProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backupInfo, setBackupInfo] = useState<UpdateProtectionBackupInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void checkForAppUpdate()
        .then(({ result, update }) => {
          if (!cancelled && result.kind === 'available') {
            setNotice(result);
            setUpdate(update);
          }
        })
        .catch(() => {
          if (!cancelled) setNotice(null);
        });
    }, 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  const dismissStartupUpdate = () => {
    setNotice(null);
    setError(null);
    setInstallProgress(null);
    setBackupInfo(null);
  };

  const installStartupUpdate = async () => {
    setInstalling(true);
    setError(null);
    setInstallProgress(null);
    setBackupInfo(null);
    const result = await installAppUpdate(update, (progress) => setInstallProgress(formatUpdaterInstallProgress(progress)));
    setInstalling(false);
    if (result.kind === 'installed') {
      setInstalled(true);
      setInstallProgress(null);
      setBackupInfo(result.backup ?? null);
    } else {
      setInstallProgress(null);
      setBackupInfo(result.backup ?? null);
      setError(result.message);
    }
  };

  const restartStartupUpdate = async () => {
    setError(null);
    try {
      await restartAfterUpdate();
    } catch (error) {
      setError(`重启应用失败：${formatUpdaterError(error).replace(/^更新失败：/, '')}`);
    }
  };

  return { notice, installing, installed, installProgress, error, backupInfo, dismissStartupUpdate, installStartupUpdate, restartStartupUpdate };
}
