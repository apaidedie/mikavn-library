import type { ScanCandidate } from '@/types/game';

export type TaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | string;

export type TaskRecord = {
  id: string;
  taskType: string;
  status: TaskStatus;
  progress: number;
  message?: string | null;
  error?: string | null;
  retryPayload?: string | null;
  retryable?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TaskLogEntry = {
  id: string;
  taskId: string;
  level: 'debug' | 'info' | 'warn' | 'error' | string;
  message: string;
  createdAt: string;
};

export type TaskDetail = {
  task: TaskRecord;
  logs: TaskLogEntry[];
};

export type ScanTaskStatus = {
  task: TaskRecord;
  path?: string | null;
  recursive?: boolean | null;
  candidates: ScanCandidate[];
};
