import { relaunch } from '@tauri-apps/plugin-process';
import { check, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater';
import { api } from './api';
import {
  createBrowserUpdaterUnavailableResult,
  formatUpdaterError,
  isDesktopUpdaterRuntime,
  mapTauriUpdateResult,
  type UpdaterCheckResult,
  type UpdaterInstallProgress,
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

export async function installAppUpdate(update: AppUpdateHandle | null, onProgress?: (progress: UpdaterInstallProgress) => void): Promise<UpdaterInstallResult> {
  if (!update) {
    return { kind: 'failed', message: '更新失败：没有可安装的更新。' };
  }

  let backupReport;
  try {
    onProgress?.({ phase: 'backing_up' });
    backupReport = await api.backupDatabaseBeforeUpdate();
  } catch (error) {
    return { kind: 'failed', message: `更新前数据库备份失败，已取消安装。${formatUpdaterError(error)}` };
  }

  try {
    let downloadedBytes = 0;
    let totalBytes: number | undefined;
    await update.downloadAndInstall((event) => {
      const progress = progressFromDownloadEvent(event, downloadedBytes, totalBytes);
      downloadedBytes = progress.downloadedBytes;
      totalBytes = progress.totalBytes;
      onProgress?.(progress.update);
    });
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

function progressFromDownloadEvent(event: DownloadEvent, downloadedBytes: number, totalBytes: number | undefined): { downloadedBytes: number; totalBytes?: number; update: UpdaterInstallProgress } {
  if (event.event === 'Started') {
    const nextTotalBytes = event.data.contentLength;
    return {
      downloadedBytes: 0,
      totalBytes: nextTotalBytes,
      update: { phase: 'downloading', downloadedBytes: 0, totalBytes: nextTotalBytes, percent: nextTotalBytes ? 0 : undefined },
    };
  }
  if (event.event === 'Progress') {
    const nextDownloadedBytes = downloadedBytes + event.data.chunkLength;
    return {
      downloadedBytes: nextDownloadedBytes,
      totalBytes,
      update: {
        phase: 'downloading',
        downloadedBytes: nextDownloadedBytes,
        totalBytes,
        percent: totalBytes ? (nextDownloadedBytes / totalBytes) * 100 : undefined,
      },
    };
  }
  if (event.event === 'Finished') {
    return {
      downloadedBytes,
      totalBytes,
      update: { phase: 'installing' },
    };
  }
  return {
    downloadedBytes,
    totalBytes,
    update: { phase: 'installing' },
  };
}
