import { AlertTriangle, Database, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';

type AppStartupDatabaseBackupNoticeProps = {
  error: string;
  onDismiss: () => void;
  onOpenSettings: () => void;
};

export function AppStartupDatabaseBackupNotice({ error, onDismiss, onOpenSettings }: AppStartupDatabaseBackupNoticeProps) {
  return (
    <Notice className="mx-3 mt-3" tone="warning">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            启动自动备份失败
          </div>
          <div className="mt-1 break-all text-xs opacity-90">{error}</div>
          <div className="mt-1 text-xs opacity-80">请确认数据库备份目录可写；当前数据库没有被这个自动备份流程修改。</div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onOpenSettings}>
            <Database className="h-4 w-4" />
            打开本地数据设置
          </Button>
          <Button aria-label="关闭启动自动备份提示" size="icon" variant="ghost" onClick={onDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Notice>
  );
}
