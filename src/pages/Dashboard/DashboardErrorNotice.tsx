import { FileArchive } from 'lucide-react';
import { useState } from 'react';
import { DiagnosticExportPathActions } from '@/components/diagnostics/DiagnosticExportPathActions';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { errorMessage } from '@/utils/errorMessage';

export function DashboardErrorNotice({
  diagnosticExportLoading,
  diagnosticExportMessage,
  diagnosticExportPath,
  message,
  tone,
  onExportDiagnosticPackage,
  onRevealDiagnosticExportPath,
}: {
  diagnosticExportLoading: boolean;
  diagnosticExportMessage: string | null;
  diagnosticExportPath: string | null;
  message: string;
  tone: 'error' | 'warning';
  onExportDiagnosticPackage: () => void;
  onRevealDiagnosticExportPath: () => void;
}) {
  const [diagnosticCopyMessage, setDiagnosticCopyMessage] = useState<string | null>(null);

  const copyDiagnosticExportPath = async () => {
    if (!diagnosticExportPath) return;
    setDiagnosticCopyMessage(null);
    try {
      await navigator.clipboard.writeText(diagnosticExportPath);
      setDiagnosticCopyMessage('诊断包路径已复制。');
    } catch (reason) {
      setDiagnosticCopyMessage(`复制诊断包路径失败：${errorMessage(reason)}`);
    }
  };

  return (
    <Notice tone={tone}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div>{message}</div>
          <div className="mt-1 text-xs opacity-80">启动或首页读取失败时，可以导出诊断包发给维护者排查。</div>
          {diagnosticExportMessage && <div className="mt-1 break-all text-xs opacity-90">{diagnosticExportMessage}</div>}
          {diagnosticCopyMessage && <div className="mt-1 break-all text-xs opacity-90" role="status">{diagnosticCopyMessage}</div>}
        </div>
        <Button disabled={diagnosticExportLoading} size="sm" variant="outline" onClick={onExportDiagnosticPackage}>
          <FileArchive className="h-4 w-4" />
          {diagnosticExportLoading ? '导出中' : '导出诊断包'}
        </Button>
        {diagnosticExportPath && (
          <DiagnosticExportPathActions
            buttonSize="sm"
            buttonVariant="ghost"
            path={diagnosticExportPath}
            onCopy={() => void copyDiagnosticExportPath()}
            onReveal={onRevealDiagnosticExportPath}
          />
        )}
      </div>
    </Notice>
  );
}
