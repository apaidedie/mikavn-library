import { Download, RotateCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UpdaterCheckResult } from '@/services/updaterModel';

type AppUpdateNoticeProps = {
  notice: Extract<UpdaterCheckResult, { kind: 'available' }>;
  installing: boolean;
  installed: boolean;
  error: string | null;
  onDismiss: () => void;
  onInstall: () => void;
  onRestart: () => void;
};

export function AppUpdateNotice({ notice, installing, installed, error, onDismiss, onInstall, onRestart }: AppUpdateNoticeProps) {
  return (
    <div className="border-b border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-50">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">发现新版本 {notice.version}</p>
          <p className="truncate text-xs text-emerald-100/80">{installed ? '更新已安装，请重启应用。' : notice.notes}</p>
          {error && <p className="mt-1 select-text text-xs text-rose-100">{error}</p>}
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
