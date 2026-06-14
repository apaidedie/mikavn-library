import type { TaskLogEntry, TaskRecord } from '@/types/task';
import { taskLabel, taskStatusLabel } from '@/utils/taskLabels';
import { formatDateTime } from '@/utils/time';

export function buildTaskDiagnosticMarkdown(task: TaskRecord, logs: TaskLogEntry[] = []) {
  const lines = [
    '# MikaVN Task Diagnostic',
    '',
    `- ID: ${task.id}`,
    `- Type: ${taskLabel(task.taskType)} (${task.taskType})`,
    `- Status: ${taskStatusLabel(task.status)} (${task.status})`,
    `- Progress: ${Math.round(boundedProgress(task.progress) * 100)}%`,
    `- Created: ${formatDateTime(task.createdAt)}`,
    `- Updated: ${formatDateTime(task.updatedAt)}`,
  ];
  if (task.message) lines.push(`- Message: ${task.message}`);
  if (task.error) lines.push(`- Error: ${task.error}`);

  const suggestions = taskDiagnosticSuggestions(task, logs);
  if (suggestions.length > 0) {
    lines.push('', '## Suggested Next Actions', ...suggestions.map((item) => `- ${item}`));
  }

  if (logs.length > 0) {
    lines.push('', '## Recent Logs');
    for (const log of logs.slice(-20)) {
      lines.push(`- ${formatDateTime(log.createdAt)} [${log.level}] ${log.message}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

export function taskDiagnosticSuggestions(task: TaskRecord, logs: TaskLogEntry[] = []) {
  const text = [task.taskType, task.status, task.message, task.error, ...logs.map((log) => log.message)]
    .filter(Boolean)
    .join('\n')
    .toLocaleLowerCase();
  const suggestions: string[] = [];
  if (task.status === 'failed' || task.status === 'cancelled') {
    suggestions.push('检查任务错误和最近日志；如果任务可重试，先确认路径和权限后再重试。');
  }
  if (task.taskType.includes('scan')) {
    suggestions.push('确认扫描目录仍存在、可读取，并检查冲突候选是否需要合并、替换或副本导入。');
  }
  if (task.taskType.includes('archive_import') || text.includes('跳过')) {
    suggestions.push('查看归档导入冲突日志；如只想补缺失条目，保留跳过项并重新导入缺失标题。');
  }
  if (task.taskType.includes('save.restore')) {
    suggestions.push('启动游戏确认存档可用；确认正常前保留恢复前保护备份。');
  }
  if (suggestions.length === 0) {
    suggestions.push('复制此摘要后，可在设置页查看本地诊断日志以继续排查。');
  }
  return [...new Set(suggestions)];
}

function boundedProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
