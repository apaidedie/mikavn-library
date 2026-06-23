import type { TaskDetail, TaskLogEntry, TaskRecord } from '@/types/task';
import { TASKS_KEY, TASK_LOGS_KEY, TASK_RETRY_PAYLOADS_KEY, readJson, writeJson } from './mockStoreStorage';

export function readTasks() {
  const stored = readJson<StoredTaskRecord[]>(TASKS_KEY, []);
  const retryPayloads = readTaskRetryPayloads();
  let migrated = false;
  const tasks = stored.map((task) => {
    const { retryPayload, ...publicTask } = task;
    if (retryPayload) {
      retryPayloads[task.id] = retryPayload;
      migrated = true;
    }
    return publicTask;
  });
  if (migrated) {
    writeJson(TASK_RETRY_PAYLOADS_KEY, retryPayloads);
    writeJson(TASKS_KEY, tasks);
  }
  return tasks;
}

export function writeTasks(tasks: StoredTaskRecord[]) {
  const retryPayloads = readTaskRetryPayloads();
  const publicTasks = tasks.map((task) => {
    const { retryPayload, ...publicTask } = task;
    if (retryPayload) retryPayloads[task.id] = retryPayload;
    return publicTask;
  });
  const activeTaskIds = new Set(publicTasks.map((task) => task.id));
  for (const taskId of Object.keys(retryPayloads)) {
    if (!activeTaskIds.has(taskId)) delete retryPayloads[taskId];
  }
  writeJson(TASK_RETRY_PAYLOADS_KEY, retryPayloads);
  writeJson(TASKS_KEY, publicTasks);
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

type StoredTaskRecord = TaskRecord & { retryPayload?: string | null };

export function readTaskRetryPayload(taskId: string) {
  return readTaskRetryPayloads()[taskId] ?? null;
}

function readTaskRetryPayloads() {
  return readJson<Record<string, string>>(TASK_RETRY_PAYLOADS_KEY, {});
}

function writeTaskRetryPayload(taskId: string, retryPayload?: string | null) {
  const retryPayloads = readTaskRetryPayloads();
  if (retryPayload?.trim()) {
    retryPayloads[taskId] = retryPayload;
  } else {
    delete retryPayloads[taskId];
  }
  writeJson(TASK_RETRY_PAYLOADS_KEY, retryPayloads);
}

function recordTask(task: TaskRecord, logs: string[] = [], retryPayload?: string | null) {
  writeTasks([task, ...readTasks().filter((item) => item.id !== task.id)].slice(0, 100));
  writeTaskRetryPayload(task.id, retryPayload);
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
    retryable: input.retryable ?? false,
    createdAt: now,
    updatedAt: now,
  }, [input.message ?? '任务已记录'].filter(Boolean) as string[], input.retryPayload);
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
