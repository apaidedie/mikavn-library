import { Activity, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, Notice } from '@/components/ui/notice';
import { Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import { api } from '@/services/api';
import type { TaskFilterPreset, TaskRecord } from '@/types/task';
import { cn } from '@/utils/cn';
import { errorMessage } from '@/utils/errorMessage';
import { taskLabel, taskStatusClass, taskStatusLabel } from '@/utils/taskLabels';
import { formatDateTime } from '@/utils/time';
import { canRetryDashboardTask, deriveDashboardTaskSummary, formatDashboardTaskProgress } from './dashboardPersonal';

export function RecentTasksPanel({ tasks, onOpenTasks }: { tasks: TaskRecord[]; onOpenTasks?: (taskId?: string | null, preset?: TaskFilterPreset | null) => void }) {
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const taskSummary = useMemo(() => deriveDashboardTaskSummary(tasks), [tasks]);

  async function retryFromDashboard(id: string) {
    setRetryingId(id);
    try {
      const task = await api.retryTask(id);
      setActionError(null);
      onOpenTasks?.(task.id, { typeFilter: task.taskType });
    } catch (reason) {
      setActionError(errorMessage(reason));
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <Panel>
      <PanelHeader
        title="近期任务"
        description={taskSummary.activeCount > 0 ? `${taskSummary.activeCount} 个任务需要关注` : '扫描、备份、导出和路径检查会出现在这里。'}
        icon={<Activity className="h-4 w-4" />}
        actions={onOpenTasks && (
          <>
            <Button disabled={taskSummary.attentionCount === 0} size="sm" variant="outline" onClick={() => onOpenTasks(null, { statusFilter: 'attention' })}>需处理 {taskSummary.attentionCount}</Button>
            <Button disabled={taskSummary.runningCount === 0} size="sm" variant="outline" onClick={() => onOpenTasks(null, { statusFilter: 'active' })}>进行中 {taskSummary.runningCount}</Button>
            <Button disabled={taskSummary.completedCount === 0} size="sm" variant="outline" onClick={() => onOpenTasks(null, { statusFilter: 'completed' })}>已完成 {taskSummary.completedCount}</Button>
            <Button size="sm" variant="outline" onClick={() => onOpenTasks()}>全部任务</Button>
          </>
        )}
      />
      <PanelContent className="space-y-2">
        {actionError && <Notice tone="error">{actionError}</Notice>}
        {tasks.length === 0 ? (
          <EmptyState className="py-7">暂无任务记录。开始扫描、备份或批量匹配后会在这里看到进度。</EmptyState>
        ) : (
          <>
            {taskSummary.recentResults.length > 0 && (
              <div aria-label="首页最近任务结果" className="space-y-2 rounded-md border border-white/10 bg-black/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-slate-100">最近结果</div>
                    <div className="mt-0.5 text-xs text-slate-500">最近结束的任务可以直接打开日志复核。</div>
                  </div>
                  <Badge>{taskSummary.recentResults.length} 条</Badge>
                </div>
                <div className="grid gap-2 xl:grid-cols-2">
                  {taskSummary.recentResults.map((task) => (
                    <div className="rounded-md border border-white/10 bg-black/15 px-3 py-3" data-task-result-id={task.id} key={task.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={taskStatusClass(task.status)}>{taskStatusLabel(task.status)}</Badge>
                        <span className="truncate text-xs font-medium text-slate-300">{taskLabel(task.taskType)}</span>
                      </div>
                      <div className="mt-2 line-clamp-2 text-sm text-slate-100">{task.message || task.error || '任务已结束。'}</div>
                      {task.error && <div className="mt-1 line-clamp-1 text-xs text-rose-200">{task.error}</div>}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500">{formatDateTime(task.updatedAt)}</span>
                        <div className="flex items-center justify-end gap-2">
                          {onOpenTasks && <Button size="sm" variant="ghost" onClick={() => onOpenTasks(task.id)}>日志</Button>}
                          {canRetryDashboardTask(task) && <Button disabled={retryingId === task.id} size="sm" variant="outline" onClick={() => void retryFromDashboard(task.id)}><RotateCcw className="h-4 w-4" />{retryingId === task.id ? '重试中' : '重试'}</Button>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {tasks.map((task) => (
              <SoftRow className={cn('grid gap-3 px-3 py-3 lg:grid-cols-[1fr_6rem_5rem_auto]', task.status === 'failed' && 'border-rose-300/20 bg-rose-400/[0.055]')} key={task.id}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-100">{taskLabel(task.taskType)}</span>
                    <Badge className={taskStatusClass(task.status)}>{taskStatusLabel(task.status)}</Badge>
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500">{task.error || task.message || '无消息'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">进度</div>
                  <div className="mt-1 text-sm text-slate-100">{formatDashboardTaskProgress(task.progress)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">更新</div>
                  <div className="mt-1 text-xs text-slate-300">{formatDateTime(task.updatedAt)}</div>
                </div>
                <div className="flex items-center justify-end">
                  {onOpenTasks && <Button size="sm" variant="ghost" onClick={() => onOpenTasks(task.id)}>日志</Button>}
                </div>
              </SoftRow>
            ))}
          </>
        )}
      </PanelContent>
    </Panel>
  );
}
