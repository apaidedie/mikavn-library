import { CheckCircle2, ChevronDown, StopCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/notice';
import { MetricTile, Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import type { ApplyMetadataFields, BatchMatchResult, BatchMatchStatus, MetadataSearchResult } from '@/types/metadata';
import { friendlyMetadataError } from '@/utils/metadataErrors';
import { getBatchMetadataCandidate, providerLabel, type BatchMetadataResultCounts } from './batchMetadataPageModel';

type BatchMetadataResultsPanelProps = {
  appliedIds: string[];
  applyingIds: string[];
  expandedIds: string[];
  fields: ApplyMetadataFields;
  filteredApplicableResults: BatchMatchResult[];
  filteredResults: BatchMatchResult[];
  loading: boolean;
  resultCounts: BatchMetadataResultCounts;
  resultQuery: string;
  resultStatusFilter: string;
  selectedCandidates: Record<string, MetadataSearchResult>;
  status: BatchMatchStatus | null;
  writeFilter: string;
  onApplyAll: () => void;
  onApplyResult: (result: BatchMatchResult) => void;
  onCancel: () => void;
  onChooseCandidate: (result: BatchMatchResult, candidate: MetadataSearchResult) => void;
  onResetResultFilters: () => void;
  onResultQueryChange: (value: string) => void;
  onResultStatusFilterChange: (value: string) => void;
  onToggleExpanded: (id: string) => void;
  onWriteFilterChange: (value: string) => void;
};

export function BatchMetadataResultsPanel({ appliedIds, applyingIds, expandedIds, fields, filteredApplicableResults, filteredResults, loading, onApplyAll, onApplyResult, onCancel, onChooseCandidate, onResetResultFilters, onResultQueryChange, onResultStatusFilterChange, onToggleExpanded, onWriteFilterChange, resultCounts, resultQuery, resultStatusFilter, selectedCandidates, status, writeFilter }: BatchMetadataResultsPanelProps) {
  return (
    <Panel>
      <PanelHeader
        title="匹配结果"
        description="成功、无结果、待复核和错误会分别显示。"
        actions={(
          <>
            <Button disabled={!status || filteredApplicableResults.length === 0 || fields.length === 0 || loading} size="sm" variant="secondary" onClick={onApplyAll}><CheckCircle2 className="h-4 w-4" />应用当前推荐 {filteredApplicableResults.length > 0 ? filteredApplicableResults.length : ''}</Button>
            <Button disabled={!status || status.job.status !== 'running'} size="sm" variant="outline" onClick={onCancel}><StopCircle className="h-4 w-4" />取消</Button>
          </>
        )}
      />
      <PanelContent className="space-y-3">
        {!status ? (
          <EmptyState className="flex min-h-[22rem] flex-col items-center justify-center py-12">尚未开始批量匹配。</EmptyState>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 text-sm text-slate-400">
              <Badge>状态 {status.job.status}</Badge>
              <Badge>{status.job.completed}/{status.job.total}</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="成功" value={`${resultCounts.success}`} />
              <MetricTile label="待复核" value={`${resultCounts.review}`} />
              <MetricTile label="无结果" value={`${resultCounts.noResult}`} />
              <MetricTile label="错误" value={`${resultCounts.error}`} />
            </div>
            <SoftRow className="grid gap-2 px-3 py-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
              <label className="text-xs text-slate-500">
                结果搜索
                <Input aria-label="匹配结果搜索" className="mt-1 w-full" placeholder="搜索标题 / 来源 / RJ / 标签" value={resultQuery} onChange={(event) => onResultQueryChange(event.target.value)} />
              </label>
              <label className="text-xs text-slate-500">
                结果状态
                <Select aria-label="匹配结果状态筛选" className="mt-1 w-full" value={resultStatusFilter} onChange={(event) => onResultStatusFilterChange(event.target.value)}>
                  <option value="all">全部结果</option>
                  <option value="success">成功</option>
                  <option value="review">待复核</option>
                  <option value="no_result">无结果</option>
                  <option value="error">错误</option>
                </Select>
              </label>
              <label className="text-xs text-slate-500">
                写入状态
                <Select aria-label="匹配写入状态筛选" className="mt-1 w-full" value={writeFilter} onChange={(event) => onWriteFilterChange(event.target.value)}>
                  <option value="all">全部写入状态</option>
                  <option value="writable">可写入且未写入</option>
                  <option value="applied">已写入</option>
                  <option value="needs_review">无可写候选</option>
                </Select>
              </label>
              <Button disabled={!resultQuery.trim() && resultStatusFilter === 'all' && writeFilter === 'all'} size="sm" variant="outline" onClick={onResetResultFilters}>重置筛选</Button>
            </SoftRow>
            <div className="max-h-[calc(100vh-16rem)] space-y-2 overflow-auto pr-1">
              {filteredResults.length === 0 ? (
                <EmptyState className="flex min-h-[12rem] flex-col items-center justify-center gap-3 py-8">
                  <span>当前筛选没有匹配结果。</span>
                  <Button size="sm" variant="outline" onClick={onResetResultFilters}>重置筛选</Button>
                </EmptyState>
              ) : filteredResults.map((result) => <BatchMetadataResultRow appliedIds={appliedIds} applyingIds={applyingIds} expandedIds={expandedIds} fields={fields} key={result.id} result={result} selectedCandidates={selectedCandidates} onApplyResult={onApplyResult} onChooseCandidate={onChooseCandidate} onToggleExpanded={onToggleExpanded} />)}
            </div>
          </>
        )}
      </PanelContent>
    </Panel>
  );
}

function BatchMetadataResultRow({ appliedIds, applyingIds, expandedIds, fields, onApplyResult, onChooseCandidate, onToggleExpanded, result, selectedCandidates }: { appliedIds: string[]; applyingIds: string[]; expandedIds: string[]; fields: ApplyMetadataFields; result: BatchMatchResult; selectedCandidates: Record<string, MetadataSearchResult>; onApplyResult: (result: BatchMatchResult) => void; onChooseCandidate: (result: BatchMatchResult, candidate: MetadataSearchResult) => void; onToggleExpanded: (id: string) => void }) {
  const candidate = getBatchMetadataCandidate(result, selectedCandidates);
  return (
    <SoftRow className="px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="truncate text-sm font-medium text-slate-100">{result.originalTitle}</div>
        <Badge>{result.status}</Badge>
      </div>
      <div className="mt-1 text-xs text-slate-500">清洗：{result.cleanedTitle || '无'}</div>
      {candidate ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-[rgb(var(--accent-rgb))]">推荐：{providerLabel(candidate.provider)} {candidate.id} · {Math.round((candidate.relevanceScore ?? result.selectedScore ?? 0) * 100)}%</div>
          <Button disabled={fields.length === 0 || applyingIds.includes(result.id) || appliedIds.includes(result.id)} size="sm" variant={appliedIds.includes(result.id) ? 'ghost' : 'outline'} onClick={() => onApplyResult(result)}>
            <CheckCircle2 className="h-4 w-4" />{appliedIds.includes(result.id) ? '已写入' : '写入推荐'}
          </Button>
        </div>
      ) : <div className="mt-2 text-sm text-slate-500">{result.reason ? friendlyMetadataError(result.reason) : '无推荐结果'}</div>}
      {result.candidates.length > 0 && (
        <div className="mt-3">
          <Button size="sm" variant="ghost" onClick={() => onToggleExpanded(result.id)}><ChevronDown className="h-4 w-4" />候选 {result.candidates.length}</Button>
          {expandedIds.includes(result.id) && (
            <div className="mt-2 space-y-2">
              {result.candidates.map((item) => {
                const active = candidate?.provider === item.provider && candidate?.id === item.id;
                return (
                  <button className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${active ? 'border-[rgb(var(--accent-rgb)/0.7)] bg-[rgb(var(--accent-rgb)/0.10)] text-slate-100' : 'border-white/10 bg-black/[0.16] text-slate-300 hover:border-[rgb(var(--accent-rgb)/0.35)]'}`} key={`${item.provider}:${item.id}`} onClick={() => onChooseCandidate(result, item)} type="button">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate">{item.title}</span>
                      <Badge>{Math.round(item.relevanceScore * 100)}%</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-slate-500">
                      <span>{providerLabel(item.provider)} {item.id}</span>
                      {item.fromVndbSniff && <span className="text-[rgb(var(--accent-rgb))]">VNDB 嗅探</span>}
                      {item.releaseDate && <span>{item.releaseDate}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </SoftRow>
  );
}
