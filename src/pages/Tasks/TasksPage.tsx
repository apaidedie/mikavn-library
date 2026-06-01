import { Activity, ChevronDown, FileText, RefreshCw, RotateCcw, StopCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, Notice } from '@/components/ui/notice';
import { PageFrame, PageHeader, PageShell, Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import { api } from '@/services/api';
import type { TaskLogEntry, TaskRecord } from '@/types/task';
import { cn } from '@/utils/cn';
import { errorMessage } from '@/utils/errorMessage';
import { taskLabel, taskStatusClass, taskStatusLabel } from '@/utils/taskLabels';
import { formatDateTime } from '@/utils/time';

export function TasksPage({ refreshKey, focusTaskId, focusRequestKey = 0 }: { refreshKey: number; focusTaskId?: string | null; focusRequestKey?: number }) {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logsByTask, setLogsByTask] = useState<Record<string, TaskLogEntry[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const handledFocusKeyRef = useRef<number | null>(null);
  const expandedIdRef = useRef<string | null>(null);

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
          <PanelHeader title="任务队列" icon={<Activity className="h-4 w-4" />} />
          <PanelContent className="space-y-2">
            {tasks.length === 0 ? (
              <EmptyState>还没有任务记录。启动批量匹配后会在这里看到任务进度。</EmptyState>
            ) : tasks.map((task) => {
              const expanded = expandedId === task.id;
              const logs = logsByTask[task.id] ?? [];
              return (
              <SoftRow ref={(node) => { rowRefs.current[task.id] = node; }} key={task.id} className={cn(expanded && 'border-[rgb(var(--accent-rgb)/0.32)] bg-[rgb(var(--accent-rgb)/0.08)]', focusTaskId === task.id && 'ring-2 ring-[rgb(var(--accent-rgb)/0.42)]')}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-sm font-medium text-slate-100">{taskLabel(task.taskType)}</div>
                      <Badge className={taskStatusClass(task.status)}>{taskStatusLabel(task.status)}</Badge>
                      <span className="text-xs text-slate-500">{Math.round(task.progress * 100)}%</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{task.message || '无消息'} · {formatDateTime(task.updatedAt)}</div>
                    {task.error && <div className="mt-2 text-xs text-rose-200">{task.error}</div>}
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/20">
                      <div className="h-full rounded-full bg-[rgb(var(--accent-rgb))]" style={{ width: `${Math.round(task.progress * 100)}%` }} />
                    </div>
                    {expanded && (
                      <div className="mt-3 rounded-md border border-white/10 bg-black/15 p-3">
                        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-300"><FileText className="h-3.5 w-3.5 text-[rgb(var(--accent-rgb))]" />任务日志</div>
                        {logs.length === 0 ? (
                          <div className="text-xs text-slate-500">暂无日志。</div>
                        ) : (
                          <div className="space-y-2">
                            {logs.map((log) => (
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
