import { Notice } from '@/components/ui/notice';
import { TaskNotice } from '@/components/ui/task-notice';

type TaskMessage = { text: string; taskId?: string | null };

type SavesStatusNoticesProps = {
  error: string | null;
  message: TaskMessage | null;
  onOpenTask?: (taskId: string) => void;
};

export function SavesStatusNotices({ error, message, onOpenTask }: SavesStatusNoticesProps) {
  if (!error && !message) return null;

  return (
    <div className="space-y-2">
      {error && <Notice tone="error">{error}</Notice>}
      {message && <TaskNotice message={message.text} taskId={message.taskId} onOpenTask={onOpenTask} />}
    </div>
  );
}
