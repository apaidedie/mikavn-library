import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SoftRow } from '@/components/ui/page';
import type { Game } from '@/types/game';
import type { TaskDetail, TaskLogEntry, TaskRecord } from '@/types/task';
import { taskLabel, taskStatusClass, taskStatusLabel } from '@/utils/taskLabels';
import { formatDateTime } from '@/utils/time';

export type DescriptionImageRepairLogStatus = 'updated' | 'skipped' | 'failed';
export type DescriptionImageRepairLogSummary = {
  status: DescriptionImageRepairLogStatus;
  provider: string;
  providerId: string;
  title: string;
  gameId?: string | null;
  message: string;
  imageCount?: number | null;
};
export type DescriptionImageRepairTaskSummary = {
  task: TaskRecord;
  updated: DescriptionImageRepairLogSummary[];
  skipped: DescriptionImageRepairLogSummary[];
  failed: DescriptionImageRepairLogSummary[];
};

export function DescriptionImageRepairTaskRow({ actionBusy = false, summary, onOpenGame, onOpenTask, onRetryTask }: { actionBusy?: boolean; summary: DescriptionImageRepairTaskSummary; onOpenGame?: (gameId: string) => void; onOpenTask?: (taskId?: string | null) => void; onRetryTask?: (taskId: string) => void }) {
  const task = summary.task;
  const canRetry = Boolean(task.retryable) && needsAttentionTask(task);
  const detailItems = [...summary.failed, ...summary.skipped, ...summary.updated].slice(0, 8);
  const hiddenCount = summary.updated.length + summary.skipped.length + summary.failed.length - detailItems.length;

  return (
    <SoftRow className="space-y-3 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-100">{task.message || '简介图片修复任务'}</span>
            <Badge className={taskStatusClass(task.status)}>{taskStatusLabel(task.status)}</Badge>
            {task.retryable && <Badge className="border-sky-300/25 bg-sky-300/10 text-sky-100">可重试</Badge>}
          </div>
          <div className="mt-1 text-xs text-slate-500">更新于 {formatDateTime(task.updatedAt)}</div>
          {task.error && <div className="mt-2 break-all text-xs text-rose-200">{task.error}</div>}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {onOpenTask && <Button size="sm" variant="ghost" onClick={() => onOpenTask(task.id)}>日志</Button>}
          {onRetryTask && canRetry && <Button disabled={actionBusy} size="sm" variant="outline" onClick={() => onRetryTask(task.id)}>{actionBusy ? '重试中' : '重试'}</Button>}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <DescriptionCompactStat label="已修复" value={summary.updated.length} tone={summary.updated.length > 0 ? 'ok' : 'neutral'} />
        <DescriptionCompactStat label="跳过" value={summary.skipped.length} tone={summary.skipped.length > 0 ? 'warn' : 'ok'} />
        <DescriptionCompactStat label="失败" value={summary.failed.length} tone={summary.failed.length > 0 ? 'warn' : 'ok'} />
      </div>
      {detailItems.length > 0 ? (
        <div className="space-y-2">
          {detailItems.map((item, index) => <DescriptionImageRepairLogRow item={item} key={`${item.status}-${item.provider}-${item.providerId}-${index}`} onOpenGame={onOpenGame} />)}
          {hiddenCount > 0 && <div className="px-1 text-xs text-slate-500">还有 {formatCount(hiddenCount)} 条明细，可打开日志查看完整记录。</div>}
        </div>
      ) : (
        <div className="text-xs text-slate-500">这条任务没有可解析的简介图片修复明细。</div>
      )}
    </SoftRow>
  );
}

