import { ListChecks, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import type { TaskRecord } from '@/types/task';
import { CompactStat, MaintenanceTaskRow, formatCount, type MaintenanceTaskFilter } from './MaintenancePageParts';

type MaintenanceTaskSummary = {
  activeCount: number;
  attentionCount: number;
  completedCount: number;
};

type MaintenanceTaskShortcut = {
  count: number;
  id: MaintenanceTaskFilter;
  label: string;
};

export function MaintenanceTasksPanel({
  actionBusyTaskId,
  filteredTasks,
  filter,
  loading,
  shortcuts,
  summary,
  tasks,
  onCancelTask,
  onFilterChange,
  onOpenTask,
  onRefresh,
  onRetryTask,
}: {
  actionBusyTaskId: string | null;
  filteredTasks: TaskRecord[];
  filter: MaintenanceTaskFilter;
  loading: boolean;
  shortcuts: readonly MaintenanceTaskShortcut[];
  summary: MaintenanceTaskSummary;
  tasks: TaskRecord[];
  onCancelTask: (taskId: string) => void;
  onFilterChange: (filter: MaintenanceTaskFilter) => void;
  onOpenTask?: (taskId?: string | null) => void;
  onRefresh: () => void;
  onRetryTask: (taskId: string) => void;
}) {
  return (
    <Panel>
      <PanelHeader
        title="最近维护任务"
        description="只汇总批量匹配、简介修复、媒体补图和重复 ID 审查。"
        icon={<ListChecks className="h-4 w-4" />}
        actions={<Button disabled={loading} size="sm" variant="ghost" onClick={onRefresh}><RefreshCw className="h-4 w-4" />{loading ? '读取中' : '刷新任务'}</Button>}
      />
      <PanelContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <CompactStat label="维护任务" value={tasks.length} />
          <CompactStat label="进行中" value={summary.activeCount} tone={summary.activeCount > 0 ? 'warn' : 'ok'} />
          <CompactStat label="需处理" value={summary.attentionCount} tone={summary.attentionCount > 0 ? 'warn' : 'ok'} />
          <CompactStat label="已完成" value={summary.completedCount} tone={summary.completedCount > 0 ? 'ok' : 'neutral'} />
        </div>
        <div className="grid gap-1.5 sm:grid-cols-4" aria-label="维护任务状态快捷筛选">
          {shortcuts.map((shortcut) => {
            const active = filter === shortcut.id;
            return (
              <Button
                aria-pressed={active}
                className={active ? 'border-[rgb(var(--accent-rgb)/0.42)] bg-[rgb(var(--accent-rgb)/0.16)] text-slate-100' : 'text-slate-300'}
                key={shortcut.id}
                size="sm"
                variant="outline"
                onClick={() => onFilterChange(shortcut.id)}
              >
                <span>{shortcut.label}</span>
                <span className="font-mono text-[11px] text-slate-400">{formatCount(shortcut.count)}</span>
              </Button>
            );
          })}
        </div>
        {tasks.length > 0 ? (
          filteredTasks.length > 0 ? (
            <div className="space-y-2">
              {filteredTasks.map((task) => (
                <MaintenanceTaskRow
                  actionBusy={actionBusyTaskId === task.id}
                  key={task.id}
                  onCancelTask={onCancelTask}
                  onOpenTask={onOpenTask}
                  onRetryTask={onRetryTask}
                  task={task}
                />
              ))}
            </div>
          ) : (
            <SoftRow className="px-3 py-3 text-sm text-slate-400">当前筛选没有匹配的维护任务。</SoftRow>
          )
        ) : (
          <SoftRow className="px-3 py-3 text-sm text-slate-400">还没有维护任务记录。创建批量匹配、简介修复、媒体补图或重复 ID 审查后会显示在这里。</SoftRow>
        )}
      </PanelContent>
    </Panel>
  );
}
