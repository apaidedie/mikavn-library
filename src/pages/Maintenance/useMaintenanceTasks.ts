import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/services/api';
import type { TaskRecord } from '@/types/task';
import { errorMessage } from '@/utils/errorMessage';
import { taskLabel } from '@/utils/taskLabels';
import { isActiveTask, isMaintenanceTask, matchesMaintenanceTaskFilter, summarizeMaintenanceTasks, type MaintenanceTaskFilter } from './MaintenancePageParts';

type TaskMessage = { text: string; taskId?: string | null };

type UseMaintenanceTasksOptions = {
  onTaskRetried?: (task: TaskRecord) => Promise<void> | void;
  setError: (message: string | null) => void;
  setMessage: (message: TaskMessage | null) => void;
};

export function useMaintenanceTasks({ onTaskRetried, setError, setMessage }: UseMaintenanceTasksOptions) {
  const [maintenanceTasks, setMaintenanceTasks] = useState<TaskRecord[]>([]);
  const [maintenanceTasksLoading, setMaintenanceTasksLoading] = useState(false);
  const [maintenanceTaskActionId, setMaintenanceTaskActionId] = useState<string | null>(null);
  const [maintenanceTaskFilter, setMaintenanceTaskFilter] = useState<MaintenanceTaskFilter>('all');

  const loadMaintenanceTasks = useCallback(async (options?: { quiet?: boolean }) => {
    if (!options?.quiet) setMaintenanceTasksLoading(true);
    try {
      const tasks = (await api.listTasks(100)).filter(isMaintenanceTask).slice(0, 8);
      setMaintenanceTasks(tasks);
    } catch (reason) {
      if (!options?.quiet) setError(errorMessage(reason));
    } finally {
      if (!options?.quiet) setMaintenanceTasksLoading(false);
    }
  }, [setError]);

  useEffect(() => {
    if (!maintenanceTasks.some(isActiveTask)) return;
    const timer = window.setInterval(() => void loadMaintenanceTasks({ quiet: true }), 2000);
    return () => window.clearInterval(timer);
  }, [loadMaintenanceTasks, maintenanceTasks]);

  const retryMaintenanceTask = useCallback(async (id: string) => {
    setMaintenanceTaskActionId(id);
    setError(null);
    try {
      const task = await api.retryTask(id);
      setMessage({ text: `已重新创建维护任务：${taskLabel(task.taskType)}。`, taskId: task.id });
      await loadMaintenanceTasks({ quiet: true });
      await onTaskRetried?.(task);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setMaintenanceTaskActionId(null);
    }
  }, [loadMaintenanceTasks, onTaskRetried, setError, setMessage]);

  const cancelMaintenanceTask = useCallback(async (id: string) => {
    setMaintenanceTaskActionId(id);
    setError(null);
    try {
      const task = await api.cancelTask(id);
      setMessage({ text: `已取消维护任务：${taskLabel(task.taskType)}。`, taskId: task.id });
      await loadMaintenanceTasks({ quiet: true });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setMaintenanceTaskActionId(null);
    }
  }, [loadMaintenanceTasks, setError, setMessage]);

  const maintenanceTaskSummary = useMemo(() => summarizeMaintenanceTasks(maintenanceTasks), [maintenanceTasks]);
  const maintenanceTaskShortcuts = useMemo(() => [
    { id: 'all', label: '全部', count: maintenanceTasks.length },
    { id: 'active', label: '进行中', count: maintenanceTaskSummary.activeCount },
    { id: 'attention', label: '需处理', count: maintenanceTaskSummary.attentionCount },
    { id: 'completed', label: '已完成', count: maintenanceTaskSummary.completedCount },
  ] as const, [maintenanceTaskSummary, maintenanceTasks.length]);
  const filteredMaintenanceTasks = useMemo(() => maintenanceTasks.filter((task) => matchesMaintenanceTaskFilter(task, maintenanceTaskFilter)), [maintenanceTaskFilter, maintenanceTasks]);

  return {
    cancelMaintenanceTask,
    filteredMaintenanceTasks,
    loadMaintenanceTasks,
    maintenanceTaskActionId,
    maintenanceTaskFilter,
    maintenanceTaskShortcuts,
    maintenanceTaskSummary,
    maintenanceTasks,
    maintenanceTasksLoading,
    retryMaintenanceTask,
    setMaintenanceTaskFilter,
  };
}
