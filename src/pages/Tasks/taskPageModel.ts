import type { TaskLogEntry, TaskRecord } from '@/types/task';
import { taskLabel, taskStatusLabel } from '@/utils/taskLabels';

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
