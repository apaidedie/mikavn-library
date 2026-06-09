import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SoftRow } from '@/components/ui/page';
import type { BatchMatchResult, BatchMatchStatus, MetadataSearchResult } from '@/types/metadata';
import type { TaskRecord } from '@/types/task';
import { taskStatusClass, taskStatusLabel } from '@/utils/taskLabels';
import { formatDateTime } from '@/utils/time';

export type BatchMatchHistorySummary = {
  task: TaskRecord;
  status: BatchMatchStatus | null;
  results: BatchMatchResult[];
};

export function BatchMatchHistoryTaskRow({ formatCount, providerLabel, summary, onOpenTask }: { formatCount: (value: number) => string; providerLabel: (value: string) => string; summary: BatchMatchHistorySummary; onOpenTask?: (taskId?: string | null) => void }) {
  const task = summary.task;
  const visibleResults = summary.results.slice(0, 8);
  const hiddenCount = summary.results.length - visibleResults.length;
  const counts = summarizeBatchMatchResults(summary.results);

  return (
    <SoftRow className="space-y-3 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-100">{task.message || '批量元数据匹配任务'}</span>
            <Badge className={taskStatusClass(task.status)}>{taskStatusLabel(task.status)}</Badge>
            {summary.status && <Badge>{summary.status.job.completed}/{summary.status.job.total}</Badge>}
          </div>
          <div className="mt-1 text-xs text-slate-500">更新于 {formatDateTime(task.updatedAt)}</div>
          {task.error && <div className="mt-2 break-all text-xs text-rose-200">{task.error}</div>}
        </div>
        {onOpenTask && <Button size="sm" variant="ghost" onClick={() => onOpenTask(task.id)}>日志</Button>}
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <BatchCompactStat label="成功" value={formatCount(counts.success)} tone={counts.success > 0 ? 'ok' : 'neutral'} />
        <BatchCompactStat label="待复核" value={formatCount(counts.review)} tone={counts.review > 0 ? 'warn' : 'neutral'} />
        <BatchCompactStat label="无结果" value={formatCount(counts.noResult)} tone={counts.noResult > 0 ? 'warn' : 'ok'} />
        <BatchCompactStat label="错误" value={formatCount(counts.error)} tone={counts.error > 0 ? 'warn' : 'ok'} />
      </div>
      {visibleResults.length > 0 ? (
        <div className="space-y-2">
          {visibleResults.map((result) => <BatchMatchResultRow key={result.id} formatCount={formatCount} providerLabel={providerLabel} result={result} />)}
          {hiddenCount > 0 && <div className="px-1 text-xs text-slate-500">还有 {formatCount(hiddenCount)} 条匹配结果，可打开批量匹配页查看完整队列。</div>}
        </div>
      ) : (
        <div className="text-xs text-slate-500">这条任务还没有可读取的匹配结果。</div>
      )}
    </SoftRow>
  );
}

function BatchCompactStat({ label, value, tone = 'neutral' }: { label: string; value: number | string; tone?: 'neutral' | 'ok' | 'warn' }) {
  const toneClass = tone === 'ok' ? 'text-emerald-200' : tone === 'warn' ? 'text-amber-200' : 'text-slate-200';
  return (
    <SoftRow className="px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-sm ${toneClass}`}>{value}</div>
    </SoftRow>
  );
}

function BatchMatchResultRow({ formatCount, providerLabel, result }: { formatCount: (value: number) => string; providerLabel: (value: string) => string; result: BatchMatchResult }) {
  const selected = selectedBatchCandidate(result);
  return (
    <div className="grid gap-2 rounded-md border border-white/[0.07] bg-black/[0.10] px-3 py-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={batchResultBadgeClass(result.status)}>{batchResultStatusLabel(result.status)}</Badge>
          <span className="truncate text-xs font-medium text-slate-200" title={result.originalTitle}>{result.originalTitle}</span>
        </div>
        <div className="mt-1 truncate font-mono text-[11px] text-slate-600">{result.gameId}</div>
      </div>
      <div className="min-w-0 text-xs leading-5 text-slate-500">
        {selected ? (
          <span className="break-all text-[rgb(var(--accent-rgb))]">推荐：{providerLabel(selected.provider)} {selected.id} · {Math.round((selected.relevanceScore ?? result.selectedScore ?? 0) * 100)}%</span>
        ) : (
          <span className="break-words">{result.reason || '无推荐结果'}</span>
        )}
        {result.candidates.length > 0 && <span className="ml-2 whitespace-nowrap text-slate-600">候选 {formatCount(result.candidates.length)}</span>}
      </div>
    </div>
  );
}

export function summarizeBatchMatchResults(results: BatchMatchResult[]) {
  return {
    success: results.filter((result) => result.status === 'success').length,
    review: results.filter((result) => result.status === 'review').length,
    noResult: results.filter((result) => result.status === 'no_result').length,
    error: results.filter((result) => result.status === 'error').length,
  };
}

export function filterBatchMatchHistorySummary(summary: BatchMatchHistorySummary, query: string, statusFilter: string, providerLabel: (value: string) => string): BatchMatchHistorySummary {
  return {
    ...summary,
    results: summary.results.filter((result) => matchesBatchMatchHistoryResult(result, query, statusFilter, providerLabel)),
  };
}

function matchesBatchMatchHistoryResult(result: BatchMatchResult, query: string, statusFilter: string, providerLabel: (value: string) => string) {
  if (statusFilter !== 'all' && result.status !== statusFilter) return false;
  const value = query.trim().toLowerCase();
  if (!value) return true;
  const selected = selectedBatchCandidate(result);
  const candidates = [selected, ...result.candidates].filter(Boolean) as MetadataSearchResult[];
  return [
    result.gameId,
    result.originalTitle,
    result.cleanedTitle,
    result.status,
    batchResultStatusLabel(result.status),
    result.reason,
    result.selectedProvider,
    result.selectedId,
    ...candidates.flatMap((candidate) => [candidate.provider, providerLabel(candidate.provider), candidate.id, candidate.title, candidate.description, candidate.releaseDate, ...candidate.developers, ...candidate.tags, ...Object.entries(candidate.externalIds).flatMap(([provider, id]) => [provider, id])]),
  ].some((text) => String(text ?? '').toLowerCase().includes(value));
}

function selectedBatchCandidate(result: BatchMatchResult): MetadataSearchResult | null {
  return result.candidates.find((candidate) => candidate.provider === result.selectedProvider && candidate.id === result.selectedId) ?? result.candidates[0] ?? null;
}

function batchResultStatusLabel(value: string) {
  if (value === 'success') return '成功';
  if (value === 'review') return '待复核';
  if (value === 'no_result') return '无结果';
  if (value === 'error') return '错误';
  return value;
}

function batchResultBadgeClass(value: string) {
  if (value === 'success') return 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100';
  if (value === 'review' || value === 'no_result') return 'border-amber-300/25 bg-amber-300/10 text-amber-100';
  if (value === 'error') return 'border-rose-300/25 bg-rose-300/10 text-rose-100';
  return 'border-white/10 bg-white/[0.045] text-slate-300';
}
