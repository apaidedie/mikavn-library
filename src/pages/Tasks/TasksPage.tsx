import { RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { PageFrame, PageHeader, PageShell } from '@/components/ui/page';
import { api } from '@/services/api';
import type { TaskFilterPreset, TaskLogEntry, TaskRecord, TaskStatus } from '@/types/task';
import { errorMessage } from '@/utils/errorMessage';
import { taskLabel } from '@/utils/taskLabels';
import { formatDateTime } from '@/utils/time';
import { buildTaskDiagnosticMarkdown } from './taskDiagnostics';
import { TaskOverviewPanel } from './TaskOverviewPanel';
import { TaskQueuePanel } from './TaskQueuePanel';
import {
  filterTasks,
  levelLabel,
} from './taskPageModel';

export function TasksPage({ refreshKey, focusTaskId, focusRequestKey = 0, filterPreset }: { refreshKey: number; focusTaskId?: string | null; focusRequestKey?: number; filterPreset?: (TaskFilterPreset & { key: number }) | null }) {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logsByTask, setLogsByTask] = useState<Record<string, TaskLogEntry[]>>({});
  const [logQueryByTask, setLogQueryByTask] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [taskQuery, setTaskQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const handledFocusKeyRef = useRef<number | null>(null);
  const expandedIdRef = useRef<string | null>(null);

  const filteredTasks = useMemo(() => filterTasks(tasks, { statusFilter, typeFilter, query: taskQuery }), [statusFilter, taskQuery, tasks, typeFilter]);
  const resetFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setTaskQuery('');
  };
  const applyStatusShortcut = (status: TaskStatus | 'all' | 'active' | 'attention') => {
    setStatusFilter(status);
    setTaskQuery('');
  };
  const applyTypeShortcut = (taskType: string) => {
    setTypeFilter(taskType);
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

  useEffect(() => {
    if (!filterPreset?.key) return;
    setStatusFilter(filterPreset.statusFilter ?? 'all');
    setTypeFilter(filterPreset.typeFilter ?? 'all');
    setTaskQuery(filterPreset.query ?? '');
  }, [filterPreset?.key]);

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

  async function openResultLogs(id: string) {
    setStatusFilter('all');
    setTypeFilter('all');
    setTaskQuery('');
    setExpandedId(id);
    await loadLogs(id);
    window.setTimeout(() => {
      rowRefs.current[id]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 0);
  }

  async function cancel(id: string) {
    try {
      const task = await api.cancelTask(id);
      setMessage(`已取消任务：${taskLabel(task.taskType)}。`);
      setExpandedId(task.id);
      await loadTasks({ quiet: true });
      await loadLogs(task.id);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function retry(id: string) {
    try {
      const task = await api.retryTask(id);
      setMessage(`已重新创建任务：${taskLabel(task.taskType)}。`);
      setStatusFilter('all');
      setTypeFilter(task.taskType);
      setTaskQuery('');
      setExpandedId(task.id);
      await loadTasks({ quiet: true });
      await loadLogs(task.id);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function copyTaskLog(log: TaskLogEntry) {
    setError(null);
    try {
      await navigator.clipboard.writeText(`${formatDateTime(log.createdAt)} ${levelLabel(log.level)} ${log.message}`);
      setMessage('已复制任务日志。');
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function copyTaskDiagnostic(task: TaskRecord) {
    setError(null);
    try {
      const logs = logsByTask[task.id] ?? await api.listTaskLogs(task.id);
      setLogsByTask((current) => ({ ...current, [task.id]: logs }));
      await navigator.clipboard.writeText(buildTaskDiagnosticMarkdown(task, logs));
      setMessage('已复制任务诊断摘要。');
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
        {message && <Notice>{message}</Notice>}

        <TaskOverviewPanel
          filteredTasks={filteredTasks}
          statusFilter={statusFilter}
          taskQuery={taskQuery}
          tasks={tasks}
          typeFilter={typeFilter}
          onApplyStatusShortcut={applyStatusShortcut}
          onApplyTypeShortcut={applyTypeShortcut}
          onCopyTaskDiagnostic={(task) => void copyTaskDiagnostic(task)}
          onOpenResultLogs={(id) => void openResultLogs(id)}
          onResetFilters={resetFilters}
          onRetry={(id) => void retry(id)}
          onStatusFilterChange={setStatusFilter}
          onTaskQueryChange={setTaskQuery}
          onTypeFilterChange={setTypeFilter}
        />

        <TaskQueuePanel
          expandedId={expandedId}
          filteredTasks={filteredTasks}
          focusTaskId={focusTaskId}
          logsByTask={logsByTask}
          logQueryByTask={logQueryByTask}
          tasks={tasks}
          onCancel={(id) => void cancel(id)}
          onCopyTaskDiagnostic={(task) => void copyTaskDiagnostic(task)}
          onCopyTaskLog={(log) => void copyTaskLog(log)}
          onLogQueryChange={(taskId, value) => setLogQueryByTask((current) => ({ ...current, [taskId]: value }))}
          onResetFilters={resetFilters}
          onRetry={(id) => void retry(id)}
          onRowRef={(taskId, node) => { rowRefs.current[taskId] = node; }}
          onToggleExpanded={(id) => void toggleExpanded(id)}
        />
      </PageFrame>
    </PageShell>
  );
}
