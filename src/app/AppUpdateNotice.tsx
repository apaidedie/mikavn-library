import { ClipboardCopy, Download, ExternalLink, FolderOpen, RotateCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createUpdaterRecoveryHint, updaterFallbackDownloadUrl, type UpdateProtectionBackupInfo, type UpdaterCheckResult } from '@/services/updaterModel';

type AppUpdateNoticeProps = {
  notice: Extract<UpdaterCheckResult, { kind: 'available' }>;
  installing: boolean;
  installed: boolean;
  progressText: string | null;
  error: string | null;
  backupInfo: UpdateProtectionBackupInfo | null;
  backupActionMessage: string | null;
  onDismiss: () => void;
  onInstall: () => void;
  onCopyBackupPath: () => void;
  onRevealBackup: () => void;
  onRestart: () => void;
};

export function AppUpdateNotice({
  notice,
  installing,
  installed,
  progressText,
  error,
  backupInfo,
  backupActionMessage,
  onCopyBackupPath,
  onDismiss,
  onInstall,
  onRevealBackup,
  onRestart,
}: AppUpdateNoticeProps) {
  const recoveryHint = createUpdaterRecoveryHint(error);

  return (
    <div className="border-b border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-50">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">发现新版本 {notice.version}</p>
          <p className="truncate text-xs text-emerald-100/80">{installed ? '更新已安装，请重启应用。' : notice.notes}</p>
          {progressText && <p className="mt-1 text-xs text-amber-100">{progressText}</p>}
          {installed && backupInfo && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="truncate text-xs text-emerald-100/80">更新前数据库备份：{backupInfo.fileName}</p>
              <button className="inline-flex items-center gap-1 text-xs text-emerald-50 underline underline-offset-2" type="button" onClick={onRevealBackup}>
                <FolderOpen className="h-3.5 w-3.5" />
                打开备份位置
              </button>
              <button className="inline-flex items-center gap-1 text-xs text-emerald-50 underline underline-offset-2" type="button" onClick={onCopyBackupPath}>
                <ClipboardCopy className="h-3.5 w-3.5" />
                复制备份路径
              </button>
            </div>
          )}
          {backupActionMessage && <p className="mt-1 text-xs text-emerald-100">{backupActionMessage}</p>}
          {recoveryHint && (
            <div className="mt-1 max-w-[42rem] rounded-md border border-amber-200/20 bg-black/15 px-2 py-1">
              <p className="text-xs font-medium text-amber-50">{recoveryHint?.title}</p>
              <p className="text-xs text-emerald-100/80">{recoveryHint?.guidance}</p>
            </div>
          )}
          {error && <p className="mt-1 select-text text-xs text-rose-100">{error}</p>}
          {error && (
            <div className="mt-1 flex flex-wrap gap-2">
              <button className="inline-flex items-center gap-1 text-xs text-emerald-50 underline underline-offset-2" type="button" onClick={() => void navigator.clipboard.writeText(error)}>
                <ClipboardCopy className="h-3.5 w-3.5" />
                复制错误
              </button>
              {recoveryHint?.showFallbackDownload && (
                <>
                  <button className="inline-flex items-center gap-1 text-xs text-emerald-50 underline underline-offset-2" type="button" onClick={() => void navigator.clipboard.writeText(updaterFallbackDownloadUrl)}>
                    <ClipboardCopy className="h-3.5 w-3.5" />
                    复制备用链接
                  </button>
                  <a className="inline-flex items-center gap-1 text-xs text-emerald-50 underline underline-offset-2" href={updaterFallbackDownloadUrl} rel="noreferrer" target="_blank">
                    <ExternalLink className="h-3.5 w-3.5" />
                    备用下载页面
                  </a>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {installed ? (
            <Button onClick={onRestart} size="sm" type="button" variant="secondary">
              <RotateCw className="h-4 w-4" />
              重启应用
            </Button>
          ) : (
            <Button disabled={installing} onClick={onInstall} size="sm" type="button" variant="secondary">
              <Download className="h-4 w-4" />
              {installing ? '安装中' : '下载并安装'}
            </Button>
          )}
          <Button aria-label="本次忽略" onClick={onDismiss} size="icon" title="本次忽略" type="button" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
