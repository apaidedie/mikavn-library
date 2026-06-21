import { AlertTriangle, Database, FileArchive, X } from 'lucide-react';
import { DiagnosticExportPathActions } from '@/components/diagnostics/DiagnosticExportPathActions';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';

type AppStartupDatabaseBackupNoticeProps = {
  diagnosticExportLoading: boolean;
  diagnosticExportMessage: string | null;
  diagnosticExportPath: string | null;
  error: string;
  onDismiss: () => void;
  onExportDiagnosticPackage: () => void;
  onOpenSettings: () => void;
  onRevealDiagnosticExportPath: () => void;
};

export function AppStartupDatabaseBackupNotice({
  diagnosticExportLoading,
  diagnosticExportMessage,
  diagnosticExportPath,
  error,
  onDismiss,
  onExportDiagnosticPackage,
  onOpenSettings,
  onRevealDiagnosticExportPath,
}: AppStartupDatabaseBackupNoticeProps) {
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
          {diagnosticExportMessage && <div className="mt-1 break-all text-xs opacity-90">{diagnosticExportMessage}</div>}
          {diagnosticExportPath && (
            <div className="mt-2 flex flex-wrap gap-2">
              <DiagnosticExportPathActions
                buttonSize="sm"
                buttonVariant="ghost"
                path={diagnosticExportPath}
                onCopy={() => void navigator.clipboard.writeText(diagnosticExportPath)}
                onReveal={onRevealDiagnosticExportPath}
              />
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button disabled={diagnosticExportLoading} size="sm" variant="outline" onClick={onExportDiagnosticPackage}>
            <FileArchive className="h-4 w-4" />
            {diagnosticExportLoading ? '导出中' : '导出诊断包'}
          </Button>
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
