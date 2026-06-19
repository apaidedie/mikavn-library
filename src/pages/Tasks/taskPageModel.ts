import type { TaskLogEntry, TaskRecord } from '@/types/task';
import { taskLabel, taskStatusLabel } from '@/utils/taskLabels';

export type TaskStatusShortcut = {
  id: 'all' | 'active' | 'attention' | 'completed';
  label: string;
  count: number;
};

export type TaskTypeShortcut = {
  id: string;
  label: string;
  count: number;
};

export type TaskPageSummary = {
  activeCount: number;
  attentionCount: number;
  completedCount: number;
  queueProgress: number;
  statusShortcuts: TaskStatusShortcut[];
};

export type TaskFilterInput = {
  statusFilter: string;
  typeFilter: string;
  query: string;
};

export function levelLabel(level: string) {
  const labels: Record<string, string> = {
    debug: '调试',
    info: '信息',
    warn: '警告',
    error: '错误',
  };
  return labels[level] ?? level;
}

export function isActiveTask(task: TaskRecord) {
  return task.status === 'running' || task.status === 'pending';
}

export function needsAttentionTask(task: TaskRecord) {
  return task.status === 'failed' || task.status === 'cancelled';
}

export function isResultTask(task: TaskRecord) {
  return task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled';
}

export function canRetryTask(task: TaskRecord) {
  return Boolean(task.retryable) && (task.status === 'failed' || task.status === 'cancelled');
}

export function deriveTaskPageSummary(tasks: TaskRecord[]): TaskPageSummary {
  const activeCount = tasks.filter(isActiveTask).length;
  const attentionCount = tasks.filter(needsAttentionTask).length;
  const completedCount = tasks.filter((task) => task.status === 'completed').length;
  const queueProgress = tasks.length === 0 ? 0 : Math.round((tasks.reduce((sum, task) => sum + boundedProgress(task.progress), 0) / tasks.length) * 100);

  return {
    activeCount,
    attentionCount,
    completedCount,
    queueProgress,
    statusShortcuts: [
      { id: 'all', label: '全部', count: tasks.length },
      { id: 'active', label: '进行中', count: activeCount },
      { id: 'attention', label: '需处理', count: attentionCount },
      { id: 'completed', label: '已完成', count: completedCount },
    ],
  };
}

export function deriveTaskTypeShortcuts(tasks: TaskRecord[]): TaskTypeShortcut[] {
  const taskTypes = [...new Set(tasks.map((task) => task.taskType))].sort((a, b) => taskLabel(a).localeCompare(taskLabel(b), 'zh-CN'));
  return [
    { id: 'all', label: '全部类型', count: tasks.length },
    ...taskTypes.map((taskType) => ({
      id: taskType,
      label: taskLabel(taskType),
      count: tasks.filter((task) => task.taskType === taskType).length,
    })),
  ];
}

export function filterTasks(tasks: TaskRecord[], filters: TaskFilterInput) {
  return tasks.filter((task) => {
    const matchesStatus = filters.statusFilter === 'all'
      || (filters.statusFilter === 'active' && isActiveTask(task))
      || (filters.statusFilter === 'attention' && needsAttentionTask(task))
      || task.status === filters.statusFilter;
    const matchesType = filters.typeFilter === 'all' || task.taskType === filters.typeFilter;
    const matchesQuery = matchesTaskQuery(task, filters.query);
    return matchesStatus && matchesType && matchesQuery;
  });
}

export function deriveRecentResultTasks(tasks: TaskRecord[], limit = 3) {
  return [...tasks]
    .filter(isResultTask)
    .sort((a, b) => dateMillis(b.updatedAt) - dateMillis(a.updatedAt))
    .slice(0, limit);
}

export function matchesTaskQuery(task: TaskRecord, query: string) {
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

export function matchesLogQuery(log: TaskLogEntry, query: string) {
  const value = query.trim().toLocaleLowerCase();
  if (!value) return true;
  return [
    log.level,
    levelLabel(log.level),
    log.message,
    log.createdAt,
  ].some((item) => item.toLocaleLowerCase().includes(value));
}

export function boundedProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function formatTaskProgressPercent(value: number) {
  return `${Math.round(boundedProgress(value) * 100)}%`;
}

export function dateMillis(value: string) {
  const millis = new Date(value).getTime();
  return Number.isFinite(millis) ? millis : 0;
}

export function taskTiming(task: TaskRecord) {
  const startedAt = new Date(task.createdAt).getTime();
  const updatedAt = new Date(task.updatedAt).getTime();
  const now = Date.now();
  const reference = isActiveTask(task) ? now : updatedAt;
  const elapsedSeconds = Number.isFinite(startedAt) && Number.isFinite(reference) && reference > startedAt
    ? Math.max(0, Math.round((reference - startedAt) / 1000))
    : 0;
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

export function formatCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}
