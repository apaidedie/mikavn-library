import { redactDiagnosticText } from '@/utils/diagnosticRedaction';

export type UpdaterCheckResult =
  | { kind: 'unavailable'; message: string }
  | { kind: 'up_to_date'; message: string }
  | { kind: 'available'; version: string; currentVersion?: string; notes: string; message: string };

export const updaterFallbackDownloadUrl = 'https://github.com/apaidedie/mikavn-library/releases/latest';

export type UpdateProtectionBackupInfo = {
  fileName: string;
  path: string;
  sizeBytes: number;
};

export type UpdaterInstallProgress =
  | { phase: 'backing_up' }
  | { phase: 'downloading'; downloadedBytes: number; totalBytes?: number; percent?: number }
  | { phase: 'installing' };

export type UpdaterInstallResult =
  | { kind: 'installed'; message: string; backup?: UpdateProtectionBackupInfo }
  | { kind: 'failed'; message: string; backup?: UpdateProtectionBackupInfo };

export type UpdaterRecoveryHint = {
  kind: 'backup_failed' | 'signature_failed' | 'download_or_install_failed' | 'restart_failed';
  title: string;
  guidance: string;
  showFallbackDownload: boolean;
};

type RawTauriUpdate = {
  version?: string;
  currentVersion?: string;
  body?: string | null;
};

export function isDesktopUpdaterRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function createBrowserUpdaterUnavailableResult(): UpdaterCheckResult {
  return {
    kind: 'unavailable',
    message: '桌面更新仅在 Windows 应用内可用，浏览器预览不会下载或安装更新。',
  };
}

export function summarizeReleaseNotes(notes: string | null | undefined): string {
  const lines = String(notes ?? '')
    .split(/\r?\n/)
    .filter((line) => !/^#+\s*/.test(line.trim()))
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 2);

  return lines.length > 0 ? lines.join(' / ') : '没有发布说明摘要。';
}

export function mapTauriUpdateResult(update: RawTauriUpdate | null): UpdaterCheckResult {
  if (!update) {
    return { kind: 'up_to_date', message: '当前已是最新版本。' };
  }

  const version = update.version ?? '未知版本';
  return {
    kind: 'available',
    version,
    currentVersion: update.currentVersion,
    notes: summarizeReleaseNotes(update.body),
    message: `发现新版本 ${version}。`,
  };
}

export function formatUpdaterError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return `更新失败：${error.message}`;
  }
  if (typeof error === 'string' && error.trim()) {
    return `更新失败：${error}`;
  }
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.trim()) {
    return `更新失败：${error.message}`;
  }
  return '更新失败：未知错误';
}

export function createUpdaterRecoveryHint(errorText: string | null | undefined): UpdaterRecoveryHint | null {
  const text = String(errorText ?? '').trim();
  if (!text) return null;

  if (/更新前数据库备份失败|备份失败|backup/i.test(text)) {
    return {
      kind: 'backup_failed',
      title: '更新已取消，数据库没有被替换。',
      guidance: '先到本地数据页确认数据库备份目录可写，再重新检查并安装更新。',
      showFallbackDownload: false,
    };
  }

  if (/signature|签名|verification|verify/i.test(text)) {
    return {
      kind: 'signature_failed',
      title: '签名验证失败，已阻止安装。',
      guidance: '不要继续安装这个更新包；只从官方 GitHub Release 页面重新下载。',
      showFallbackDownload: true,
    };
  }

  if (/重启应用失败|restart|relaunch/i.test(text)) {
    return {
      kind: 'restart_failed',
      title: '更新已安装，但自动重启失败。',
      guidance: '请手动关闭 MikaVN Library 后重新打开，更新会在下次启动后生效。',
      showFallbackDownload: false,
    };
  }

  return {
    kind: 'download_or_install_failed',
    title: '下载或安装没有完成。',
    guidance: '已创建的更新前备份会保留；可以重试，或打开备用下载页面手动安装。',
    showFallbackDownload: true,
  };
}

export function formatUpdaterRecoveryText({
  errorText,
  backup,
  fallbackDownloadUrl = updaterFallbackDownloadUrl,
}: {
  errorText: string | null | undefined;
  backup?: Partial<UpdateProtectionBackupInfo> | null;
  fallbackDownloadUrl?: string;
}) {
  const normalizedError = String(errorText ?? '').trim() || '未知更新错误';
  const recoveryHint = createUpdaterRecoveryHint(normalizedError);
  const lines = [
    '# MikaVN 更新故障摘要',
    '',
    `错误：${normalizedError}`,
  ];

  if (recoveryHint) {
    lines.push(
      `故障类型：${recoveryHint.title}`,
      `处理建议：${recoveryHint.guidance}`,
    );
    if (recoveryHint.showFallbackDownload) lines.push(`备用下载：${fallbackDownloadUrl}`);
  }

  if (backup?.fileName || backup?.path) {
    lines.push('', '## 更新前数据库备份');
    if (backup.fileName) lines.push(`更新前数据库备份：${backup.fileName}`);
    if (backup.path) lines.push(`备份路径：${backup.path}`);
  }

  return redactDiagnosticText(lines.join('\n'));
}

export function formatUpdaterInstallProgress(progress: UpdaterInstallProgress | null): string | null {
  if (!progress) return null;
  if (progress.phase === 'backing_up') return '正在创建更新前数据库备份...';
  if (progress.phase === 'installing') return '正在安装更新...';
  const downloaded = formatDownloadBytes(progress.downloadedBytes);
  const total = typeof progress.totalBytes === 'number' && progress.totalBytes > 0 ? formatDownloadBytes(progress.totalBytes) : null;
  if (typeof progress.percent === 'number') {
    const percentText = `${Math.max(0, Math.min(100, Math.round(progress.percent)))}%`;
    return total ? `正在下载更新：${percentText}（${downloaded} / ${total}）` : `正在下载更新：${percentText}`;
  }
  return total ? `正在下载更新：已下载 ${downloaded} / ${total}` : `正在下载更新：已下载 ${downloaded}`;
}

function formatDownloadBytes(value: number) {
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${Math.max(0, Math.round(value))} B`;
}
