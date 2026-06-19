import { useEffect, useMemo, useState } from 'react';
import { api } from '@/services/api';
import type { Game } from '@/types/game';
import type { ApplyMetadataFields, BatchMatchResult, BatchMatchStatus, MetadataSearchResult, NormalizedMetadata } from '@/types/metadata';
import { errorMessage } from '@/utils/errorMessage';
import { metadataErrorMessage } from '@/utils/metadataErrors';
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

export type TaskMessage = { text: string; taskId?: string | null };

export function useBatchMetadataPageActions(refreshKey: number, queuePresetRequest?: QueuePresetRequest | null) {
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
    void loadGames();
  }, [refreshKey]);

  useEffect(() => {
    if (!queuePresetRequest?.key) return;
    setQueueQuery(queuePresetRequest.query ?? '');
    setMissingProviderFilter(normalizeMissingProviderFilter(queuePresetRequest.missingProvider));
    setSelectedIds([]);
  }, [queuePresetRequest?.key]);

  useEffect(() => {
    if (!status || status.job.status !== 'running') return;
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

  async function loadGames() {
    try {
      setGames(await api.listGames({ sortBy: 'updated_at', sortDirection: 'desc' }));
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  const toggleGame = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

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
    const pending = resultState.applicableResults;
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

  return {
    appliedIds,
    applyingIds,
    error,
    expandedIds,
    fields,
    loading,
    message,
    missingProviderFilter,
    queueGapCounts: queueState.gapCounts,
    queueQuery,
    resultCounts: resultState.resultCounts,
    resultQuery,
    resultStatusFilter,
    selectedCandidates,
    selectedIds,
    status,
    writeFilter,
    filteredApplicableResults: resultState.applicableResults,
    filteredIncompleteGames: queueState.filteredGames,
    filteredResults: resultState.filteredResults,
    incompleteGames: queueState.incompleteGames,
    actions: {
      applyAll,
      applyResult,
      cancel,
      chooseCandidate,
      resetQueueFilters: () => {
        setQueueQuery('');
        setMissingProviderFilter('all');
      },
      resetResultFilters: () => {
        setResultQuery('');
        setResultStatusFilter('all');
        setWriteFilter('all');
      },
      setFields,
      setMissingProviderFilter,
      setQueueQuery,
      setResultQuery,
      setResultStatusFilter,
      setSelectedIds,
      setWriteFilter,
      start,
      toggleExpanded,
      toggleField,
      toggleGame,
    },
  };
}

async function metadataForCandidate(candidate: MetadataSearchResult): Promise<NormalizedMetadata> {
  return api.getMetadataDetail(candidate.provider, candidate.id).catch(() => resultToMetadata(candidate));
}