export function summarizeDescriptionImageRepairTask(detail: TaskDetail, games: Game[] = []): DescriptionImageRepairTaskSummary {
  const index = buildDescriptionSourceIndex(games);
  const items = detail.logs
    .flatMap((log) => parseDescriptionImageRepairLog(log, index))
    .filter((item): item is DescriptionImageRepairLogSummary => Boolean(item));
  const fallbackItems = items.length === 0 ? descriptionImageRepairTaskFallback(detail.task, detail.logs, index) : [];
  const allItems = items.length > 0 ? items : fallbackItems;

  return {
    task: detail.task,
    updated: allItems.filter((item) => item.status === 'updated'),
    skipped: allItems.filter((item) => item.status === 'skipped'),
    failed: allItems.filter((item) => item.status === 'failed'),
  };
}

export function descriptionImageRepairLogsNeedSourceLookup(logs: TaskLogEntry[]) {
  const messages = logs.map((log) => log.message.trim()).filter(Boolean);
  if (messages.some(isSelfContainedDescriptionImageRepairLog)) return false;
  return messages.some((message) => isLegacyDescriptionImageRepairLog(message) || /^简介图片修复候选：/.test(message) || /\b(?:dlsite|fanza):[^\s，,。]+/i.test(message));
}

export function filterDescriptionImageRepairSummary(summary: DescriptionImageRepairTaskSummary, query: string, statusFilter: string, providerFilter: string): DescriptionImageRepairTaskSummary {
  return {
    task: summary.task,
    updated: summary.updated.filter((item) => matchesDescriptionImageRepairLog(item, query, statusFilter, providerFilter)),
    skipped: summary.skipped.filter((item) => matchesDescriptionImageRepairLog(item, query, statusFilter, providerFilter)),
    failed: summary.failed.filter((item) => matchesDescriptionImageRepairLog(item, query, statusFilter, providerFilter)),
  };
}

function DescriptionImageRepairLogRow({ item, onOpenGame }: { item: DescriptionImageRepairLogSummary; onOpenGame?: (gameId: string) => void }) {
  return (
    <div className="grid gap-2 rounded-md border border-white/[0.07] bg-black/[0.10] px-3 py-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={descriptionImageLogBadgeClass(item.status)}>{descriptionImageLogStatusLabel(item.status)}</Badge>
          <span className="truncate text-xs font-medium text-slate-200" title={item.title}>{item.title}</span>
          {item.gameId && onOpenGame && <Button className="h-7 px-2" size="sm" variant="ghost" onClick={() => onOpenGame(item.gameId!)}>游戏</Button>}
        </div>
        {item.gameId && <div className="mt-1 truncate font-mono text-[11px] text-slate-600">{item.gameId}</div>}
      </div>
      <div className="min-w-0 text-xs leading-5 text-slate-500">
        <div className="break-all font-mono text-slate-400">{providerLabel(item.provider)} {item.providerId}</div>
        <span className="break-words">{item.message}</span>
        {typeof item.imageCount === 'number' && <span className="ml-2 whitespace-nowrap text-slate-600">{formatCount(item.imageCount)} 张图片</span>}
      </div>
    </div>
  );
}

function DescriptionCompactStat({ label, value, tone = 'neutral' }: { label: string; value: number | string; tone?: 'neutral' | 'ok' | 'warn' }) {
  const toneClass = tone === 'ok' ? 'text-emerald-200' : tone === 'warn' ? 'text-amber-200' : 'text-slate-200';
  const displayValue = typeof value === 'number' ? formatCount(value) : value;
  return (
    <SoftRow className="px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-sm ${toneClass}`}>{displayValue}</div>
    </SoftRow>
  );
}

function descriptionImageRepairTaskFallback(task: TaskRecord, logs: TaskLogEntry[], sourceIndex: Map<string, Game>): DescriptionImageRepairLogSummary[] {
  if (!needsAttentionTask(task)) return [];
  const pendingItems = descriptionImageRepairPendingLogItems(logs, sourceIndex, task.error || task.message || '任务在生成逐条修复明细前结束。');
  if (pendingItems.length > 0) return pendingItems;
  const payload = parseRetryPayload(task.retryPayload);
  const provider = payload?.provider && String(payload.provider).trim() ? String(payload.provider).trim().toLowerCase() : 'task';
  const providerId = payload?.providerId && String(payload.providerId).trim() ? String(payload.providerId).trim() : task.id;
  return [{
    status: 'failed',
    provider,
    providerId,
    title: taskLabel(task.taskType),
    gameId: null,
    message: task.error || task.message || '任务在生成逐条修复明细前结束。',
    imageCount: null,
  }];
}

