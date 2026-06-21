import { ClipboardCopy, Download, ExternalLink, RotateCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { updaterFallbackDownloadUrl, type UpdateProtectionBackupInfo, type UpdaterCheckResult } from '@/services/updaterModel';

type AppUpdateNoticeProps = {
  notice: Extract<UpdaterCheckResult, { kind: 'available' }>;
  installing: boolean;
  installed: boolean;
  progressText: string | null;
  error: string | null;
  backupInfo: UpdateProtectionBackupInfo | null;
  onDismiss: () => void;
  onInstall: () => void;
  onRestart: () => void;
};

export function AppUpdateNotice({ notice, installing, installed, progressText, error, backupInfo, onDismiss, onInstall, onRestart }: AppUpdateNoticeProps) {
  return (
    <div className="border-b border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-50">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">发现新版本 {notice.version}</p>
          <p className="truncate text-xs text-emerald-100/80">{installed ? '更新已安装，请重启应用。' : notice.notes}</p>
          {progressText && <p className="mt-1 text-xs text-amber-100">{progressText}</p>}
          {installed && backupInfo && <p className="mt-1 truncate text-xs text-emerald-100/80">更新前数据库备份：{backupInfo.fileName}</p>}
          {error && <p className="mt-1 select-text text-xs text-rose-100">{error}</p>}
          {error && (
            <div className="mt-1 flex flex-wrap gap-2">
              <button className="inline-flex items-center gap-1 text-xs text-emerald-50 underline underline-offset-2" type="button" onClick={() => void navigator.clipboard.writeText(error)}>
                <ClipboardCopy className="h-3.5 w-3.5" />
                复制错误
              </button>
              <a className="inline-flex items-center gap-1 text-xs text-emerald-50 underline underline-offset-2" href={updaterFallbackDownloadUrl} rel="noreferrer" target="_blank">
                <ExternalLink className="h-3.5 w-3.5" />
                备用下载页面
              </a>
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
