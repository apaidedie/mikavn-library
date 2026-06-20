import { FileArchive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';

export function DashboardErrorNotice({
  diagnosticExportLoading,
  diagnosticExportMessage,
  message,
  tone,
  onExportDiagnosticPackage,
}: {
  diagnosticExportLoading: boolean;
  diagnosticExportMessage: string | null;
  message: string;
  tone: 'error' | 'warning';
  onExportDiagnosticPackage: () => void;
}) {
  return (
    <Notice tone={tone}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div>{message}</div>
          <div className="mt-1 text-xs opacity-80">启动或首页读取失败时，可以导出诊断包发给维护者排查。</div>
          {diagnosticExportMessage && <div className="mt-1 break-all text-xs opacity-90">{diagnosticExportMessage}</div>}
        </div>
        <Button disabled={diagnosticExportLoading} size="sm" variant="outline" onClick={onExportDiagnosticPackage}>
          <FileArchive className="h-4 w-4" />
          {diagnosticExportLoading ? '导出中' : '导出诊断包'}
        </Button>
      </div>
    </Notice>
  );
}
