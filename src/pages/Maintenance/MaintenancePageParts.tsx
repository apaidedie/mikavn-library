import { Copy, FolderOpen } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SoftRow } from '@/components/ui/page';
import type { ArtworkRepairDiagnosisItem, DuplicateExternalIdGroup } from '@/types/metadata';
import type { TaskRecord } from '@/types/task';
import { taskLabel, taskStatusClass, taskStatusLabel } from '@/utils/taskLabels';
import { formatDateTime } from '@/utils/time';

export type MaintenanceTaskFilter = 'all' | 'active' | 'attention' | 'completed';

export function PathRow({ label, value, onCopy, onReveal }: { label: string; value: string; onCopy?: () => void; onReveal?: () => void }) {
  return (
    <SoftRow className="grid gap-2 px-3 py-2 lg:grid-cols-[5rem_minmax(0,1fr)_auto]">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="min-w-0 break-all font-mono text-xs text-slate-300">{value}</div>
      <PathActions label={label} onCopy={onCopy} onReveal={onReveal} />
    </SoftRow>
  );
}

export function StorageStat({ label, count, size, path, onCopy, onReveal }: { label: string; count: number; size: number; path?: string; onCopy?: () => void; onReveal?: () => void }) {
  return (
    <SoftRow className="flex items-start justify-between gap-3 px-3 py-2">
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="mt-1 font-mono text-sm text-slate-200">{formatCount(count)} · {formatBytes(size)}</div>
        {path && <div className="mt-1 truncate font-mono text-[11px] text-slate-600" title={path}>{path}</div>}
      </div>
      <PathActions label={label} onCopy={onCopy} onReveal={onReveal} />
    </SoftRow>
  );
}

function PathActions({ label, onCopy, onReveal }: { label: string; onCopy?: () => void; onReveal?: () => void }) {
  if (!onCopy && !onReveal) return <span />;
  return (
    <div className="flex shrink-0 items-start gap-1">
      {onCopy && <Button aria-label={`复制${label}`} size="icon" title={`复制${label}`} variant="ghost" onClick={onCopy}><Copy className="h-4 w-4" /></Button>}
      {onReveal && <Button aria-label={`打开${label}`} size="icon" title={`打开${label}`} variant="ghost" onClick={onReveal}><FolderOpen className="h-4 w-4" /></Button>}
    </div>
  );
}

export function ArtworkDiagnosisRow({ item, onOpenGame, onOpenMetadata }: { item: ArtworkRepairDiagnosisItem; onOpenGame?: (gameId: string) => void; onOpenMetadata?: (preset?: { query?: string; missingProvider?: string } | null) => void }) {
  const canOpenMetadata = item.status === 'missing_external_id' && Boolean(onOpenMetadata);
  return (
    <SoftRow className="grid gap-3 px-3 py-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-slate-100" title={item.title}>{item.title}</span>
          <Badge className={artworkStatusBadgeClass(item.status)}>{artworkStatusLabel(item.status)}</Badge>
          {onOpenGame && <Button className="h-7 px-2" size="sm" variant="ghost" onClick={() => onOpenGame(item.gameId)}>游戏</Button>}
          {canOpenMetadata && <Button className="h-7 px-2" size="sm" variant="outline" onClick={() => onOpenMetadata?.({ query: item.title, missingProvider: 'external_id' })}>匹配</Button>}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.missingFields.map((field) => <Badge key={field}>{artworkFieldLabel(field)}</Badge>)}
        </div>
        <div className="mt-2 text-xs leading-5 text-slate-500">{item.reason}</div>
      </div>
      <div className="min-w-0 space-y-2 text-[11px] leading-5">
        {item.providerResults.length > 0 ? item.providerResults.map((result) => (
          <div className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)]" key={`${result.provider}:${result.providerId}`}>
            <span className="text-slate-600">{providerLabel(result.provider)} {result.providerId}</span>
            <span className="min-w-0">
              <Badge className={artworkProviderBadgeClass(result.status)}>{artworkProviderStatusLabel(result.status)}</Badge>
              {result.imageUrl && <span className="ml-2 break-all font-mono text-slate-500">{result.imageUrl}</span>}
              {result.reason && <span className="ml-2 break-all text-slate-500">{result.reason}</span>}
            </span>
          </div>
        )) : (
          <div className="text-xs text-slate-500">没有可用外部 ID。</div>
        )}
      </div>
    </SoftRow>
  );
}

