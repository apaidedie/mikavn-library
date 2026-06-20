import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { api } from './api';
import {
  createBrowserUpdaterUnavailableResult,
  formatUpdaterError,
  isDesktopUpdaterRuntime,
  mapTauriUpdateResult,
  type UpdaterCheckResult,
  type UpdaterInstallResult,
} from './updaterModel';

export type AppUpdateHandle = Update;

export async function checkForAppUpdate(): Promise<{ result: UpdaterCheckResult; update: AppUpdateHandle | null }> {
  if (!isDesktopUpdaterRuntime()) {
    return { result: createBrowserUpdaterUnavailableResult(), update: null };
  }

  const update = await check();
  return { result: mapTauriUpdateResult(update), update };
}

export async function installAppUpdate(update: AppUpdateHandle | null): Promise<UpdaterInstallResult> {
  if (!update) {
    return { kind: 'failed', message: '更新失败：没有可安装的更新。' };
  }

  let backupReport;
  try {
    backupReport = await api.backupDatabaseBeforeUpdate();
  } catch (error) {
    return { kind: 'failed', message: `更新前数据库备份失败，已取消安装。${formatUpdaterError(error)}` };
  }

  try {
    await update.downloadAndInstall();
    return {
      kind: 'installed',
      message: `更新已安装，重启后生效。更新前数据库备份：${backupReport.fileName}`,
      backup: {
        fileName: backupReport.fileName,
        path: backupReport.path,
        sizeBytes: backupReport.sizeBytes,
      },
    };
  } catch (error) {
    return { kind: 'failed', message: formatUpdaterError(error) };
  }
}

export async function restartAfterUpdate(): Promise<void> {
  await relaunch();
}
