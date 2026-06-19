import { Notice } from '@/components/ui/notice';
import { TaskNotice } from '@/components/ui/task-notice';

type TaskMessage = { text: string; taskId?: string | null };

type ScannerStatusNoticesProps = {
  error: string | null;
  message: TaskMessage | null;
  onOpenTask?: (taskId: string) => void;
};

export function ScannerStatusNotices({ error, message, onOpenTask }: ScannerStatusNoticesProps) {
  if (!message && !error) return null;

  return (
    <div className="space-y-2">
      {message && <TaskNotice message={message.text} taskId={message.taskId} onOpenTask={onOpenTask} />}
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