function descriptionImageRepairPendingLogItems(logs: TaskLogEntry[], sourceIndex: Map<string, Game>, message: string): DescriptionImageRepairLogSummary[] {
  const seen = new Set<string>();
  return logs.flatMap((log) => [...log.message.matchAll(/\b([a-zA-Z0-9_-]+):([^\s，,。]+)/g)]).map((match) => {
    const provider = match[1].toLowerCase();
    const providerId = match[2];
    const key = `${provider}:${providerId}`;
    if (seen.has(key)) return null;
    seen.add(key);
    return descriptionImageRepairLogItem('failed', provider, providerId, sourceIndex, message);
  }).filter((item): item is DescriptionImageRepairLogSummary => Boolean(item));
}

function parseDescriptionImageRepairLog(log: TaskLogEntry, sourceIndex: Map<string, Game>): DescriptionImageRepairLogSummary[] {
  const message = log.message.trim();

  const updatedWithSource = message.match(/^已修复：(.+) \[([^\]]+)\]，([a-zA-Z0-9_-]+)[:\s]+([^\s，,。]+)，插入\s*(\d+)\s*张图片。?$/);
  if (updatedWithSource) {
    const [, title, gameId, provider, providerId, imageCount] = updatedWithSource;
    return [descriptionImageRepairLogItem('updated', provider, providerId, sourceIndex, `已插入 ${formatCount(Number(imageCount))} 张简介图片。`, Number(imageCount), { title, gameId })];
  }

  const skippedWithSource = message.match(/^跳过：(.+) \[([^\]]+)\]，([a-zA-Z0-9_-]+)[:\s]+([^\s，,。]+)，(.+?)。?$/);
  if (skippedWithSource) {
    const [, title, gameId, provider, providerId, reason] = skippedWithSource;
    return [descriptionImageRepairLogItem('skipped', provider, providerId, sourceIndex, reason.trim(), null, { title, gameId })];
  }

  const failedWithSource = message.match(/^失败：(.+) \[([^\]]+)\]，([a-zA-Z0-9_-]+)[:\s]+([^\s，,。]+)，(.+?)。?$/);
  if (failedWithSource) {
    const [, title, gameId, provider, providerId, reason] = failedWithSource;
    return [descriptionImageRepairLogItem('failed', provider, providerId, sourceIndex, reason.trim(), null, { title, gameId })];
  }

  const updated = message.match(/^已修复：([a-zA-Z0-9_-]+)[:\s]+([^\s，,。]+)，插入\s*(\d+)\s*张图片。?$/);
  if (updated) {
    const [, provider, providerId, imageCount] = updated;
    return [descriptionImageRepairLogItem('updated', provider, providerId, sourceIndex, `已插入 ${formatCount(Number(imageCount))} 张简介图片。`, Number(imageCount))];
  }

  const skipped = message.match(/^跳过：([a-zA-Z0-9_-]+)[:\s]+([^\s，,。]+)，(.+?)。?$/);
  if (skipped) {
    const [, provider, providerId, reason] = skipped;
    return [descriptionImageRepairLogItem('skipped', provider, providerId, sourceIndex, reason.trim())];
  }

  const failed = message.match(/^失败：([a-zA-Z0-9_-]+)[:\s]+([^\s，,。]+)，(.+?)。?$/);
  if (failed) {
    const [, provider, providerId, reason] = failed;
    return [descriptionImageRepairLogItem('failed', provider, providerId, sourceIndex, reason.trim())];
  }

  const candidates = message.match(/^简介图片修复候选：(.+)$/);
  if (candidates) {
    return candidates[1]
      .split(/[，,]/)
      .map((token) => token.trim().match(/^([a-zA-Z0-9_-]+):([^\s，,。]+)$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => descriptionImageRepairLogItem('updated', match[1], match[2], sourceIndex, '浏览器预览已写入简介图片引用。'));
  }

  return [];
}

