import { Activity, AlertTriangle, CheckCircle2, Copy, FileText, ListFilter, RotateCcw, Timer } from 'lucide-react';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MetricTile, Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import type { TaskRecord, TaskStatus } from '@/types/task';
import { cn } from '@/utils/cn';
import { taskLabel, taskStatusClass, taskStatusLabel } from '@/utils/taskLabels';
import { formatDateTime } from '@/utils/time';
import { canRetryTask, deriveRecentResultTasks, deriveTaskPageSummary, deriveTaskTypeShortcuts, formatCount } from './taskPageModel';

type TaskOverviewPanelProps = {
  filteredTasks: TaskRecord[];
  statusFilter: string;
  taskQuery: string;
  tasks: TaskRecord[];
  typeFilter: string;
  onApplyStatusShortcut: (status: TaskStatus | 'all' | 'active' | 'attention') => void;
  onApplyTypeShortcut: (taskType: string) => void;
  onCopyTaskDiagnostic: (task: TaskRecord) => void;
  onOpenResultLogs: (id: string) => void;
  onResetFilters: () => void;
  onRetry: (id: string) => void;
  onStatusFilterChange: (value: string) => void;
  onTaskQueryChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
};

export function TaskOverviewPanel({ filteredTasks, onApplyStatusShortcut, onApplyTypeShortcut, onCopyTaskDiagnostic, onOpenResultLogs, onResetFilters, onRetry, onStatusFilterChange, onTaskQueryChange, onTypeFilterChange, statusFilter, taskQuery, tasks, typeFilter }: TaskOverviewPanelProps) {
  const taskSummary = useMemo(() => deriveTaskPageSummary(tasks), [tasks]);
  const taskTypeShortcuts = useMemo(() => deriveTaskTypeShortcuts(tasks), [tasks]);
  const recentResultTasks = useMemo(() => deriveRecentResultTasks(filteredTasks), [filteredTasks]);

  return (
    <Panel>
      <PanelHeader title="任务概览" description="按状态和类型快速定位需要处理的长任务。" icon={<Activity className="h-4 w-4" />} />
      <PanelContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile icon={<ListFilter className="h-3.5 w-3.5" />} label="任务总数" value={formatCount(tasks.length)} detail={`当前显示 ${formatCount(filteredTasks.length)} 个`} />
          <MetricTile icon={<Timer className="h-3.5 w-3.5" />} label="进行中" value={formatCount(taskSummary.activeCount)} detail="运行中 / 等待中" />
          <MetricTile icon={<AlertTriangle className="h-3.5 w-3.5" />} label="需处理" value={formatCount(taskSummary.attentionCount)} detail="失败 / 已取消" />
          <MetricTile icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="已完成" value={formatCount(taskSummary.completedCount)} detail={`队列进度 ${taskSummary.queueProgress}%`} />
        </div>
        <div className="grid gap-1.5 sm:grid-cols-4" aria-label="任务状态快捷筛选">
          {taskSummary.statusShortcuts.map((shortcut) => {
            const active = statusFilter === shortcut.id;
            return (
              <Button
                aria-pressed={active}
                className={active ? 'border-[rgb(var(--accent-rgb)/0.42)] bg-[rgb(var(--accent-rgb)/0.16)] text-slate-100' : 'text-slate-300'}
                key={shortcut.id}
                size="sm"
                variant="outline"
                onClick={() => onApplyStatusShortcut(shortcut.id)}
              >
                <span>{shortcut.label}</span>
                <span className="font-mono text-[11px] text-slate-400">{formatCount(shortcut.count)}</span>
              </Button>
            );
          })}
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4" aria-label="任务类型快捷筛选">
          {taskTypeShortcuts.map((shortcut) => {
            const active = typeFilter === shortcut.id;
            return (
              <Button
                aria-pressed={active}
                className={cn('justify-between', active ? 'border-[rgb(var(--accent-rgb)/0.42)] bg-[rgb(var(--accent-rgb)/0.16)] text-slate-100' : 'text-slate-300')}
                key={shortcut.id}
                size="sm"
                variant="outline"
                onClick={() => onApplyTypeShortcut(shortcut.id)}
              >
                <span className="truncate">{shortcut.label}</span>
                <span className="font-mono text-[11px] text-slate-400">{formatCount(shortcut.count)}</span>
              </Button>
            );
          })}
        </div>
        {recentResultTasks.length > 0 && (
          <div aria-label="最近任务结果" className="space-y-2 rounded-md border border-white/10 bg-black/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium text-slate-100">最近结果</div>
                <div className="mt-0.5 text-xs text-slate-500">显示当前筛选下最近结束的任务，方便直接回看处理结果。</div>
              </div>
              <Badge>{formatCount(recentResultTasks.length)} 个结果</Badge>
            </div>
            <div className="grid gap-2 xl:grid-cols-3">
              {recentResultTasks.map((task) => (
                <div className="rounded-md border border-white/10 bg-black/15 px-3 py-3" data-task-result-id={task.id} key={task.id}>
                  <div className="flex h-full flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={taskStatusClass(task.status)}>{taskStatusLabel(task.status)}</Badge>
                      <span className="truncate text-xs font-medium text-slate-300">{taskLabel(task.taskType)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-sm text-slate-100">{task.message || task.error || '任务已结束。'}</div>
                      {task.error && <div className="mt-1 line-clamp-1 text-xs text-rose-200">{task.error}</div>}
                      <div className="mt-2 text-[11px] text-slate-500">更新 {formatDateTime(task.updatedAt)}</div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => onOpenResultLogs(task.id)}><FileText className="h-4 w-4" />日志</Button>
                      <Button size="sm" variant="ghost" onClick={() => onCopyTaskDiagnostic(task)}><Copy className="h-4 w-4" />诊断</Button>
                      {canRetryTask(task) && <Button size="sm" variant="outline" onClick={() => onRetry(task.id)}><RotateCcw className="h-4 w-4" />重试</Button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <SoftRow className="grid gap-3 px-3 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)_minmax(14rem,18rem)_minmax(14rem,18rem)_auto] lg:items-end">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
              <span>队列总体进度</span>
              <span className="font-mono text-slate-200">{taskSummary.queueProgress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/25">
              <div className="h-full rounded-full bg-[rgb(var(--accent-rgb))]" style={{ width: `${taskSummary.queueProgress}%` }} />
            </div>
          </div>
          <label className="text-xs text-slate-500">
            状态筛选
            <Select aria-label="任务状态筛选" className="mt-1 w-full" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
              <option value="all">全部状态</option>
              <option value="active">运行中 / 等待中</option>
              <option value="attention">需要处理</option>
              <option value="completed">已完成</option>
              <option value="failed">失败</option>
              <option value="cancelled">已取消</option>
            </Select>
          </label>
          <label className="text-xs text-slate-500">
            类型筛选
            <Select aria-label="任务类型筛选" className="mt-1 w-full" value={typeFilter} onChange={(event) => onTypeFilterChange(event.target.value)}>
              <option value="all">全部类型</option>
              {taskTypeShortcuts.filter((shortcut) => shortcut.id !== 'all').map((shortcut) => <option key={shortcut.id} value={shortcut.id}>{shortcut.label}</option>)}
            </Select>
          </label>
          <label className="text-xs text-slate-500">
            任务搜索
            <Input aria-label="任务搜索" className="mt-1 w-full" placeholder="消息 / 错误 / 类型" value={taskQuery} onChange={(event) => onTaskQueryChange(event.target.value)} />
          </label>
          <Button disabled={statusFilter === 'all' && typeFilter === 'all' && !taskQuery.trim()} size="sm" variant="outline" onClick={onResetFilters}>重置筛选</Button>
        </SoftRow>
      </PanelContent>
    </Panel>
  );
}
