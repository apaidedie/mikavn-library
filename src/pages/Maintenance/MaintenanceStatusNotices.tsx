import { CheckCircle2, ClipboardCopy, FolderOpen } from 'lucide-react';
import { DiagnosticExportPathActions } from '@/components/diagnostics/DiagnosticExportPathActions';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { TaskNotice } from '@/components/ui/task-notice';
import type { AppDataDiagnostics } from '@/types/archive';

type TaskMessage = { text: string; taskId?: string | null };

type MaintenanceStatusNoticesProps = {
  diagnostics: AppDataDiagnostics | null;
  diagnosticExportPath: string | null;
  error: string | null;
  imageQuarantinePath: { manifestPath: string; quarantineDir: string } | null;
  message: TaskMessage | null;
  onCopyDiagnosticExportPath: () => void;
  onCopyImageQuarantineManifestPath: () => void;
  onOpenTask?: (taskId?: string | null) => void;
  onRevealImageQuarantineDir: () => void;
  onRevealDiagnosticExportPath: () => void;
};

export function MaintenanceStatusNotices({
  diagnostics,
  diagnosticExportPath,
  error,
  imageQuarantinePath,
  message,
  onCopyDiagnosticExportPath,
  onCopyImageQuarantineManifestPath,
  onOpenTask,
  onRevealImageQuarantineDir,
  onRevealDiagnosticExportPath,
}: MaintenanceStatusNoticesProps) {
  return (
    <>
      {(error || message) && (
        <div className="space-y-2">
          {error && <Notice className="py-2" tone="error">{error}</Notice>}
          {message && <TaskNotice message={message.text} taskId={message.taskId} onOpenTask={onOpenTask} />}
          {message && diagnosticExportPath && (
            <div className="flex flex-wrap gap-2">
              <DiagnosticExportPathActions
                buttonSize="sm"
                buttonVariant="ghost"
                path={diagnosticExportPath}
                onCopy={onCopyDiagnosticExportPath}
                onReveal={onRevealDiagnosticExportPath}
              />
            </div>
          )}
          {message && imageQuarantinePath && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" onClick={onRevealImageQuarantineDir}>
                <FolderOpen className="h-4 w-4" />
                打开隔离区
              </Button>
              <Button size="sm" variant="ghost" onClick={onCopyImageQuarantineManifestPath}>
                <ClipboardCopy className="h-4 w-4" />
                复制隔离清单路径
              </Button>
            </div>
          )}
        </div>
      )}

      {diagnostics?.warnings.length ? (
        <Notice tone="warning">
          <div className="flex flex-col gap-1 text-xs leading-5">
            {diagnostics.warnings.slice(0, 6).map((warning) => <span key={warning}>{warning}</span>)}
            {diagnostics.warnings.length > 6 && <span>还有 {diagnostics.warnings.length - 6} 条警告。</span>}
          </div>
        </Notice>
      ) : diagnostics ? (
        <Notice>
          <span className="inline-flex items-center gap-2 text-xs"><CheckCircle2 className="h-4 w-4 text-emerald-200" />当前自检没有发现高优先级警告。</span>
        </Notice>
      ) : null}
    </>
  );
}
