import { useEffect, useState } from 'react';
import { checkForAppUpdate, installAppUpdate, restartAfterUpdate, type AppUpdateHandle } from '@/services/updater';
import type { UpdaterCheckResult } from '@/services/updaterModel';

export function useStartupUpdater() {
  const [notice, setNotice] = useState<UpdaterCheckResult | null>(null);
  const [update, setUpdate] = useState<AppUpdateHandle | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  };

  const installStartupUpdate = async () => {
    setInstalling(true);
    setError(null);
    const result = await installAppUpdate(update);
    setInstalling(false);
    if (result.kind === 'installed') {
      setInstalled(true);
    } else {
      setError(result.message);
    }
  };

  const restartStartupUpdate = async () => {
    await restartAfterUpdate();
  };

  return { notice, installing, installed, error, dismissStartupUpdate, installStartupUpdate, restartStartupUpdate };
}
