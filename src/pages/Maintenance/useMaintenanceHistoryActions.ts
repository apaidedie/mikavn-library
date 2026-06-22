import { useCallback, useRef, useState } from 'react';
import { api } from '@/services/api';
import type { Game } from '@/types/game';
import { errorMessage } from '@/utils/errorMessage';
import { summarizeArtworkRepairTask, type ArtworkRepairTaskSummary } from './ArtworkRepairResultPanel';
import type { BatchMatchHistorySummary } from './BatchMatchResultPanel';
import { collectDescriptionImageRepairSourceLookups, summarizeDescriptionImageRepairTask, type DescriptionImageRepairSourceLookup, type DescriptionImageRepairTaskSummary } from './DescriptionImageRepairResultPanel';
import { summarizeDuplicateAuditTask, type DuplicateAuditTaskSummary } from './DuplicateAuditResultPanel';
import { formatCount } from './MaintenancePageParts';

type TaskMessage = { text: string; taskId?: string | null };

type UseMaintenanceHistoryActionsOptions = {
  setError: (message: string | null) => void;
  setMessage: (message: TaskMessage | null) => void;
};

export function useMaintenanceHistoryActions({ setError, setMessage }: UseMaintenanceHistoryActionsOptions) {
  const batchMatchHistoryLoadedRef = useRef(false);
  const artworkHistoryLoadedRef = useRef(false);
  const descriptionHistoryLoadedRef = useRef(false);
  const duplicateAuditHistoryLoadedRef = useRef(false);
  const [artworkHistory, setArtworkHistory] = useState<ArtworkRepairTaskSummary[] | null>(null);
  const [artworkHistoryLoading, setArtworkHistoryLoading] = useState(false);
  const [artworkHistoryQuery, setArtworkHistoryQuery] = useState('');
  const [artworkHistoryStatusFilter, setArtworkHistoryStatusFilter] = useState('all');
  const [descriptionHistory, setDescriptionHistory] = useState<DescriptionImageRepairTaskSummary[] | null>(null);
  const [descriptionHistoryLoading, setDescriptionHistoryLoading] = useState(false);
  const [descriptionHistoryQuery, setDescriptionHistoryQuery] = useState('');
  const [descriptionHistoryStatusFilter, setDescriptionHistoryStatusFilter] = useState('all');
  const [descriptionHistoryProviderFilter, setDescriptionHistoryProviderFilter] = useState('all');
  const [batchMatchHistory, setBatchMatchHistory] = useState<BatchMatchHistorySummary[] | null>(null);
  const [batchMatchHistoryLoading, setBatchMatchHistoryLoading] = useState(false);
  const [batchMatchHistoryQuery, setBatchMatchHistoryQuery] = useState('');
  const [batchMatchHistoryStatusFilter, setBatchMatchHistoryStatusFilter] = useState('all');
  const [duplicateAuditHistory, setDuplicateAuditHistory] = useState<DuplicateAuditTaskSummary[] | null>(null);
  const [duplicateAuditHistoryLoading, setDuplicateAuditHistoryLoading] = useState(false);
  const [duplicateAuditHistoryQuery, setDuplicateAuditHistoryQuery] = useState('');
  const [duplicateAuditHistoryProvider, setDuplicateAuditHistoryProvider] = useState('all');

  const loadArtworkHistory = useCallback(async (options?: { quiet?: boolean }) => {
    if (!options?.quiet) setArtworkHistoryLoading(true);
    if (!options?.quiet) setError(null);
    try {
      const tasks = (await api.listTasks(100)).filter((task) => task.taskType === 'metadata.artwork_repair').slice(0, 5);
      const summaries = await Promise.all(tasks.map(async (task) => summarizeArtworkRepairTask(await api.getTaskDetail(task.id))));
      setArtworkHistory(summaries);
      artworkHistoryLoadedRef.current = true;
      if (!options?.quiet) setMessage({ text: summaries.length > 0 ? `已读取 ${formatCount(summaries.length)} 个媒体补全任务结果。` : '还没有媒体图片补全任务记录。' });
    } catch (reason) {
      if (!options?.quiet) setError(errorMessage(reason));
    } finally {
      if (!options?.quiet) setArtworkHistoryLoading(false);
    }
  }, [setError, setMessage]);

  const loadBatchMatchHistory = useCallback(async (options?: { quiet?: boolean }) => {
    if (!options?.quiet) setBatchMatchHistoryLoading(true);
    if (!options?.quiet) setError(null);
    try {
      const tasks = (await api.listTasks(100)).filter((task) => task.taskType === 'metadata.batch_match').slice(0, 5);
      const summaries = await Promise.all(tasks.map(async (task) => {
        const status = await api.getBatchMatchStatus(task.id).catch(() => null);
        return { task, status, results: status?.results ?? [] };
      }));
      setBatchMatchHistory(summaries);
      batchMatchHistoryLoadedRef.current = true;
      if (!options?.quiet) setMessage({ text: summaries.length > 0 ? `已读取 ${formatCount(summaries.length)} 个批量匹配任务结果。` : '还没有批量匹配任务记录。' });
    } catch (reason) {
      if (!options?.quiet) setError(errorMessage(reason));
    } finally {
      if (!options?.quiet) setBatchMatchHistoryLoading(false);
    }
  }, [setError, setMessage]);

  const loadDescriptionRepairHistory = useCallback(async (options?: { quiet?: boolean }) => {
    if (!options?.quiet) setDescriptionHistoryLoading(true);
    if (!options?.quiet) setError(null);
    try {
      const tasks = (await api.listTasks(100)).filter((task) => task.taskType === 'metadata.description_image_repair').slice(0, 5);
      const details = await Promise.all(tasks.map(async (task) => api.getTaskDetail(task.id)));
      const sourceLookups = uniqueDescriptionSourceLookups(details.flatMap((detail) => collectDescriptionImageRepairSourceLookups(detail.logs)));
      const gameGroups = await Promise.all(sourceLookups.map((lookup) => api.listGames({ externalProvider: lookup.provider, externalId: lookup.providerId, sortBy: 'updated_at', sortDirection: 'desc', limit: 5 })));
      const games = uniqueDescriptionSourceGames(gameGroups.flat());
      const summaries = details.map((detail) => summarizeDescriptionImageRepairTask(detail, games));
      setDescriptionHistory(summaries);
      descriptionHistoryLoadedRef.current = true;
      if (!options?.quiet) setMessage({ text: summaries.length > 0 ? `已读取 ${formatCount(summaries.length)} 个简介图片修复任务结果。` : '还没有简介图片修复任务记录。' });
    } catch (reason) {
      if (!options?.quiet) setError(errorMessage(reason));
    } finally {
      if (!options?.quiet) setDescriptionHistoryLoading(false);
    }
  }, [setError, setMessage]);

  const loadDuplicateAuditHistory = useCallback(async (options?: { quiet?: boolean }) => {
    if (!options?.quiet) setDuplicateAuditHistoryLoading(true);
    if (!options?.quiet) setError(null);
    try {
      const tasks = (await api.listTasks(100)).filter((task) => task.taskType === 'metadata.duplicate_id_audit').slice(0, 5);
      const summaries = await Promise.all(tasks.map(async (task) => summarizeDuplicateAuditTask(await api.getTaskDetail(task.id))));
      setDuplicateAuditHistory(summaries);
      duplicateAuditHistoryLoadedRef.current = true;
      if (!options?.quiet) setMessage({ text: summaries.length > 0 ? `已读取 ${formatCount(summaries.length)} 个重复 ID 审查任务结果。` : '还没有重复 ID 审查任务记录。' });
    } catch (reason) {
      if (!options?.quiet) setError(errorMessage(reason));
    } finally {
      if (!options?.quiet) setDuplicateAuditHistoryLoading(false);
    }
  }, [setError, setMessage]);

  const refreshHistoryForTaskType = useCallback(async (taskType: string, options?: { onlyIfLoaded?: boolean }) => {
    if (taskType === 'metadata.batch_match') {
      if (options?.onlyIfLoaded && !batchMatchHistoryLoadedRef.current) return false;
      await loadBatchMatchHistory({ quiet: true });
      return true;
    }
    if (taskType === 'metadata.description_image_repair') {
      if (options?.onlyIfLoaded && !descriptionHistoryLoadedRef.current) return false;
      await loadDescriptionRepairHistory({ quiet: true });
      return true;
    }
    if (taskType === 'metadata.artwork_repair') {
      if (options?.onlyIfLoaded && !artworkHistoryLoadedRef.current) return false;
      await loadArtworkHistory({ quiet: true });
      return true;
    }
    if (taskType === 'metadata.duplicate_id_audit') {
      if (options?.onlyIfLoaded && !duplicateAuditHistoryLoadedRef.current) return false;
      await loadDuplicateAuditHistory({ quiet: true });
      return true;
    }
    return false;
  }, [loadArtworkHistory, loadBatchMatchHistory, loadDescriptionRepairHistory, loadDuplicateAuditHistory]);

  const resetArtworkHistoryFilters = useCallback(() => {
    setArtworkHistoryQuery('');
    setArtworkHistoryStatusFilter('all');
  }, []);

  const resetBatchMatchHistoryFilters = useCallback(() => {
    setBatchMatchHistoryQuery('');
    setBatchMatchHistoryStatusFilter('all');
  }, []);

  const resetDescriptionHistoryFilters = useCallback(() => {
    setDescriptionHistoryQuery('');
    setDescriptionHistoryStatusFilter('all');
    setDescriptionHistoryProviderFilter('all');
  }, []);

  const resetDuplicateAuditHistoryFilters = useCallback(() => {
    setDuplicateAuditHistoryQuery('');
    setDuplicateAuditHistoryProvider('all');
  }, []);

  return {
    artworkHistory,
    artworkHistoryLoading,
    artworkHistoryQuery,
    artworkHistoryStatusFilter,
    batchMatchHistory,
    batchMatchHistoryLoading,
    batchMatchHistoryQuery,
    batchMatchHistoryStatusFilter,
    descriptionHistory,
    descriptionHistoryLoading,
    descriptionHistoryProviderFilter,
    descriptionHistoryQuery,
    descriptionHistoryStatusFilter,
    duplicateAuditHistory,
    duplicateAuditHistoryLoading,
    duplicateAuditHistoryProvider,
    duplicateAuditHistoryQuery,
    loadArtworkHistory,
    loadBatchMatchHistory,
    loadDescriptionRepairHistory,
    loadDuplicateAuditHistory,
    refreshHistoryForTaskType,
    resetArtworkHistoryFilters,
    resetBatchMatchHistoryFilters,
    resetDescriptionHistoryFilters,
    resetDuplicateAuditHistoryFilters,
    setArtworkHistoryQuery,
    setArtworkHistoryStatusFilter,
    setBatchMatchHistoryQuery,
    setBatchMatchHistoryStatusFilter,
    setDescriptionHistoryProviderFilter,
    setDescriptionHistoryQuery,
    setDescriptionHistoryStatusFilter,
    setDuplicateAuditHistoryProvider,
    setDuplicateAuditHistoryQuery,
  };
}

function uniqueDescriptionSourceLookups(lookups: DescriptionImageRepairSourceLookup[]) {
  const seen = new Set<string>();
  const unique: DescriptionImageRepairSourceLookup[] = [];
  for (const lookup of lookups) {
    const key = `${lookup.provider.trim().toLowerCase()}:${lookup.providerId.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(lookup);
  }
  return unique;
}

function uniqueDescriptionSourceGames(games: Game[]) {
  const seen = new Set<string>();
  const unique: Game[] = [];
  for (const game of games) {
    if (seen.has(game.id)) continue;
    seen.add(game.id);
    unique.push(game);
  }
  return unique;
}