function descriptionImageRepairLogItem(status: DescriptionImageRepairLogStatus, provider: string, providerId: string, sourceIndex: Map<string, Game>, message: string, imageCount: number | null = null, source?: { title: string; gameId?: string | null }): DescriptionImageRepairLogSummary {
  const normalizedProvider = provider.trim().toLowerCase();
  const normalizedProviderId = providerId.trim();
  const game = sourceIndex.get(descriptionSourceKey(normalizedProvider, normalizedProviderId));
  return {
    status,
    provider: normalizedProvider,
    providerId: normalizedProviderId,
    title: source?.title.trim() || game?.title || `${providerLabel(normalizedProvider)} ${normalizedProviderId}`,
    gameId: source?.gameId?.trim() || game?.id || null,
    message,
    imageCount,
  };
}

function isSelfContainedDescriptionImageRepairLog(message: string) {
  return /^(?:已修复|跳过|失败)：.+ \[[^\]]+\]，[a-zA-Z0-9_-]+[:\s]+[^\s，,。]+，/.test(message);
}

function isLegacyDescriptionImageRepairLog(message: string) {
  return /^(?:已修复|跳过|失败)：[a-zA-Z0-9_-]+[:\s]+[^\s，,。]+，/.test(message);
}

function matchesDescriptionImageRepairLog(item: DescriptionImageRepairLogSummary, query: string, statusFilter: string, providerFilter: string) {
  if (statusFilter !== 'all' && item.status !== statusFilter) return false;
  if (providerFilter !== 'all' && item.provider !== providerFilter) return false;
  const value = query.trim().toLowerCase();
  if (!value) return true;
  return [
    item.status,
    descriptionImageLogStatusLabel(item.status),
    item.title,
    item.gameId,
    item.provider,
    providerLabel(item.provider),
    item.providerId,
    item.message,
  ].some((text) => String(text ?? '').toLowerCase().includes(value));
}

function buildDescriptionSourceIndex(games: Game[]) {
  const index = new Map<string, Game>();
  for (const game of games) {
    if (game.dlsiteId) index.set(descriptionSourceKey('dlsite', game.dlsiteId), game);
    if (game.fanzaId) index.set(descriptionSourceKey('fanza', game.fanzaId), game);
  }
  return index;
}

function descriptionSourceKey(provider: string, providerId: string) {
  return `${provider.trim().toLowerCase()}:${providerId.trim().toLowerCase()}`;
}

function parseRetryPayload(value?: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function needsAttentionTask(task: TaskRecord) {
  return task.status === 'failed' || task.status === 'cancelled';
}

function descriptionImageLogStatusLabel(value: DescriptionImageRepairLogStatus) {
  if (value === 'updated') return '已修复';
  if (value === 'skipped') return '跳过';
  if (value === 'failed') return '失败';
  return value;
}

function descriptionImageLogBadgeClass(value: DescriptionImageRepairLogStatus) {
  if (value === 'updated') return 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100';
  if (value === 'skipped') return 'border-amber-300/25 bg-amber-300/10 text-amber-100';
  if (value === 'failed') return 'border-rose-300/25 bg-rose-300/10 text-rose-100';
  return 'border-white/10 bg-white/[0.045] text-slate-300';
}

function providerLabel(value: string) {
  if (value === 'vndb') return 'VNDB';
  if (value === 'dlsite') return 'DLsite';
  if (value === 'fanza') return 'FANZA';
  return value;
}

function formatCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}
