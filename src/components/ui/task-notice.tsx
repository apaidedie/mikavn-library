import { ListTodo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';

export function TaskNotice({ message, taskId, onOpenTask }: { message: string; taskId?: string | null; onOpenTask?: (taskId: string) => void }) {
  return (
    <Notice className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
      <span>{message}</span>
      {taskId && onOpenTask && (
        <Button size="sm" variant="ghost" onClick={() => onOpenTask(taskId)}>
          <ListTodo className="h-4 w-4" />查看日志
        </Button>
      )}
    </Notice>
  );
}
