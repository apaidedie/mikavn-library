import { CheckCircle2 } from 'lucide-react';
import { Notice } from '@/components/ui/notice';
import { TaskNotice } from '@/components/ui/task-notice';
import type { AppDataDiagnostics } from '@/types/archive';

type TaskMessage = { text: string; taskId?: string | null };

type MaintenanceStatusNoticesProps = {
  diagnostics: AppDataDiagnostics | null;
  error: string | null;
  message: TaskMessage | null;
  onOpenTask?: (taskId?: string | null) => void;
};

export function MaintenanceStatusNotices({ diagnostics, error, message, onOpenTask }: MaintenanceStatusNoticesProps) {
  return (
    <>
      {(error || message) && (
        <div className="space-y-2">
          {error && <Notice className="py-2" tone="error">{error}</Notice>}
          {message && <TaskNotice message={message.text} taskId={message.taskId} onOpenTask={onOpenTask} />}
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
