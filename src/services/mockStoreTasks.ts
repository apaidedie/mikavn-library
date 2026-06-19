import type { TaskDetail, TaskLogEntry, TaskRecord } from '@/types/task';
import { TASKS_KEY, TASK_LOGS_KEY, readJson, writeJson } from './mockStoreStorage';

export function readTasks() {
  return readJson<TaskRecord[]>(TASKS_KEY, []);
}

export function writeTasks(tasks: TaskRecord[]) {
  writeJson(TASKS_KEY, tasks);
}

export function addTaskLog(taskId: string, level: TaskLogEntry['level'], message: string) {
  const logs = readJson<Record<string, TaskLogEntry[]>>(TASK_LOGS_KEY, {});
  const entry: TaskLogEntry = {
    id: crypto.randomUUID(),
    taskId,
    level,
    message,
    createdAt: new Date().toISOString(),
  };
  writeJson(TASK_LOGS_KEY, { ...logs, [taskId]: [...(logs[taskId] ?? []), entry] });
  return entry;
}

export function readTaskLogs(taskId: string) {
  return readJson<Record<string, TaskLogEntry[]>>(TASK_LOGS_KEY, {})[taskId] ?? [];
}

function recordTask(task: TaskRecord, logs: string[] = []) {
  writeTasks([task, ...readTasks().filter((item) => item.id !== task.id)].slice(0, 100));
  for (const log of logs) addTaskLog(task.id, task.status === 'failed' ? 'error' : 'info', log);
  return task;
}

export function makeTask(input: {
  taskType: string;
  status?: TaskRecord['status'];
  progress?: number;
  message?: string | null;
  error?: string | null;
  retryPayload?: string | null;
  retryable?: boolean;
}) {
  const now = new Date().toISOString();
  return recordTask({
    id: crypto.randomUUID(),
    taskType: input.taskType,
    status: input.status ?? 'completed',
    progress: input.progress ?? 1,
    message: input.message ?? null,
    error: input.error ?? null,
    retryPayload: input.retryPayload ?? null,
    retryable: input.retryable ?? false,
    createdAt: now,
    updatedAt: now,
  }, [input.message ?? '任务已记录'].filter(Boolean) as string[]);
}

export function reportGapSummaryLog(content: string) {
  const countFor = (label: string) => {
    const match = content.match(new RegExp(`^- ${label}:\\s*(\\d+)`, 'm'));
    return match?.[1] ?? '0';
  };
  return `报告缺口摘要：缺封面 ${countFor('缺封面')}，缺简介图片 ${countFor('缺简介图片')}，缺外部 ID ${countFor('缺外部 ID')}，路径异常 ${countFor('路径异常')}`;
}

export function reportGapExamplesLog(content: string) {
  const exampleFor = (label: string) => {
    const match = content.match(new RegExp(`^- ${label}:\\s*\\d+\\n\\s+- 样例:\\s*([^\\n]+)`, 'm'));
    return match?.[1]?.trim() || '无';
  };
  return `报告缺口样例：缺封面 ${exampleFor('缺封面')}，缺简介图片 ${exampleFor('缺简介图片')}，缺外部 ID ${exampleFor('缺外部 ID')}，路径异常 ${exampleFor('路径异常')}`;
}

export function createMockStoreTaskQueries() {
  const getTask = (id: string): Promise<TaskRecord> => {
    const task = readTasks().find((item) => item.id === id);
    if (!task) return Promise.reject(new Error('Task not found'));
    return Promise.resolve(task);
  };

  const listTaskLogs = (taskId: string): Promise<TaskLogEntry[]> => Promise.resolve(readTaskLogs(taskId));

  return {
    listTasks(limit = 50): Promise<TaskRecord[]> {
      return Promise.resolve(readTasks().slice(0, Math.max(1, Math.min(limit, 200))));
    },

    getTask,

    listTaskLogs,

    async getTaskDetail(id: string): Promise<TaskDetail> {
      return { task: await getTask(id), logs: await listTaskLogs(id) };
    },

    cancelTask(id: string): Promise<TaskRecord> {
      const tasks = readTasks();
      const task = tasks.find((item) => item.id === id);
      if (!task) return Promise.reject(new Error('Task not found'));
      const next = { ...task, status: 'cancelled' as const, progress: 1, message: '任务已取消', updatedAt: new Date().toISOString() };
      writeTasks([next, ...tasks.filter((item) => item.id !== id)]);
      addTaskLog(id, 'warn', '任务已取消');
      return Promise.resolve(next);
    },
  };
}
