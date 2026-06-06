import { Activity, AlertTriangle, CheckCircle2, ChevronDown, FileText, ListFilter, RefreshCw, RotateCcw, StopCircle, Timer } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, Notice } from '@/components/ui/notice';
import { MetricTile, PageFrame, PageHeader, PageShell, Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import { api } from '@/services/api';
import type { TaskLogEntry, TaskRecord, TaskStatus } from '@/types/task';
import { cn } from '@/utils/cn';
import { errorMessage } from '@/utils/errorMessage';
import { taskLabel, taskStatusClass, taskStatusLabel } from '@/utils/taskLabels';
import { formatDateTime } from '@/utils/time';

export function TasksPage({ refreshKey, focusTaskId, focusRequestKey = 0 }: { refreshKey: number; focusTaskId?: string | null; focusRequestKey?: number }) {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logsByTask, setLogsByTask] = useState<Record<string, TaskLogEntry[]>>({});
  const [logQueryByTask, setLogQueryByTask] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [taskQuery, setTaskQuery] = useState('');
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const handledFocusKeyRef = useRef<number | null>(null);
  const expandedIdRef = useRef<string | null>(null);

  const taskTypes = useMemo(() => [...new Set(tasks.map((task) => task.taskType))].sort((a, b) => taskLabel(a).localeCompare(taskLabel(b), 'zh-CN')), [tasks]);
  const activeCount = useMemo(() => tasks.filter(isActiveTask).length, [tasks]);
  const attentionCount = useMemo(() => tasks.filter(needsAttentionTask).length, [tasks]);
  const completedCount = useMemo(() => tasks.filter((task) => task.status === 'completed').length, [tasks]);
  const queueProgress = useMemo(() => tasks.length === 0 ? 0 : Math.round((tasks.reduce((sum, task) => sum + boundedProgress(task.progress), 0) / tasks.length) * 100), [tasks]);
  const statusShortcuts = useMemo(() => [
    { id: 'all', label: '全部', count: tasks.length },
    { id: 'active', label: '进行中', count: activeCount },
    { id: 'attention', label: '需处理', count: attentionCount },
    { id: 'completed', label: '已完成', count: completedCount },
  ] as const, [activeCount, attentionCount, completedCount, tasks.length]);
  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'active' && isActiveTask(task))
      || (statusFilter === 'attention' && needsAttentionTask(task))
      || task.status === statusFilter;
    const matchesType = typeFilter === 'all' || task.taskType === typeFilter;
    const matchesQuery = matchesTaskQuery(task, taskQuery);
    return matchesStatus && matchesType && matchesQuery;
  }), [statusFilter, taskQuery, tasks, typeFilter]);
  const resetFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setTaskQuery('');
  };
  const applyStatusShortcut = (status: TaskStatus | 'all' | 'active' | 'attention') => {
    setStatusFilter(status);
    setTaskQuery('');
  };

  useEffect(() => {
    expandedIdRef.current = expandedId;
  }, [expandedId]);

  useEffect(() => {
    void loadTasks();
  }, [refreshKey]);

  useEffect(() => {
    if (!tasks.some((task) => task.status === 'running' || task.status === 'pending')) return;
    const timer = window.setInterval(() => void loadTasks({ quiet: true }), 1200);
    return () => window.clearInterval(timer);
  }, [tasks]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listen<TaskRecord>('task://updated', (event) => {
      const task = event.payload;
      setTasks((current) => [task, ...current.filter((item) => item.id !== task.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      if (expandedIdRef.current === task.id) {
        void loadLogs(task.id);
      }
    }).then((cleanup) => {
      if (disposed) cleanup();
      else unlisten = cleanup;
    }).catch(() => undefined);

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!focusTaskId || handledFocusKeyRef.current === focusRequestKey || !tasks.some((task) => task.id === focusTaskId)) return;
    handledFocusKeyRef.current = focusRequestKey;
    void focusTask(focusTaskId);
  }, [focusTaskId, focusRequestKey, tasks]);

  async function loadTasks(options?: { quiet?: boolean }) {
    if (!options?.quiet) setLoading(true);
    try {
      const nextTasks = await api.listTasks(100);
      setTasks(nextTasks);
      if (expandedId && nextTasks.some((task) => task.id === expandedId)) {
        await loadLogs(expandedId);
      }
      setError(null);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      if (!options?.quiet) setLoading(false);
    }
  }

  async function loadLogs(id: string) {
    try {
      const logs = await api.listTaskLogs(id);
      setLogsByTask((current) => ({ ...current, [id]: logs }));
      setError(null);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function toggleExpanded(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    await loadLogs(id);
  }

  async function focusTask(id: string) {
    setExpandedId(id);
    await loadLogs(id);
    window.requestAnimationFrame(() => {
      rowRefs.current[id]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }

  async function cancel(id: string) {
    try {
      await api.cancelTask(id);
      await loadTasks({ quiet: true });
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function retry(id: string) {
    try {
      const task = await api.retryTask(id);
      setExpandedId(task.id);
      await loadTasks({ quiet: true });
      await loadLogs(task.id);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  return (
    <PageShell>
      <PageFrame className="max-w-[76rem] gap-6">
        <PageHeader
          title="任务"
          description="扫描、元数据、备份和导出等长任务会逐步汇总到这里。"
          actions={<Button disabled={loading} variant="outline" onClick={() => void loadTasks()}><RefreshCw className="h-4 w-4" />刷新</Button>}
        />
        {error && <Notice tone="error">{error}</Notice>}

        <Panel>
          <PanelHeader title="任务概览" description="按状态和类型快速定位需要处理的长任务。" icon={<Activity className="h-4 w-4" />} />
          <PanelContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile icon={<ListFilter className="h-3.5 w-3.5" />} label="任务总数" value={formatCount(tasks.length)} detail={`当前显示 ${formatCount(filteredTasks.length)} 个`} />
              <MetricTile icon={<Timer className="h-3.5 w-3.5" />} label="进行中" value={formatCount(activeCount)} detail="运行中 / 等待中" />
              <MetricTile icon={<AlertTriangle className="h-3.5 w-3.5" />} label="需处理" value={formatCount(attentionCount)} detail="失败 / 已取消" />
              <MetricTile icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="已完成" value={formatCount(completedCount)} detail={`队列进度 ${queueProgress}%`} />
            </div>
            <div className="grid gap-1.5 sm:grid-cols-4" aria-label="任务状态快捷筛选">
              {statusShortcuts.map((shortcut) => {
                const active = statusFilter === shortcut.id;
                return (
                  <Button
                    aria-pressed={active}
                    className={active ? 'border-[rgb(var(--accent-rgb)/0.42)] bg-[rgb(var(--accent-rgb)/0.16)] text-slate-100' : 'text-slate-300'}
                    key={shortcut.id}
                    size="sm"
                    variant="outline"
                    onClick={() => applyStatusShortcut(shortcut.id)}
                  >
                    <span>{shortcut.label}</span>
                    <span className="font-mono text-[11px] text-slate-400">{formatCount(shortcut.count)}</span>
                  </Button>
                );
              })}
            </div>
            <SoftRow className="grid gap-3 px-3 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)_minmax(14rem,18rem)_minmax(14rem,18rem)_auto] lg:items-end">
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                  <span>队列总体进度</span>
                  <span className="font-mono text-slate-200">{queueProgress}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/25">
                  <div className="h-full rounded-full bg-[rgb(var(--accent-rgb))]" style={{ width: `${queueProgress}%` }} />
                </div>
              </div>
              <label className="text-xs text-slate-500">
                状态筛选
                <Select aria-label="任务状态筛选" className="mt-1 w-full" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
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
                <Select aria-label="任务类型筛选" className="mt-1 w-full" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                  <option value="all">全部类型</option>
                  {taskTypes.map((taskType) => <option key={taskType} value={taskType}>{taskLabel(taskType)}</option>)}
                </Select>
              </label>
              <label className="text-xs text-slate-500">
                任务搜索
                <Input aria-label="任务搜索" className="mt-1 w-full" placeholder="消息 / 错误 / 类型" value={taskQuery} onChange={(event) => setTaskQuery(event.target.value)} />
              </label>
              <Button disabled={statusFilter === 'all' && typeFilter === 'all' && !taskQuery.trim()} size="sm" variant="outline" onClick={resetFilters}>重置筛选</Button>
            </SoftRow>
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader title="任务队列" description={`显示 ${formatCount(filteredTasks.length)} / ${formatCount(tasks.length)} 个任务`} icon={<Activity className="h-4 w-4" />} />
          <PanelContent className="space-y-2">
            {tasks.length === 0 ? (
              <EmptyState>还没有任务记录。启动批量匹配后会在这里看到任务进度。</EmptyState>
            ) : filteredTasks.length === 0 ? (
              <EmptyState className="flex min-h-[12rem] flex-col items-center justify-center gap-3 py-8">
                <span>当前筛选没有匹配任务。</span>
                <Button size="sm" variant="outline" onClick={resetFilters}>重置筛选</Button>
              </EmptyState>
            ) : filteredTasks.map((task) => {
              const expanded = expandedId === task.id;
              const logs = logsByTask[task.id] ?? [];
              const logQuery = logQueryByTask[task.id] ?? '';
              const filteredLogs = logs.filter((log) => matchesLogQuery(log, logQuery));
              const timing = taskTiming(task);
              return (
              <SoftRow ref={(node) => { rowRefs.current[task.id] = node; }} key={task.id} className={cn(expanded && 'border-[rgb(var(--accent-rgb)/0.32)] bg-[rgb(var(--accent-rgb)/0.08)]', focusTaskId === task.id && 'ring-2 ring-[rgb(var(--accent-rgb)/0.42)]')}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-sm font-medium text-slate-100">{taskLabel(task.taskType)}</div>
                      <Badge className={taskStatusClass(task.status)}>{taskStatusLabel(task.status)}</Badge>
                      <span className="text-xs text-slate-500">{Math.round(boundedProgress(task.progress) * 100)}%</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{task.message || '无消息'} · 更新 {formatDateTime(task.updatedAt)}</div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span>开始 {formatDateTime(task.createdAt)}</span>
                      <span>{timing.elapsedLabel}</span>
                      {timing.remainingLabel && <span title="根据已运行时间和当前进度估算">{timing.remainingLabel}</span>}
                    </div>
                    {task.error && <div className="mt-2 text-xs text-rose-200">{task.error}</div>}
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/20">
                      <div className="h-full rounded-full bg-[rgb(var(--accent-rgb))]" style={{ width: `${Math.round(boundedProgress(task.progress) * 100)}%` }} />
                    </div>
                    {expanded && (
                      <div className="mt-3 rounded-md border border-white/10 bg-black/15 p-3">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-medium text-slate-300"><FileText className="h-3.5 w-3.5 text-[rgb(var(--accent-rgb))]" />任务日志</div>
                          <div className="flex min-w-[14rem] flex-1 items-center gap-2 sm:flex-initial">
                            <Input aria-label={`日志搜索 ${taskLabel(task.taskType)}`} className="h-8 w-full sm:w-56" placeholder="搜索日志" value={logQuery} onChange={(event) => setLogQueryByTask((current) => ({ ...current, [task.id]: event.target.value }))} />
                            <Button className="h-8 px-2" disabled={!logQuery.trim()} size="sm" variant="ghost" onClick={() => setLogQueryByTask((current) => ({ ...current, [task.id]: '' }))}>清空</Button>
                          </div>
                        </div>
                        {logs.length === 0 ? (
                          <div className="text-xs text-slate-500">暂无日志。</div>
                        ) : filteredLogs.length === 0 ? (
                          <div className="rounded-md border border-white/10 bg-black/10 px-3 py-2 text-xs text-slate-500">当前日志筛选无结果。</div>
                        ) : (
                          <div className="space-y-2">
                            {filteredLogs.map((log) => (
                              <div key={log.id} className="grid gap-1 text-xs sm:grid-cols-[6.5rem_4rem_1fr]">
                                <span className="text-slate-500">{formatDateTime(log.createdAt)}</span>
                                <span className={cn('font-medium', log.level === 'error' ? 'text-rose-200' : log.level === 'warn' ? 'text-amber-200' : 'text-slate-400')}>{levelLabel(log.level)}</span>
                                <span className="text-slate-300">{log.message}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => void toggleExpanded(task.id)}><ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />日志</Button>
                    <Button disabled={!task.retryable || (task.status !== 'failed' && task.status !== 'cancelled')} size="sm" variant="outline" onClick={() => void retry(task.id)}><RotateCcw className="h-4 w-4" />重试</Button>
                    <Button disabled={task.status !== 'running' && task.status !== 'pending'} size="sm" variant="outline" onClick={() => void cancel(task.id)}><StopCircle className="h-4 w-4" />取消</Button>
                  </div>
                </div>
              </SoftRow>
              );
            })}
          </PanelContent>
        </Panel>
      </PageFrame>
    </PageShell>
  );
}

function levelLabel(level: string) {
  const labels: Record<string, string> = {
    debug: '调试',
    info: '信息',
    warn: '警告',
    error: '错误',
  };
  return labels[level] ?? level;
}

function isActiveTask(task: TaskRecord) {
  return task.status === 'running' || task.status === 'pending';
}

function needsAttentionTask(task: TaskRecord) {
  return task.status === 'failed' || task.status === 'cancelled';
}

function matchesTaskQuery(task: TaskRecord, query: string) {
  const value = query.trim().toLocaleLowerCase();
  if (!value) return true;
  return [
    task.id,
    task.taskType,
    taskLabel(task.taskType),
    taskStatusLabel(task.status),
    task.message,
    task.error,
    task.createdAt,
    task.updatedAt,
  ].some((item) => (item ?? '').toLocaleLowerCase().includes(value));
}

function matchesLogQuery(log: TaskLogEntry, query: string) {
  const value = query.trim().toLocaleLowerCase();
  if (!value) return true;
  return [
    log.level,
    levelLabel(log.level),
    log.message,
    log.createdAt,
  ].some((item) => item.toLocaleLowerCase().includes(value));
}

function boundedProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function taskTiming(task: TaskRecord) {
  const startedAt = new Date(task.createdAt).getTime();
  const updatedAt = new Date(task.updatedAt).getTime();
  const now = Date.now();
  const reference = isActiveTask(task) ? now : updatedAt;
  const elapsedSeconds = Number.isFinite(startedAt) && Number.isFinite(reference) && reference > startedAt ? Math.max(0, Math.round((reference - startedAt) / 1000)) : 0;
  const progress = boundedProgress(task.progress);
  const remainingSeconds = isActiveTask(task) && progress > 0.02 && progress < 0.995
    ? Math.max(0, Math.round((elapsedSeconds / progress) - elapsedSeconds))
    : null;
  return {
    elapsedLabel: `${isActiveTask(task) ? '已运行' : '耗时'} ${formatDuration(elapsedSeconds)}`,
    remainingLabel: remainingSeconds == null ? null : `预计剩余 ${formatDuration(remainingSeconds)}`,
  };
}

function formatDuration(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '不足 1 分钟';
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return hours > 0 ? `${days} 天 ${hours} 小时` : `${days} 天`;
  if (hours > 0) return minutes > 0 ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`;
  return `${Math.max(1, minutes)} 分钟`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}
