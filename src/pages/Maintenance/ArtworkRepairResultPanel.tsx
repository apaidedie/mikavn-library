import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SoftRow } from '@/components/ui/page';
import type { TaskDetail, TaskLogEntry, TaskRecord } from '@/types/task';
import { taskLabel, taskStatusClass, taskStatusLabel } from '@/utils/taskLabels';
import { formatDateTime } from '@/utils/time';

export type ArtworkRepairLogStatus = 'updated' | 'skipped' | 'failed';
export type ArtworkRepairLogSummary = {
  status: ArtworkRepairLogStatus;
  title: string;
  gameId?: string | null;
  message: string;
  fields?: string[];
  provider?: string | null;
  providerId?: string | null;
};
export type ArtworkRepairTaskSummary = {
  task: TaskRecord;
  updated: ArtworkRepairLogSummary[];
  skipped: ArtworkRepairLogSummary[];
  failed: ArtworkRepairLogSummary[];
};

export function ArtworkRepairTaskRow({ actionBusy = false, summary, onOpenGame, onOpenTask, onRetryTask }: { actionBusy?: boolean; summary: ArtworkRepairTaskSummary; onOpenGame?: (gameId: string) => void; onOpenTask?: (taskId?: string | null) => void; onRetryTask?: (taskId: string) => void }) {
  const task = summary.task;
  const canRetry = Boolean(task.retryable) && needsAttentionTask(task);
  const detailItems = [...summary.failed, ...summary.skipped, ...summary.updated].slice(0, 8);
  const hiddenCount = summary.updated.length + summary.skipped.length + summary.failed.length - detailItems.length;

  return (
    <SoftRow className="space-y-3 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-100">{task.message || '媒体图片补全任务'}</span>
            <Badge className={taskStatusClass(task.status)}>{taskStatusLabel(task.status)}</Badge>
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
        <ArtworkCompactStat label="已补全" value={summary.updated.length} tone={summary.updated.length > 0 ? 'ok' : 'neutral'} />
        <ArtworkCompactStat label="跳过" value={summary.skipped.length} tone={summary.skipped.length > 0 ? 'warn' : 'ok'} />
        <ArtworkCompactStat label="失败" value={summary.failed.length} tone={summary.failed.length > 0 ? 'warn' : 'ok'} />
      </div>
      {detailItems.length > 0 ? (
        <div className="space-y-2">
          {detailItems.map((item, index) => <ArtworkRepairLogRow item={item} key={`${item.status}-${item.gameId ?? item.title}-${index}`} onOpenGame={onOpenGame} />)}
          {hiddenCount > 0 && <div className="px-1 text-xs text-slate-500">还有 {formatCount(hiddenCount)} 条明细，可打开日志查看完整记录。</div>}
        </div>
      ) : (
        <div className="text-xs text-slate-500">这条任务没有可解析的补图明细。</div>
      )}
    </SoftRow>
  );
}

export function summarizeArtworkRepairTask(detail: TaskDetail): ArtworkRepairTaskSummary {
  const items = detail.logs
    .map(parseArtworkRepairLog)
    .filter((item): item is ArtworkRepairLogSummary => Boolean(item));
  const fallbackItems = items.length === 0 ? artworkRepairTaskFallback(detail.task) : [];
  const allItems = items.length > 0 ? items : fallbackItems;

  return {
    task: detail.task,
    updated: allItems.filter((item) => item.status === 'updated'),
    skipped: allItems.filter((item) => item.status === 'skipped'),
    failed: allItems.filter((item) => item.status === 'failed'),
  };
}

export function filterArtworkRepairSummary(summary: ArtworkRepairTaskSummary, query: string, statusFilter: string): ArtworkRepairTaskSummary {
  return {
    task: summary.task,
    updated: summary.updated.filter((item) => matchesArtworkRepairLog(item, query, statusFilter)),
    skipped: summary.skipped.filter((item) => matchesArtworkRepairLog(item, query, statusFilter)),
    failed: summary.failed.filter((item) => matchesArtworkRepairLog(item, query, statusFilter)),
  };
}