export function matchesArtworkDiagnosisItem(item: ArtworkRepairDiagnosisItem, query: string, statusFilter: string) {
  if (statusFilter !== 'all' && item.status !== statusFilter) return false;
  const value = query.trim().toLowerCase();
  if (!value) return true;
  return [
    item.gameId,
    item.title,
    item.status,
    artworkStatusLabel(item.status),
    item.reason,
    ...item.missingFields,
    ...item.missingFields.map(artworkFieldLabel),
    ...item.providers.flatMap((provider) => [provider.provider, providerLabel(provider.provider), provider.providerId]),
    ...item.providerResults.flatMap((result) => [result.provider, providerLabel(result.provider), result.providerId, result.status, artworkProviderStatusLabel(result.status), result.reason, result.imageUrl]),
  ].some((text) => String(text ?? '').toLowerCase().includes(value));
}

export function ProgressBlock({ label, value, total }: { label: string; value: number; total: number }) {
  const ratio = total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono text-slate-200">{formatCount(value)} / {formatCount(total)} · {percent(value, total)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/25">
        <div className="h-full rounded-full bg-[rgb(var(--accent-rgb))]" style={{ width: `${ratio}%` }} />
      </div>
    </div>
  );
}

export function CompactStat({ actionLabel, label, onClick, value, tone = 'neutral' }: { actionLabel?: string; label: string; onClick?: () => void; value: number | string; tone?: 'neutral' | 'ok' | 'warn' }) {
  const toneClass = tone === 'ok' ? 'text-emerald-200' : tone === 'warn' ? 'text-amber-200' : 'text-slate-200';
  const displayValue = typeof value === 'number' ? formatCount(value) : value;
  if (onClick) {
    return (
      <button aria-label={actionLabel ?? label} className="motion-button rounded-md border border-white/10 bg-black/[0.10] px-3 py-2 text-left hover:border-[rgb(var(--accent-rgb)/0.38)] hover:bg-[rgb(var(--accent-rgb)/0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-rgb)/0.42)]" onClick={onClick} type="button">
        <div className="text-[11px] text-slate-500">{label}</div>
        <div className={`mt-1 font-mono text-sm ${toneClass}`}>{displayValue}</div>
      </button>
    );
  }

  return (
    <div className="rounded-md border border-white/10 bg-black/[0.10] px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-sm ${toneClass}`}>{displayValue}</div>
    </div>
  );
}

export function MaintenanceAction({ action, label, detail, status }: { action?: ReactNode; label: string; detail: string; status: string }) {
  return (
    <SoftRow className="flex items-center justify-between gap-3 px-3 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-100">{label}</div>
        <div className="mt-1 text-xs text-slate-500">{detail}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge>{status}</Badge>
        {action}
      </div>
    </SoftRow>
  );
}

export function MaintenanceTaskRow({ actionBusy, task, onCancelTask, onOpenTask, onRetryTask }: { actionBusy?: boolean; task: TaskRecord; onCancelTask?: (taskId: string) => void; onOpenTask?: (taskId?: string | null) => void; onRetryTask?: (taskId: string) => void }) {
  const progress = boundedProgress(task.progress);
  const canRetry = Boolean(task.retryable) && needsAttentionTask(task);
  const canCancel = isActiveTask(task);
  return (
    <SoftRow className="grid gap-3 px-3 py-3 xl:grid-cols-[minmax(0,1fr)_minmax(8rem,12rem)_auto] xl:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-slate-100">{taskLabel(task.taskType)}</span>
          <Badge className={taskStatusClass(task.status)}>{taskStatusLabel(task.status)}</Badge>
          <span className="font-mono text-xs text-slate-500">{Math.round(progress * 100)}%</span>
        </div>
        <div className="mt-1 truncate text-xs text-slate-500">{task.message || task.error || '无消息'}</div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
          <span>更新 {formatDateTime(task.updatedAt)}</span>
          <span>{taskTimingLabel(task)}</span>
        </div>
        {task.error && <div className="mt-2 break-all text-xs text-rose-200">{task.error}</div>}
      </div>
      <div className="min-w-0">
        <div className="mb-1 text-right font-mono text-xs text-slate-400">{Math.round(progress * 100)}%</div>
        <div className="h-1.5 overflow-hidden rounded-full bg-black/25">
          <div className="h-full rounded-full bg-[rgb(var(--accent-rgb))]" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        {onOpenTask && <Button size="sm" variant="ghost" onClick={() => onOpenTask(task.id)}>日志</Button>}
        {onRetryTask && <Button disabled={actionBusy || !canRetry} size="sm" variant="outline" onClick={() => onRetryTask(task.id)}>{actionBusy && canRetry ? '重试中' : '重试'}</Button>}
        {onCancelTask && <Button disabled={actionBusy || !canCancel} size="sm" variant="outline" onClick={() => onCancelTask(task.id)}>{actionBusy && canCancel ? '取消中' : '取消'}</Button>}
      </div>
    </SoftRow>
  );
}

export function isMaintenanceTask(task: TaskRecord) {
  return ['metadata.batch_match', 'metadata.description_image_repair', 'metadata.artwork_repair', 'metadata.duplicate_id_audit'].includes(task.taskType);
}

