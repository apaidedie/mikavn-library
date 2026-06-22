import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/services/api';
import type { DuplicateExternalIdGroup, DuplicateGameMergePreview } from '@/types/metadata';
import { errorMessage } from '@/utils/errorMessage';
import { duplicateGroupKey, formatCount, recommendDuplicateMergeTarget } from './MaintenancePageParts';

type TaskMessage = { text: string; taskId?: string | null };

type UseMaintenanceDuplicateMergeActionsOptions = {
  loadDiagnostics: () => Promise<void>;
  setError: (message: string | null) => void;
  setMessage: (message: TaskMessage | null) => void;
};

export function useMaintenanceDuplicateMergeActions({ loadDiagnostics, setError, setMessage }: UseMaintenanceDuplicateMergeActionsOptions) {
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateExternalIdGroup[]>([]);
  const [duplicateGroupsLoading, setDuplicateGroupsLoading] = useState(false);
  const [duplicateGroupQuery, setDuplicateGroupQuery] = useState('');
  const [duplicateGroupProvider, setDuplicateGroupProvider] = useState('all');
  const [selectedDuplicateKey, setSelectedDuplicateKey] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergePreview, setMergePreview] = useState<DuplicateGameMergePreview | null>(null);
  const [mergeLoading, setMergeLoading] = useState(false);

  const filteredDuplicateGroups = useMemo(() => duplicateGroups.filter((group) => {
    const query = duplicateGroupQuery.trim().toLowerCase();
    const matchesProvider = duplicateGroupProvider === 'all' || group.provider === duplicateGroupProvider;
    const matchesQuery = !query
      || group.externalId.toLowerCase().includes(query)
      || group.provider.toLowerCase().includes(query)
      || group.games.some((game) => [game.title, game.installPath].some((value) => value.toLowerCase().includes(query)));
    return matchesProvider && matchesQuery;
  }), [duplicateGroupProvider, duplicateGroupQuery, duplicateGroups]);
  const selectedDuplicateGroup = useMemo(() => filteredDuplicateGroups.find((group) => duplicateGroupKey(group) === selectedDuplicateKey) ?? filteredDuplicateGroups[0] ?? null, [filteredDuplicateGroups, selectedDuplicateKey]);
  const recommendedMergeTargetId = useMemo(() => recommendDuplicateMergeTarget(selectedDuplicateGroup), [selectedDuplicateGroup]);
  const mergeSourceIds = useMemo(() => selectedDuplicateGroup?.games.map((game) => game.gameId).filter((id) => id !== mergeTargetId) ?? [], [mergeTargetId, selectedDuplicateGroup]);
  const duplicateGroupFiltersActive = duplicateGroupQuery.trim().length > 0 || duplicateGroupProvider !== 'all';

  useEffect(() => {
    if (!selectedDuplicateGroup) {
      setMergeTargetId('');
      setMergePreview(null);
      return;
    }
    if (!selectedDuplicateKey || !filteredDuplicateGroups.some((group) => duplicateGroupKey(group) === selectedDuplicateKey)) setSelectedDuplicateKey(duplicateGroupKey(selectedDuplicateGroup));
    if (!mergeTargetId || !selectedDuplicateGroup.games.some((game) => game.gameId === mergeTargetId)) {
      setMergeTargetId(recommendedMergeTargetId ?? selectedDuplicateGroup.games[0]?.gameId ?? '');
    }
    setMergePreview(null);
  }, [filteredDuplicateGroups, mergeTargetId, recommendedMergeTargetId, selectedDuplicateGroup, selectedDuplicateKey]);

  const resetDuplicateGroupFilters = useCallback(() => {
    setDuplicateGroupQuery('');
    setDuplicateGroupProvider('all');
    setMergePreview(null);
  }, []);

  const loadDuplicateGroups = useCallback(async (announceEmpty = true) => {
    setDuplicateGroupsLoading(true);
    setError(null);
    try {
      const preview = await api.previewDuplicateExternalIds({ providers: ['all'], limit: 50 });
      setDuplicateGroups(preview.groups);
      const first = preview.groups[0] ?? null;
      setSelectedDuplicateKey(first ? duplicateGroupKey(first) : '');
      setMergeTargetId(first?.games[0]?.gameId ?? '');
      setMergePreview(null);
      if (announceEmpty && preview.totalGroups === 0) setMessage({ text: '没有发现可合并的重复外部 ID 组。' });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setDuplicateGroupsLoading(false);
    }
  }, [setError, setMessage]);

  const previewDuplicateMerge = useCallback(async () => {
    if (!selectedDuplicateGroup || !mergeTargetId || mergeSourceIds.length === 0) return;
    setMergeLoading(true);
    setError(null);
    setMessage(null);
    try {
      const preview = await api.previewDuplicateGameMerge({ targetGameId: mergeTargetId, sourceGameIds: mergeSourceIds });
      setMergePreview(preview);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setMergeLoading(false);
    }
  }, [mergeSourceIds, mergeTargetId, selectedDuplicateGroup, setError, setMessage]);

  const mergeDuplicateGroup = useCallback(async () => {
    if (!mergePreview || !selectedDuplicateGroup || !mergeTargetId || mergeSourceIds.length === 0) return;
    const target = selectedDuplicateGroup.games.find((game) => game.gameId === mergeTargetId);
    if (!window.confirm(`把 ${mergeSourceIds.length} 条重复游戏并入「${target?.title ?? mergeTargetId}」？\n\n只会删除 MikaVN 数据库中的源游戏记录，不会删除真实游戏文件或游戏目录；关联数据会先迁移到保留记录。确认继续？`)) return;
    setMergeLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.mergeDuplicateGames({ targetGameId: mergeTargetId, sourceGameIds: mergeSourceIds });
      const successText = `已合并重复游戏：删除 ${formatCount(result.deletedSourceGameIds.length)} 条源记录，保留「${result.mergedGame.title}」。`;
      setMessage({ text: successText });
      setMergePreview(null);
      await loadDiagnostics();
      await loadDuplicateGroups(false);
      setMessage({ text: successText });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setMergeLoading(false);
    }
  }, [loadDiagnostics, loadDuplicateGroups, mergePreview, mergeSourceIds, mergeTargetId, selectedDuplicateGroup, setError, setMessage]);

  const updateDuplicateGroupProvider = useCallback((value: string) => {
    setDuplicateGroupProvider(value);
    setMergePreview(null);
  }, []);

  const updateDuplicateGroupQuery = useCallback((value: string) => {
    setDuplicateGroupQuery(value);
    setMergePreview(null);
  }, []);

  const updateMergeTarget = useCallback((gameId: string) => {
    setMergeTargetId(gameId);
    setMergePreview(null);
  }, []);

  const updateSelectedDuplicateKey = useCallback((value: string) => {
    setSelectedDuplicateKey(value);
    setMergePreview(null);
  }, []);

  return {
    duplicateGroupFiltersActive,
    duplicateGroupProvider,
    duplicateGroupQuery,
    duplicateGroups,
    duplicateGroupsLoading,
    filteredDuplicateGroups,
    loadDuplicateGroups,
    mergeDuplicateGroup,
    mergeLoading,
    mergePreview,
    mergeSourceIds,
    mergeTargetId,
    previewDuplicateMerge,
    recommendedMergeTargetId,
    resetDuplicateGroupFilters,
    selectedDuplicateGroup,
    selectedDuplicateKey,
    updateDuplicateGroupProvider,
    updateDuplicateGroupQuery,
    updateMergeTarget,
    updateSelectedDuplicateKey,
  };
}