function ArtworkRepairLogRow({ item, onOpenGame }: { item: ArtworkRepairLogSummary; onOpenGame?: (gameId: string) => void }) {
  return (
    <div className="grid gap-2 rounded-md border border-white/[0.07] bg-black/[0.10] px-3 py-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={artworkLogBadgeClass(item.status)}>{artworkLogStatusLabel(item.status)}</Badge>
          <span className="truncate text-xs font-medium text-slate-200" title={item.title}>{item.title}</span>
          {item.gameId && onOpenGame && <Button className="h-7 px-2" size="sm" variant="ghost" onClick={() => onOpenGame(item.gameId!)}>游戏</Button>}
        </div>
        {item.gameId && <div className="mt-1 truncate font-mono text-[11px] text-slate-600">{item.gameId}</div>}
      </div>
      <div className="min-w-0 text-xs leading-5 text-slate-500">
        {item.fields && item.fields.length > 0 && (
          <div className="mb-1 flex flex-wrap gap-1.5">
            {item.fields.map((field) => <Badge key={field}>{artworkFieldLabel(field)}</Badge>)}
          </div>
        )}
        <span className="break-words">{item.message}</span>
        {item.provider && (
          <span className="ml-2 whitespace-nowrap text-slate-600">{providerLabel(item.provider)} {item.providerId ?? ''}</span>
        )}
      </div>
    </div>
  );
}

function ArtworkCompactStat({ label, value, tone = 'neutral' }: { label: string; value: number | string; tone?: 'neutral' | 'ok' | 'warn' }) {
  const toneClass = tone === 'ok' ? 'text-emerald-200' : tone === 'warn' ? 'text-amber-200' : 'text-slate-200';
  const displayValue = typeof value === 'number' ? formatCount(value) : value;
  return (
    <SoftRow className="px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-sm ${toneClass}`}>{displayValue}</div>
    </SoftRow>
  );
}

function artworkRepairTaskFallback(task: TaskRecord): ArtworkRepairLogSummary[] {
  if (!needsAttentionTask(task)) return [];
  return [{
    status: 'failed',
    title: task.message || taskLabel(task.taskType),
    gameId: null,
    message: task.error || task.message || '任务在生成逐条补图明细前结束。',
    fields: [],
  }];
}

function parseArtworkRepairLog(log: TaskLogEntry): ArtworkRepairLogSummary | null {
  const message = log.message.trim();
  const updated = message.match(/^已补全：(.+) \[([^\]]+)\]，字段 (.+?)(?:，来源\s+([^\s。]+)\s+([^。]+))?。?$/);
  if (updated) {
    const [, title, gameId, fieldsText, provider, providerId] = updated;
    return {
      status: 'updated',
      title: title.trim(),
      gameId: gameId.trim(),
      message: '已补全目标媒体字段。',
      fields: splitArtworkFields(fieldsText),
      provider: provider?.trim() ?? null,
      providerId: providerId?.trim() ?? null,
    };
  }

  const skipped = message.match(/^跳过：(.+) \[([^\]]+)\]，(.+?)。?$/);
  if (skipped) {
    const [, title, gameId, reason] = skipped;
    return {
      status: 'skipped',
      title: title.trim(),
      gameId: gameId.trim(),
      message: reason.trim(),
    };
  }

  const failed = message.match(/^失败：(.+) \[([^\]]+)\]，(.+?)。?$/);
  if (failed) {
    const [, title, gameId, reason] = failed;
    return {
      status: 'failed',
      title: title.trim(),
      gameId: gameId.trim(),
      message: reason.trim(),
    };
  }

  return null;
}

function matchesArtworkRepairLog(item: ArtworkRepairLogSummary, query: string, statusFilter: string) {
  if (statusFilter !== 'all' && item.status !== statusFilter) return false;
  const value = query.trim().toLowerCase();
  if (!value) return true;
  return [
    item.status,
    artworkLogStatusLabel(item.status),
    item.title,
    item.gameId,
    item.message,
    item.provider,
    item.providerId,
    ...(item.fields ?? []),
    ...(item.fields ?? []).map(artworkFieldLabel),
  ].some((text) => String(text ?? '').toLowerCase().includes(value));
}

function splitArtworkFields(value: string) {
  return value
    .split(/[\/、，,]/)
    .map((field) => field.trim())
    .filter(Boolean);
}

function needsAttentionTask(task: TaskRecord) {
  return task.status === 'failed' || task.status === 'cancelled';
}

function artworkLogStatusLabel(value: ArtworkRepairLogStatus) {
  if (value === 'updated') return '已补全';
  if (value === 'skipped') return '跳过';
  if (value === 'failed') return '失败';
  return value;
}

function artworkLogBadgeClass(value: ArtworkRepairLogStatus) {
  if (value === 'updated') return 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100';
  if (value === 'skipped') return 'border-amber-300/25 bg-amber-300/10 text-amber-100';
  if (value === 'failed') return 'border-rose-300/25 bg-rose-300/10 text-rose-100';
  return 'border-white/10 bg-white/[0.045] text-slate-300';
}

function artworkFieldLabel(value: string) {
  if (value === 'cover') return '封面';
  if (value === 'banner') return '横幅';
  if (value === 'background') return '背景';
  return value;
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
