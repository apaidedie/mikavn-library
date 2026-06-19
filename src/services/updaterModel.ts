export type UpdaterCheckResult =
  | { kind: 'unavailable'; message: string }
  | { kind: 'up_to_date'; message: string }
  | { kind: 'available'; version: string; currentVersion?: string; notes: string; message: string };

export type UpdaterInstallResult =
  | { kind: 'installed'; message: string }
  | { kind: 'failed'; message: string };

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
