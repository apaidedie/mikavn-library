import { CheckCircle2 } from 'lucide-react';
import { DiagnosticExportPathActions } from '@/components/diagnostics/DiagnosticExportPathActions';
import { Notice } from '@/components/ui/notice';
import { TaskNotice } from '@/components/ui/task-notice';
import type { AppDataDiagnostics } from '@/types/archive';

type TaskMessage = { text: string; taskId?: string | null };

type MaintenanceStatusNoticesProps = {
  diagnostics: AppDataDiagnostics | null;
  diagnosticExportPath: string | null;
  error: string | null;
  message: TaskMessage | null;
  onCopyDiagnosticExportPath: () => void;
  onOpenTask?: (taskId?: string | null) => void;
  onRevealDiagnosticExportPath: () => void;
};

export function MaintenanceStatusNotices({
  diagnostics,
  diagnosticExportPath,
  error,
  message,
  onCopyDiagnosticExportPath,
  onOpenTask,
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
