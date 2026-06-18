import { Activity, ChevronDown, Copy, FileText, RotateCcw, StopCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/notice';
import { Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import type { TaskLogEntry, TaskRecord } from '@/types/task';
import { cn } from '@/utils/cn';
import { taskLabel, taskStatusClass, taskStatusLabel } from '@/utils/taskLabels';
import { formatDateTime } from '@/utils/time';
import { canRetryTask, formatCount, formatTaskProgressPercent, levelLabel, matchesLogQuery, taskTiming } from './taskPageModel';

type TaskQueuePanelProps = {
  expandedId: string | null;
  filteredTasks: TaskRecord[];
  focusTaskId?: string | null;
  logsByTask: Record<string, TaskLogEntry[]>;
  logQueryByTask: Record<string, string>;
  tasks: TaskRecord[];
  onCancel: (id: string) => void;
  onCopyTaskDiagnostic: (task: TaskRecord) => void;
  onCopyTaskLog: (log: TaskLogEntry) => void;
  onLogQueryChange: (taskId: string, value: string) => void;
  onResetFilters: () => void;
  onRetry: (id: string) => void;
  onRowRef: (taskId: string, node: HTMLDivElement | null) => void;
  onToggleExpanded: (id: string) => void;
};

export function TaskQueuePanel({ expandedId, filteredTasks, focusTaskId, logsByTask, logQueryByTask, onCancel, onCopyTaskDiagnostic, onCopyTaskLog, onLogQueryChange, onResetFilters, onRetry, onRowRef, onToggleExpanded, tasks }: TaskQueuePanelProps) {
  return (
    <Panel>
      <PanelHeader title="任务队列" description={`显示 ${formatCount(filteredTasks.length)} / ${formatCount(tasks.length)} 个任务`} icon={<Activity className="h-4 w-4" />} />
      <PanelContent className="space-y-2">
        {tasks.length === 0 ? (
          <EmptyState>还没有任务记录。启动批量匹配后会在这里看到任务进度。</EmptyState>
        ) : filteredTasks.length === 0 ? (
          <EmptyState className="flex min-h-[12rem] flex-col items-center justify-center gap-3 py-8">
            <span>当前筛选没有匹配任务。</span>
            <Button size="sm" variant="outline" onClick={onResetFilters}>重置筛选</Button>
          </EmptyState>
        ) : filteredTasks.map((task) => {
          const expanded = expandedId === task.id;
          const logs = logsByTask[task.id] ?? [];
          const logQuery = logQueryByTask[task.id] ?? '';
          const filteredLogs = logs.filter((log) => matchesLogQuery(log, logQuery));
          const timing = taskTiming(task);
          return (
            <SoftRow ref={(node) => onRowRef(task.id, node)} key={task.id} className={cn(expanded && 'border-[rgb(var(--accent-rgb)/0.32)] bg-[rgb(var(--accent-rgb)/0.08)]', focusTaskId === task.id && 'ring-2 ring-[rgb(var(--accent-rgb)/0.42)]')}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-sm font-medium text-slate-100">{taskLabel(task.taskType)}</div>
                    <Badge className={taskStatusClass(task.status)}>{taskStatusLabel(task.status)}</Badge>
                    <span className="text-xs text-slate-500">{formatTaskProgressPercent(task.progress)}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{task.message || '无消息'} · 更新 {formatDateTime(task.updatedAt)}</div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span>开始 {formatDateTime(task.createdAt)}</span>
                    <span>{timing.elapsedLabel}</span>
                    {timing.remainingLabel && <span title="根据已运行时间和当前进度估算">{timing.remainingLabel}</span>}
                  </div>
                  {task.error && <div className="mt-2 text-xs text-rose-200">{task.error}</div>}
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/20">
                    <div className="h-full rounded-full bg-[rgb(var(--accent-rgb))]" style={{ width: formatTaskProgressPercent(task.progress) }} />
                  </div>
                  {expanded && (
                    <div className="mt-3 rounded-md border border-white/10 bg-black/15 p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-300"><FileText className="h-3.5 w-3.5 text-[rgb(var(--accent-rgb))]" />任务日志</div>
                        <div className="flex min-w-[14rem] flex-1 items-center gap-2 sm:flex-initial">
                          <Input aria-label={`日志搜索 ${taskLabel(task.taskType)}`} className="h-8 w-full sm:w-56" placeholder="搜索日志" value={logQuery} onChange={(event) => onLogQueryChange(task.id, event.target.value)} />
                          <Button className="h-8 px-2" disabled={!logQuery.trim()} size="sm" variant="ghost" onClick={() => onLogQueryChange(task.id, '')}>清空</Button>
                        </div>
                      </div>
                      {logs.length === 0 ? (
                        <div className="text-xs text-slate-500">暂无日志。</div>
                      ) : filteredLogs.length === 0 ? (
                        <div className="rounded-md border border-white/10 bg-black/10 px-3 py-2 text-xs text-slate-500">当前日志筛选无结果。</div>
                      ) : (
                        <div className="space-y-2">
                          {filteredLogs.map((log) => (
                            <div className="grid gap-1 text-xs sm:grid-cols-[6.5rem_4rem_minmax(0,1fr)_auto]" data-task-log-id={log.id} key={log.id}>
                              <span className="text-slate-500">{formatDateTime(log.createdAt)}</span>
                              <span className={cn('font-medium', log.level === 'error' ? 'text-rose-200' : log.level === 'warn' ? 'text-amber-200' : 'text-slate-400')}>{levelLabel(log.level)}</span>
                              <span className="text-slate-300">{log.message}</span>
                              <Button aria-label="复制记录" className="h-6 px-2" size="sm" title="复制任务日志" variant="ghost" onClick={() => onCopyTaskLog(log)}><Copy className="h-3.5 w-3.5" />复制</Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => onToggleExpanded(task.id)}><ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />日志</Button>
                  <Button size="sm" variant="ghost" onClick={() => onCopyTaskDiagnostic(task)}><Copy className="h-4 w-4" />诊断</Button>
                  <Button disabled={!canRetryTask(task)} size="sm" variant="outline" onClick={() => onRetry(task.id)}><RotateCcw className="h-4 w-4" />重试</Button>
                  <Button disabled={task.status !== 'running' && task.status !== 'pending'} size="sm" variant="outline" onClick={() => onCancel(task.id)}><StopCircle className="h-4 w-4" />取消</Button>
                </div>
              </div>
            </SoftRow>
          );
        })}
      </PanelContent>
    </Panel>
  );
}
