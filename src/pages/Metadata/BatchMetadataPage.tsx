import { useEffect, useMemo, useState } from 'react';
import { Notice } from '@/components/ui/notice';
import { PageFrame, PageHeader, PageShell } from '@/components/ui/page';
import { TaskNotice } from '@/components/ui/task-notice';
import { api } from '@/services/api';
import type { Game } from '@/types/game';
import type { ApplyMetadataFields, BatchMatchResult, BatchMatchStatus, MetadataSearchResult, NormalizedMetadata } from '@/types/metadata';
import { errorMessage } from '@/utils/errorMessage';
import { metadataErrorMessage } from '@/utils/metadataErrors';
import { BatchMetadataQueuePanel } from './BatchMetadataQueuePanel';
import { BatchMetadataResultsPanel } from './BatchMetadataResultsPanel';
import {
  defaultFields,
  deriveBatchMetadataQueueState,
  deriveBatchMetadataResultState,
  getBatchMetadataCandidate,
  normalizeMissingProviderFilter,
  resultToMetadata,
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

  const queueState = useMemo(() => deriveBatchMetadataQueueState(games, { query: queueQuery, missingProviderFilter }), [games, missingProviderFilter, queueQuery]);
  const resultState = useMemo(() => deriveBatchMetadataResultState(status?.results ?? [], {
    appliedIds,
    query: resultQuery,
    resultStatusFilter,
    selectedCandidates,
    writeFilter,
  }), [appliedIds, resultQuery, resultStatusFilter, selectedCandidates, status?.results, writeFilter]);
  const { filteredGames: filteredIncompleteGames, gapCounts: queueGapCounts, incompleteGames } = queueState;
  const { applicableResults: filteredApplicableResults, filteredResults, resultCounts } = resultState;

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
    const candidate = getBatchMetadataCandidate(result, selectedCandidates);
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
          <BatchMetadataQueuePanel
            fields={fields}
            filteredIncompleteGames={filteredIncompleteGames}
            incompleteGames={incompleteGames}
            loading={loading}
            missingProviderFilter={missingProviderFilter}
            queueGapCounts={queueGapCounts}
            queueQuery={queueQuery}
            selectedIds={selectedIds}
            onFieldsChange={setFields}
            onMissingProviderFilterChange={setMissingProviderFilter}
            onQueueQueryChange={setQueueQuery}
            onResetQueueFilters={resetQueueFilters}
            onSelectIds={setSelectedIds}
            onStart={() => void start()}
            onToggleField={toggleField}
            onToggleGame={toggle}
          />

          <BatchMetadataResultsPanel
            appliedIds={appliedIds}
            applyingIds={applyingIds}
            expandedIds={expandedIds}
            fields={fields}
            filteredApplicableResults={filteredApplicableResults}
            filteredResults={filteredResults}
            loading={loading}
            resultCounts={resultCounts}
            resultQuery={resultQuery}
            resultStatusFilter={resultStatusFilter}
            selectedCandidates={selectedCandidates}
            status={status}
            writeFilter={writeFilter}
            onApplyAll={() => void applyAll()}
            onApplyResult={(result) => void applyResult(result)}
            onCancel={() => void cancel()}
            onChooseCandidate={chooseCandidate}
            onResetResultFilters={resetResultFilters}
            onResultQueryChange={setResultQuery}
            onResultStatusFilterChange={setResultStatusFilter}
            onToggleExpanded={toggleExpanded}
            onWriteFilterChange={setWriteFilter}
          />
        </div>
      </PageFrame>
    </PageShell>
  );
}

async function metadataForCandidate(candidate: MetadataSearchResult): Promise<NormalizedMetadata> {
  return api.getMetadataDetail(candidate.provider, candidate.id).catch(() => resultToMetadata(candidate));
}
