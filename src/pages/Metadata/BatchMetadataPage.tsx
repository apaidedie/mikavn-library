import { CheckCircle2, ChevronDown, DatabaseZap, RefreshCw, StopCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { EmptyState, Notice } from '@/components/ui/notice';
import { MetricTile, PageFrame, PageHeader, PageShell, Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import { TaskNotice } from '@/components/ui/task-notice';
import { api } from '@/services/api';
import type { Game } from '@/types/game';
import type { ApplyMetadataFields, BatchMatchResult, BatchMatchStatus, MetadataSearchResult, NormalizedMetadata } from '@/types/metadata';
import { errorMessage } from '@/utils/errorMessage';
import { friendlyMetadataError, metadataErrorMessage } from '@/utils/metadataErrors';
import {
  defaultFields,
  fieldOptions,
  hasAnyExternalId,
  hasExternalIdValue,
  hasMissingExternalId,
  matchesBatchResultQuery,
  matchesMissingProviderFilter,
  mediaFields,
  missingProviderOptions,
  normalizeMissingProviderFilter,
  providerLabel,
  resultToMetadata,
  textFields,
  type MissingProviderFilter,
  type QueuePresetRequest,
} from './batchMetadataPageModel';

type TaskMessage = { text: string; taskId?: string | null };

export function BatchMetadataPage({ refreshKey, queuePresetRequest, onOpenTask }: { refreshKey: number; queuePresetRequest?: QueuePresetRequest | null; onOpenTask?: (taskId: string) => void }) {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [status, setStatus] = useState<BatchMatchStatus | null>(null);
  const [fields, setFields] = useState<ApplyMetadataFields>(defaultFields);
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const [applyingIds, setApplyingIds] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, MetadataSearchResult>>({});
  const [queueQuery, setQueueQuery] = useState(() => queuePresetRequest?.query ?? '');
  const [missingProviderFilter, setMissingProviderFilter] = useState<MissingProviderFilter>(() => normalizeMissingProviderFilter(queuePresetRequest?.missingProvider));
  const [resultQuery, setResultQuery] = useState('');
  const [resultStatusFilter, setResultStatusFilter] = useState('all');
  const [writeFilter, setWriteFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<TaskMessage | null>(null);

  useEffect(() => {
    loadGames();
  }, [refreshKey]);

  useEffect(() => {
    if (!queuePresetRequest?.key) return;
    setQueueQuery(queuePresetRequest.query ?? '');
    setMissingProviderFilter(normalizeMissingProviderFilter(queuePresetRequest.missingProvider));
    setSelectedIds([]);
  }, [queuePresetRequest?.key]);

  useEffect(() => {
    if (!status || status.job.status !== 'running') {
      return;
    }
    const timer = window.setInterval(() => {
      api.getBatchMatchStatus(status.job.id).then(setStatus).catch(() => undefined);
    }, 1200);
    return () => window.clearInterval(timer);
  }, [status]);

  const incompleteGames = useMemo(() => games.filter(hasMissingExternalId), [games]);
  const queueGapCounts = useMemo(() => ({
    all: incompleteGames.length,
    external_id: games.filter((game) => !hasAnyExternalId(game)).length,
    vndb: games.filter((game) => !hasExternalIdValue(game.vndbId)).length,
    bangumi: games.filter((game) => !hasExternalIdValue(game.bangumiId)).length,
    dlsite: games.filter((game) => !hasExternalIdValue(game.dlsiteId)).length,
    fanza: games.filter((game) => !hasExternalIdValue(game.fanzaId)).length,
    ymgal: games.filter((game) => !hasExternalIdValue(game.ymgalId)).length,
  }), [games, incompleteGames]);
  const filteredIncompleteGames = useMemo(() => incompleteGames.filter((game) => {
    const queryText = queueQuery.trim().toLowerCase();
    const matchesQuery = !queryText || [game.title, game.originalTitle, game.developer, game.brand, game.publisher, game.installPath]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(queryText));
    const matchesProvider = matchesMissingProviderFilter(game, missingProviderFilter);
    return matchesQuery && matchesProvider;
  }), [incompleteGames, missingProviderFilter, queueQuery]);
  const filteredResults = useMemo(() => status?.results.filter((result) => {
    const candidate = candidateForResult(result);
    const matchesQuery = matchesBatchResultQuery(result, candidate, resultQuery);
    const matchesStatus = resultStatusFilter === 'all' || result.status === resultStatusFilter;
    const matchesWrite = writeFilter === 'all'
      || (writeFilter === 'writable' && Boolean(candidate) && !appliedIds.includes(result.id))
      || (writeFilter === 'applied' && appliedIds.includes(result.id))
      || (writeFilter === 'needs_review' && !candidate);
    return matchesQuery && matchesStatus && matchesWrite;
  }) ?? [], [appliedIds, resultQuery, resultStatusFilter, selectedCandidates, status, writeFilter]);
  const resultCounts = useMemo(() => ({
    success: status?.results.filter((result) => result.status === 'success').length ?? 0,
    review: status?.results.filter((result) => result.status === 'review').length ?? 0,
    noResult: status?.results.filter((result) => result.status === 'no_result').length ?? 0,
    error: status?.results.filter((result) => result.status === 'error').length ?? 0,
  }), [status]);
  const filteredApplicableResults = useMemo(() => filteredResults.filter((result) => Boolean(candidateForResult(result)) && !appliedIds.includes(result.id)), [appliedIds, filteredResults, selectedCandidates]);

  const loadGames = async () => {
    try {
      setGames(await api.listGames({ sortBy: 'updated_at', sortDirection: 'desc' }));
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  const toggle = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const toggleField = (field: ApplyMetadataFields[number]) => {
    setFields((current) => current.includes(field) ? current.filter((item) => item !== field) as ApplyMetadataFields : [...current, field]);
  };

  const start = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    setAppliedIds([]);
    setSelectedCandidates({});
    try {
      const job = await api.batchMatchMetadata(selectedIds);
      setStatus(await api.getBatchMatchStatus(job.id));
      setResultQuery('');
      setResultStatusFilter('all');
      setWriteFilter('all');
      setMessage({ text: `批量匹配任务已启动：${selectedIds.length} 个条目。`, taskId: job.taskId });
    } catch (reason) {
      setError(metadataErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  };

  const cancel = async () => {
    if (!status) return;
    await api.cancelBatchMatch(status.job.id);
    setStatus(await api.getBatchMatchStatus(status.job.id));
  };

  const applyResult = async (result: BatchMatchResult): Promise<boolean> => {
    const candidate = candidateForResult(result);
    if (!candidate || fields.length === 0) return false;
    setApplyingIds((current) => [...current, result.id]);
    setError(null);
    try {
      const metadata = await metadataForCandidate(candidate);
      const game = await api.applyMetadataToGame(result.gameId, metadata, fields);
      setGames((current) => current.map((item) => item.id === game.id ? game : item));
      setAppliedIds((current) => current.includes(result.id) ? current : [...current, result.id]);
      setMessage({ text: `已写入：${result.originalTitle}`, taskId: status?.job.taskId });
      return true;
    } catch (reason) {
      setError(errorMessage(reason));
      return false;
    } finally {
      setApplyingIds((current) => current.filter((id) => id !== result.id));
    }
  };

  const toggleExpanded = (id: string) => setExpandedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const chooseCandidate = (result: BatchMatchResult, candidate: MetadataSearchResult) => {
    setSelectedCandidates((current) => ({ ...current, [result.id]: candidate }));
    setAppliedIds((current) => current.filter((id) => id !== result.id));
  };

  function candidateForResult(result: BatchMatchResult) {
    return selectedCandidates[result.id] ?? result.candidates.find((item) => item.provider === result.selectedProvider && item.id === result.selectedId) ?? result.candidates[0] ?? null;
  }

  const applyAll = async () => {
    const pending = filteredApplicableResults;
    if (pending.length === 0 || fields.length === 0) return;
    setLoading(true);
    setMessage(null);
    let success = 0;
    let failed = 0;
    for (const result of pending) {
      if (await applyResult(result)) {
        success += 1;
      } else {
        failed += 1;
      }
    }
    setLoading(false);
    setMessage({ text: failed > 0 ? `已写入 ${success} 个推荐，${failed} 个失败。` : `已写入 ${success} 个推荐结果。`, taskId: status?.job.taskId });
  };

  const resetQueueFilters = () => {
    setQueueQuery('');
    setMissingProviderFilter('all');
  };

  const resetResultFilters = () => {
    setResultQuery('');
    setResultStatusFilter('all');
    setWriteFilter('all');
  };

  return (
    <PageShell>
      <PageFrame>
        <PageHeader title="批量匹配" description="选择元数据不完整的游戏，按 ButterFetch 风格批量匹配 VNDB / DLsite / FANZA。" />
        {(error || message) && (
          <div className="space-y-2">
            {error && <Notice tone="error">{error}</Notice>}
            {message && <TaskNotice message={message.text} taskId={message.taskId} onOpenTask={onOpenTask} />}
          </div>
        )}

        <div className="grid min-h-[calc(100vh-9rem)] gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <Panel>
        <PanelHeader title="匹配队列" icon={<DatabaseZap className="h-4 w-4" />} />
        <PanelContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricTile label="待补全" value={`${incompleteGames.length}`} />
            <MetricTile label="已选择" value={`${selectedIds.length}`} />
            <MetricTile label="当前筛选" value={`${filteredIncompleteGames.length}`} />
          </div>
          <div className="grid gap-2">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Input aria-label="匹配队列搜索" placeholder="搜索标题 / 会社 / 路径" value={queueQuery} onChange={(event) => setQueueQuery(event.target.value)} />
              <Button disabled={!queueQuery.trim() && missingProviderFilter === 'all'} size="sm" variant="outline" onClick={resetQueueFilters}>重置队列</Button>
            </div>
            <Select aria-label="缺失来源筛选" value={missingProviderFilter} onChange={(event) => setMissingProviderFilter(normalizeMissingProviderFilter(event.target.value))}>
              {missingProviderOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </Select>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5" aria-label="缺口快捷筛选">
              {missingProviderOptions.map((option) => {
                const active = missingProviderFilter === option.id;
                return (
                  <Button
                    aria-pressed={active}
                    className={active ? 'border-[rgb(var(--accent-rgb)/0.42)] bg-[rgb(var(--accent-rgb)/0.16)] text-slate-100' : 'text-slate-300'}
                    key={option.id}
                    size="sm"
                    variant="outline"
                    onClick={() => setMissingProviderFilter(option.id)}
                  >
                    <span>{option.shortLabel}</span>
                    <span className="font-mono text-[11px] text-slate-400">{queueGapCounts[option.id]}</span>
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setSelectedIds(filteredIncompleteGames.map((game) => game.id))}>选择当前筛选</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>清空</Button>
          </div>
          <div className="max-h-[calc(100vh-25rem)] space-y-1.5 overflow-auto pr-1">
            {filteredIncompleteGames.length === 0 ? (
              <EmptyState className="py-8">当前筛选没有待补全条目。</EmptyState>
            ) : filteredIncompleteGames.map((game) => (
              <label className="block" key={game.id}>
                <SoftRow className="flex gap-3 bg-black/[0.08] px-2.5 py-2">
                  <Checkbox checked={selectedIds.includes(game.id)} className="mt-1" onChange={() => toggle(game.id)} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-100">{game.title}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-slate-500">
                      {!game.vndbId && <span>缺 VNDB</span>}
                      {!game.dlsiteId && <span>缺 DLsite</span>}
                      {!game.fanzaId && <span>缺 FANZA</span>}
                    </div>
                  </div>
                </SoftRow>
              </label>
            ))}
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-medium text-slate-500">写入字段</div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => setFields(defaultFields)}>安全补全</Button>
                <Button size="sm" variant="ghost" onClick={() => setFields(mediaFields)}>只补媒体</Button>
                <Button size="sm" variant="ghost" onClick={() => setFields(textFields)}>只补文本</Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {fieldOptions.map((option) => (
                <label className="flex items-center gap-1 rounded-md border border-white/10 bg-black/[0.12] px-2 py-1 text-xs text-slate-400" key={option.id}>
                  <Checkbox checked={fields.includes(option.id)} className="h-3.5 w-3.5" onChange={() => toggleField(option.id)} />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
          <Button className="w-full" disabled={loading || selectedIds.length === 0} onClick={start}><RefreshCw className="h-4 w-4" />开始匹配 {selectedIds.length} 个条目</Button>
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader
          title="匹配结果"
          description="成功、无结果、待复核和错误会分别显示。"
          actions={(
            <>
              <Button disabled={!status || filteredApplicableResults.length === 0 || fields.length === 0 || loading} size="sm" variant="secondary" onClick={applyAll}><CheckCircle2 className="h-4 w-4" />应用当前推荐 {filteredApplicableResults.length > 0 ? filteredApplicableResults.length : ''}</Button>
              <Button disabled={!status || status.job.status !== 'running'} size="sm" variant="outline" onClick={cancel}><StopCircle className="h-4 w-4" />取消</Button>
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
                  <Input aria-label="匹配结果搜索" className="mt-1 w-full" placeholder="搜索标题 / 来源 / RJ / 标签" value={resultQuery} onChange={(event) => setResultQuery(event.target.value)} />
                </label>
                <label className="text-xs text-slate-500">
                  结果状态
                  <Select aria-label="匹配结果状态筛选" className="mt-1 w-full" value={resultStatusFilter} onChange={(event) => setResultStatusFilter(event.target.value)}>
                    <option value="all">全部结果</option>
                    <option value="success">成功</option>
                    <option value="review">待复核</option>
                    <option value="no_result">无结果</option>
                    <option value="error">错误</option>
                  </Select>
                </label>
                <label className="text-xs text-slate-500">
                  写入状态
                  <Select aria-label="匹配写入状态筛选" className="mt-1 w-full" value={writeFilter} onChange={(event) => setWriteFilter(event.target.value)}>
                    <option value="all">全部写入状态</option>
                    <option value="writable">可写入且未写入</option>
                    <option value="applied">已写入</option>
                    <option value="needs_review">无可写候选</option>
                  </Select>
                </label>
                <Button disabled={!resultQuery.trim() && resultStatusFilter === 'all' && writeFilter === 'all'} size="sm" variant="outline" onClick={resetResultFilters}>重置筛选</Button>
              </SoftRow>
              <div className="max-h-[calc(100vh-16rem)] space-y-2 overflow-auto pr-1">
                {filteredResults.length === 0 ? (
                  <EmptyState className="flex min-h-[12rem] flex-col items-center justify-center gap-3 py-8">
                    <span>当前筛选没有匹配结果。</span>
                    <Button size="sm" variant="outline" onClick={resetResultFilters}>重置筛选</Button>
                  </EmptyState>
                ) : filteredResults.map((result) => (
                  <SoftRow className="px-3 py-2.5" key={result.id}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="truncate text-sm font-medium text-slate-100">{result.originalTitle}</div>
                      <Badge>{result.status}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">清洗：{result.cleanedTitle || '无'}</div>
                    {candidateForResult(result) ? (
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm text-[rgb(var(--accent-rgb))]">推荐：{providerLabel(candidateForResult(result)?.provider)} {candidateForResult(result)?.id} · {Math.round((candidateForResult(result)?.relevanceScore ?? result.selectedScore ?? 0) * 100)}%</div>
                        <Button disabled={fields.length === 0 || applyingIds.includes(result.id) || appliedIds.includes(result.id)} size="sm" variant={appliedIds.includes(result.id) ? 'ghost' : 'outline'} onClick={() => applyResult(result)}>
                          <CheckCircle2 className="h-4 w-4" />{appliedIds.includes(result.id) ? '已写入' : '写入推荐'}
                        </Button>
                      </div>
                    ) : <div className="mt-2 text-sm text-slate-500">{result.reason ? friendlyMetadataError(result.reason) : '无推荐结果'}</div>}
                    {result.candidates.length > 0 && (
                      <div className="mt-3">
                        <Button size="sm" variant="ghost" onClick={() => toggleExpanded(result.id)}><ChevronDown className="h-4 w-4" />候选 {result.candidates.length}</Button>
                        {expandedIds.includes(result.id) && (
                          <div className="mt-2 space-y-2">
                            {result.candidates.map((candidate) => {
                              const active = candidateForResult(result)?.provider === candidate.provider && candidateForResult(result)?.id === candidate.id;
                              return (
                                <button className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${active ? 'border-[rgb(var(--accent-rgb)/0.7)] bg-[rgb(var(--accent-rgb)/0.10)] text-slate-100' : 'border-white/10 bg-black/[0.16] text-slate-300 hover:border-[rgb(var(--accent-rgb)/0.35)]'}`} key={`${candidate.provider}:${candidate.id}`} onClick={() => chooseCandidate(result, candidate)} type="button">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="truncate">{candidate.title}</span>
                                    <Badge>{Math.round(candidate.relevanceScore * 100)}%</Badge>
                                  </div>
                                  <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-slate-500">
                                    <span>{providerLabel(candidate.provider)} {candidate.id}</span>
                                    {candidate.fromVndbSniff && <span className="text-[rgb(var(--accent-rgb))]">VNDB 嗅探</span>}
                                    {candidate.releaseDate && <span>{candidate.releaseDate}</span>}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </SoftRow>
                ))}
              </div>
            </>
          )}
        </PanelContent>
      </Panel>
        </div>
      </PageFrame>
    </PageShell>
  );
}

async function metadataForCandidate(candidate: MetadataSearchResult): Promise<NormalizedMetadata> {
  return api.getMetadataDetail(candidate.provider, candidate.id).catch(() => resultToMetadata(candidate));
}
