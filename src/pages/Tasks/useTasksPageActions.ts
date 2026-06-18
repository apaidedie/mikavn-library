import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { api } from '@/services/api';
import type { TaskFilterPreset, TaskLogEntry, TaskRecord, TaskStatus } from '@/types/task';
import { errorMessage } from '@/utils/errorMessage';
import { taskLabel } from '@/utils/taskLabels';
import { formatDateTime } from '@/utils/time';
import { buildTaskDiagnosticMarkdown } from './taskDiagnostics';
import { filterTasks, levelLabel } from './taskPageModel';

type UseTasksPageActionsOptions = {
  filterPreset?: (TaskFilterPreset & { key: number }) | null;
  focusRequestKey?: number;
  focusTaskId?: string | null;
  refreshKey: number;
};

export function useTasksPageActions({ filterPreset, focusRequestKey = 0, focusTaskId, refreshKey }: UseTasksPageActionsOptions) {
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

  const resetFilters = useCallback(() => {
    setStatusFilter('all');
    setTypeFilter('all');
    setTaskQuery('');
  }, []);

  const applyStatusShortcut = useCallback((status: TaskStatus | 'all' | 'active' | 'attention') => {
    setStatusFilter(status);
    setTaskQuery('');
  }, []);

  const applyTypeShortcut = useCallback((taskType: string) => {
    setTypeFilter(taskType);
    setTaskQuery('');
  }, []);

  const loadLogs = useCallback(async (id: string) => {
    try {
      const logs = await api.listTaskLogs(id);
      setLogsByTask((current) => ({ ...current, [id]: logs }));
      setError(null);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }, []);

  const loadTasks = useCallback(async (options?: { quiet?: boolean }) => {
    if (!options?.quiet) setLoading(true);
    try {
      const nextTasks = await api.listTasks(100);
      setTasks(nextTasks);
      const currentExpandedId = expandedIdRef.current;
      if (currentExpandedId && nextTasks.some((task) => task.id === currentExpandedId)) {
        await loadLogs(currentExpandedId);
      }
      setError(null);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      if (!options?.quiet) setLoading(false);
    }
  }, [loadLogs]);

  const focusTask = useCallback(async (id: string) => {
    setExpandedId(id);
    await loadLogs(id);
    window.requestAnimationFrame(() => {
      rowRefs.current[id]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }, [loadLogs]);

  const openResultLogs = useCallback(async (id: string) => {
    resetFilters();
    setExpandedId(id);
    await loadLogs(id);
    window.setTimeout(() => {
      rowRefs.current[id]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 0);
  }, [loadLogs, resetFilters]);

  const toggleExpanded = useCallback(async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    await loadLogs(id);
  }, [expandedId, loadLogs]);

  const cancel = useCallback(async (id: string) => {
    try {
      const task = await api.cancelTask(id);
      setMessage(`已取消任务：${taskLabel(task.taskType)}。`);
      setExpandedId(task.id);
      await loadTasks({ quiet: true });
      await loadLogs(task.id);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }, [loadLogs, loadTasks]);

  const retry = useCallback(async (id: string) => {
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
  }, [loadLogs, loadTasks]);

  const copyTaskLog = useCallback(async (log: TaskLogEntry) => {
    setError(null);
    try {
      await navigator.clipboard.writeText(`${formatDateTime(log.createdAt)} ${levelLabel(log.level)} ${log.message}`);
      setMessage('已复制任务日志。');
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }, []);

  const copyTaskDiagnostic = useCallback(async (task: TaskRecord) => {
    setError(null);
    try {
      const logs = logsByTask[task.id] ?? await api.listTaskLogs(task.id);
      setLogsByTask((current) => ({ ...current, [task.id]: logs }));
      await navigator.clipboard.writeText(buildTaskDiagnosticMarkdown(task, logs));
      setMessage('已复制任务诊断摘要。');
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }, [logsByTask]);

  const setRowRef = useCallback((taskId: string, node: HTMLDivElement | null) => {
    rowRefs.current[taskId] = node;
  }, []);

  const setLogQuery = useCallback((taskId: string, value: string) => {
    setLogQueryByTask((current) => ({ ...current, [taskId]: value }));
  }, []);

  useEffect(() => {
    expandedIdRef.current = expandedId;
  }, [expandedId]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks, refreshKey]);

  useEffect(() => {
    if (!tasks.some((task) => task.status === 'running' || task.status === 'pending')) return;
    const timer = window.setInterval(() => void loadTasks({ quiet: true }), 1200);
    return () => window.clearInterval(timer);
  }, [loadTasks, tasks]);

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
  }, [loadLogs]);

  useEffect(() => {
    if (!focusTaskId || handledFocusKeyRef.current === focusRequestKey || !tasks.some((task) => task.id === focusTaskId)) return;
    handledFocusKeyRef.current = focusRequestKey;
    void focusTask(focusTaskId);
  }, [focusRequestKey, focusTask, focusTaskId, tasks]);

  useEffect(() => {
    if (!filterPreset?.key) return;
    setStatusFilter(filterPreset.statusFilter ?? 'all');
    setTypeFilter(filterPreset.typeFilter ?? 'all');
    setTaskQuery(filterPreset.query ?? '');
  }, [filterPreset?.key, filterPreset?.query, filterPreset?.statusFilter, filterPreset?.typeFilter]);

  return {
    applyStatusShortcut,
    applyTypeShortcut,
    cancel,
    copyTaskDiagnostic,
    copyTaskLog,
    error,
    expandedId,
    filteredTasks,
    loading,
    logsByTask,
    logQueryByTask,
    message,
    openResultLogs,
    retry,
    resetFilters,
    setLogQuery,
    setRowRef,
    setStatusFilter,
    setTaskQuery,
    setTypeFilter,
    statusFilter,
    taskQuery,
    tasks,
    toggleExpanded,
    typeFilter,
    loadTasks,
  };
}
