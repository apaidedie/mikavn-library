import { AlertTriangle, ClipboardCopy, FileArchive, Wrench, X } from 'lucide-react';
import { useState } from 'react';
import { DiagnosticExportPathActions } from '@/components/diagnostics/DiagnosticExportPathActions';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { errorMessage } from '@/utils/errorMessage';

type AppStartupSelfCheckNoticeProps = {
  diagnosticExportLoading: boolean;
  diagnosticExportMessage: string | null;
  diagnosticExportPath: string | null;
  error: string | null;
  onDismiss: () => void;
  onExportDiagnosticPackage: () => void;
  onOpenMaintenance: () => void;
  onRevealDiagnosticExportPath: () => void;
  startupSelfCheckWarnings: string[];
};

export function AppStartupSelfCheckNotice({
  diagnosticExportLoading,
  diagnosticExportMessage,
  diagnosticExportPath,
  error,
  onDismiss,
  onExportDiagnosticPackage,
  onOpenMaintenance,
  onRevealDiagnosticExportPath,
  startupSelfCheckWarnings,
}: AppStartupSelfCheckNoticeProps) {
  const [diagnosticCopyMessage, setDiagnosticCopyMessage] = useState<string | null>(null);
  const warningPreview = startupSelfCheckWarnings.slice(0, 3);

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

  const copyStartupSelfCheckSummary = async () => {
    setDiagnosticCopyMessage(null);
    const summary = [
      'MikaVN 启动自检摘要',
      error ? `错误：${error}` : startupSelfCheckWarnings.join('\n'),
    ].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(summary);
      setDiagnosticCopyMessage('自检摘要已复制。');
    } catch (reason) {
      setDiagnosticCopyMessage(`复制自检摘要失败：${errorMessage(reason)}`);
    }
  };

  return (
    <Notice className="mx-3 mt-3" tone="warning">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            启动自检发现问题
          </div>
          {error ? <div className="mt-1 break-all text-xs opacity-90">{error}</div> : (
            <div className="mt-1 space-y-1 text-xs opacity-90">
              {warningPreview.map((warning) => <div className="break-all" key={warning}>{warning}</div>)}
              {startupSelfCheckWarnings.length > warningPreview.length && <div>还有 {startupSelfCheckWarnings.length - warningPreview.length} 条警告。</div>}
            </div>
          )}
          <div className="mt-1 text-xs opacity-80">建议先打开维护中心查看数据目录、数据库和图片健康；需要反馈问题时先导出诊断包。</div>
          {diagnosticExportMessage && <div className="mt-1 break-all text-xs opacity-90">{diagnosticExportMessage}</div>}
          {diagnosticExportPath && (
            <div className="mt-2 flex flex-wrap gap-2">
              <DiagnosticExportPathActions
                buttonSize="sm"
                buttonVariant="ghost"
                path={diagnosticExportPath}
                onCopy={() => void copyDiagnosticExportPath()}
                onReveal={onRevealDiagnosticExportPath}
              />
            </div>
          )}
          {diagnosticCopyMessage && <div className="mt-1 break-all text-xs opacity-90" role="status">{diagnosticCopyMessage}</div>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => void copyStartupSelfCheckSummary()}>
            <ClipboardCopy className="h-4 w-4" />
            复制自检摘要
          </Button>
          <Button disabled={diagnosticExportLoading} size="sm" variant="outline" onClick={onExportDiagnosticPackage}>
            <FileArchive className="h-4 w-4" />
            {diagnosticExportLoading ? '导出中' : '导出诊断包'}
          </Button>
          <Button size="sm" variant="outline" onClick={onOpenMaintenance}>
            <Wrench className="h-4 w-4" />
            打开维护中心
          </Button>
          <Button aria-label="关闭启动自检提示" size="icon" variant="ghost" onClick={onDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Notice>
  );
}