export function isActiveTask(task: TaskRecord) {
  return task.status === 'running' || task.status === 'pending';
}

function needsAttentionTask(task: TaskRecord) {
  return task.status === 'failed' || task.status === 'cancelled';
}

export function matchesMaintenanceTaskFilter(task: TaskRecord, filter: MaintenanceTaskFilter) {
  return filter === 'all'
    || (filter === 'active' && isActiveTask(task))
    || (filter === 'attention' && needsAttentionTask(task))
    || (filter === 'completed' && task.status === 'completed');
}

export function summarizeMaintenanceTasks(tasks: TaskRecord[]) {
  return {
    activeCount: tasks.filter(isActiveTask).length,
    attentionCount: tasks.filter(needsAttentionTask).length,
    completedCount: tasks.filter((task) => task.status === 'completed').length,
  };
}

function boundedProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function taskTimingLabel(task: TaskRecord) {
  const startedAt = new Date(task.createdAt).getTime();
  const updatedAt = new Date(task.updatedAt).getTime();
  const reference = isActiveTask(task) ? Date.now() : updatedAt;
  const elapsedSeconds = Number.isFinite(startedAt) && Number.isFinite(reference) && reference > startedAt ? Math.max(0, Math.round((reference - startedAt) / 1000)) : 0;
  return `${isActiveTask(task) ? '已运行' : '耗时'} ${formatDuration(elapsedSeconds)}`;
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

export function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? Math.round(size) : size.toFixed(size >= 10 ? 1 : 2)} ${units[unit]}`;
}

export function percent(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

export function duplicateGroupKey(group: DuplicateExternalIdGroup) {
  return `${group.provider}:${group.externalId}`;
}

export function recommendDuplicateMergeTarget(group: DuplicateExternalIdGroup | null) {
  if (!group || group.games.length === 0) return '';
  const scored = group.games.map((game, index) => ({ game, score: duplicateMergeTargetScore(game, index) }));
  scored.sort((left, right) => right.score - left.score || left.game.title.localeCompare(right.game.title, 'zh-CN'));
  return scored[0]?.game.gameId ?? '';
}

function duplicateMergeTargetScore(game: DuplicateExternalIdGroup['games'][number], index: number) {
  const title = game.title.toLowerCase();
  const path = game.installPath.toLowerCase();
  let score = Math.max(0, 200 - index);
  score += game.sources.length * 10;
  score += Math.max(0, 80 - game.title.length);
  if (path.includes('duplicate') || path.includes('重复')) score -= 80;
  if (title.includes('duplicate') || title.includes('重复')) score -= 100;
  if (path.includes('backup') || path.includes('old') || path.includes('copy')) score -= 40;
  return score;
}

function artworkStatusLabel(value: string) {
  if (value === 'repairable') return '可补全';
  if (value === 'missing_external_id') return '缺外部 ID';
  if (value === 'no_remote_image') return '远程无图';
  if (value === 'provider_error') return '来源失败';
  return value;
}

function artworkProviderStatusLabel(value: string) {
  if (value === 'has_image') return '有主图';
  if (value === 'no_image') return '无主图';
  if (value === 'error') return '失败';
  return value;
}

function artworkFieldLabel(value: string) {
  if (value === 'cover') return '封面';
  if (value === 'banner') return '横幅';
  if (value === 'background') return '背景';
  return value;
}

export function providerLabel(value: string) {
  if (value === 'vndb') return 'VNDB';
  if (value === 'bangumi') return 'Bangumi';
  if (value === 'dlsite') return 'DLsite';
  if (value === 'fanza') return 'FANZA';
  if (value === 'ymgal') return 'YMGal';
  return value;
}

function artworkStatusBadgeClass(value: string) {
  if (value === 'repairable') return 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100';
  if (value === 'missing_external_id' || value === 'no_remote_image') return 'border-amber-300/25 bg-amber-300/10 text-amber-100';
  if (value === 'provider_error') return 'border-rose-300/25 bg-rose-300/10 text-rose-100';
  return 'border-white/10 bg-white/[0.045] text-slate-300';
}

function artworkProviderBadgeClass(value: string) {
  if (value === 'has_image') return 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100';
  if (value === 'no_image') return 'border-amber-300/25 bg-amber-300/10 text-amber-100';
  if (value === 'error') return 'border-rose-300/25 bg-rose-300/10 text-rose-100';
  return 'border-white/10 bg-white/[0.045] text-slate-300';
}

export function dataDirSourceLabel(value: string) {
  if (value === 'env') return 'MIKAVN_APP_DATA_DIR';
  if (value === 'portable') return '应用旁 app-data';
  if (value === 'mock') return '浏览器预览';
  return '应用默认目录';
}
