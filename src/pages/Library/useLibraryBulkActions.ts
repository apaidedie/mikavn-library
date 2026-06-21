import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { api } from '@/services/api';
import type { Game, GameCollection, PlayStatus, UpdateGameInput } from '@/types/game';
import { errorMessage } from '@/utils/errorMessage';
import { formatLibraryBulkConfirmation, formatLibraryBulkSelectionConfirmation, libraryBulkSelectionConfirmThreshold, libraryBulkWriteBatchSize } from './libraryPageModel';

type UseLibraryBulkActionsOptions = {
  onChanged: () => void;
  refreshKey: number;
  setError: (message: string | null) => void;
  setGames: Dispatch<SetStateAction<Game[]>>;
  visibleGames: Game[];
};

export function useLibraryBulkActions({ onChanged, refreshKey, setError, setGames, visibleGames }: UseLibraryBulkActionsOptions) {
  const [collections, setCollections] = useState<GameCollection[]>([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkPlayStatus, setBulkPlayStatus] = useState<PlayStatus>('planned');
  const [bulkCollectionId, setBulkCollectionId] = useState('');
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  useEffect(() => {
    api.listCollections().then(setCollections).catch(() => setCollections([]));
  }, [refreshKey]);

  useEffect(() => {
    const visibleIds = new Set(visibleGames.map((game) => game.id));
    setBulkSelectedIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [visibleGames]);

  const selectedBulkGames = useMemo(() => visibleGames.filter((game) => bulkSelectedIds.has(game.id)), [bulkSelectedIds, visibleGames]);
  const selectedBulkIds = useMemo(() => selectedBulkGames.map((game) => game.id), [selectedBulkGames]);
  const bulkSelectedVisibleCount = selectedBulkGames.length;
  const bulkParsedTags = useMemo(() => parseBulkTags(bulkTagInput), [bulkTagInput]);
  const selectedBulkCollection = collections.find((collection) => collection.id === bulkCollectionId) ?? null;

  const resetBulkState = useCallback(() => {
    setBulkMode(false);
    setBulkSelectedIds(new Set());
    setBulkMessage(null);
  }, []);

  const toggleBulkMode = useCallback(() => {
    setBulkMode((current) => {
      const next = !current;
      if (!next) {
        setBulkSelectedIds(new Set());
        setBulkMessage(null);
      }
      return next;
    });
  }, []);

  const toggleBulkSelection = useCallback((id: string, checked: boolean) => {
    setBulkSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const selectVisibleGames = useCallback(() => {
    if (visibleGames.length >= libraryBulkSelectionConfirmThreshold && !window.confirm(formatLibraryBulkSelectionConfirmation(visibleGames.length))) return;
    setBulkSelectedIds(new Set(visibleGames.map((game) => game.id)));
  }, [visibleGames]);

  const invertVisibleBulkSelection = useCallback(() => {
    const visibleUnselectedCount = visibleGames.filter((game) => !bulkSelectedIds.has(game.id)).length;
    if (visibleUnselectedCount >= libraryBulkSelectionConfirmThreshold && !window.confirm(formatLibraryBulkSelectionConfirmation(visibleUnselectedCount))) return;
    setBulkSelectedIds((current) => {
      const visibleIds = new Set(visibleGames.map((game) => game.id));
      const next = new Set(current);
      for (const id of visibleIds) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return next;
    });
    setBulkMessage(null);
  }, [bulkSelectedIds, visibleGames]);

  const clearBulkSelection = useCallback(() => {
    setBulkSelectedIds(new Set());
    setBulkMessage(null);
  }, []);

  const applyBulkUpdate = useCallback(async (input: UpdateGameInput, label: string) => {
    const ids = selectedBulkIds;
    if (ids.length === 0) return;
    if (!window.confirm(formatLibraryBulkConfirmation(ids.length, label))) return;
    setBulkBusy(true);
    setError(null);
    setBulkMessage(null);
    try {
      const updated = await runLibraryBulkRequests(ids, (id) => api.updateGame(id, input));
      const updatedById = new Map(updated.map((game) => [game.id, game]));
      setGames((current) => current.map((game) => updatedById.get(game.id) ?? game));
      setBulkMessage(`已更新 ${formatCount(updated.length)} 个游戏：${label}。`);
      onChanged();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBulkBusy(false);
    }
  }, [onChanged, selectedBulkIds, setError, setGames]);

  const applyBulkCollection = useCallback(async (action: 'add' | 'remove') => {
    if (!selectedBulkCollection) return;
    const ids = selectedBulkIds;
    if (ids.length === 0) return;
    if (!window.confirm(formatLibraryBulkConfirmation(ids.length, `${action === 'add' ? '加入' : '移出'}合集：${selectedBulkCollection.name}`))) return;
    setBulkBusy(true);
    setError(null);
    setBulkMessage(null);
    try {
      if (action === 'add') {
        await runLibraryBulkRequests(ids, (id) => api.addGameToCollection(selectedBulkCollection.id, id));
      } else {
        await runLibraryBulkRequests(ids, (id) => api.removeGameFromCollection(selectedBulkCollection.id, id));
      }
      setBulkMessage(`已将 ${formatCount(ids.length)} 个游戏${action === 'add' ? '加入' : '移出'}合集：${selectedBulkCollection.name}。`);
      setCollections(await api.listCollections());
      onChanged();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBulkBusy(false);
    }
  }, [onChanged, selectedBulkCollection, selectedBulkIds, setError]);

  const applyBulkTags = useCallback(async (action: 'add' | 'remove') => {
    const tags = bulkParsedTags;
    if (selectedBulkGames.length === 0 || tags.length === 0) return;
    if (!window.confirm(formatLibraryBulkConfirmation(selectedBulkGames.length, `${action === 'add' ? '添加' : '移除'}标签：${tags.join('、')}`))) return;
    setBulkBusy(true);
    setError(null);
    setBulkMessage(null);
    try {
      const updated = await runLibraryBulkRequests(selectedBulkGames, (game) => api.updateGame(game.id, {
        tags: action === 'add' ? addTags(game.tags, tags) : removeTags(game.tags, tags),
      }));
      const updatedById = new Map(updated.map((game) => [game.id, game]));
      setGames((current) => current.map((game) => updatedById.get(game.id) ?? game));
      setBulkMessage(`已为 ${formatCount(updated.length)} 个游戏${action === 'add' ? '添加' : '移除'}标签：${tags.join('、')}。`);
      onChanged();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBulkBusy(false);
    }
  }, [bulkParsedTags, onChanged, selectedBulkGames, setError, setGames]);

  return {
    applyBulkCollection,
    applyBulkTags,
    applyBulkUpdate,
    bulkBusy,
    bulkCollectionId,
    bulkMessage,
    bulkMode,
    bulkParsedTags,
    bulkPlayStatus,
    bulkSelectedIds,
    bulkSelectedVisibleCount,
    bulkTagInput,
    clearBulkSelection,
    collections,
    invertVisibleBulkSelection,
    resetBulkState,
    selectedBulkCollection,
    selectVisibleGames,
    setBulkCollectionId,
    setBulkPlayStatus,
    setBulkTagInput,
    toggleBulkMode,
    toggleBulkSelection,
  };
}

async function runLibraryBulkRequests<TItem, TResult>(
  items: TItem[],
  worker: (item: TItem) => Promise<TResult>,
  batchSize = libraryBulkWriteBatchSize,
) {
  const results: TResult[] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    results.push(...await Promise.all(batch.map(worker)));
  }
  return results;
}

function formatCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function parseBulkTags(value: string) {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const item of value.split(/[,，、;；\n]+/)) {
    const tag = item.trim();
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
}

function addTags(current: string[], tags: string[]) {
  const seen = new Set(current.map((item) => item.toLocaleLowerCase()));
  return [...current, ...tags.filter((tag) => {
    const key = tag.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })];
}

function removeTags(current: string[], tags: string[]) {
  const removeKeys = new Set(tags.map((tag) => tag.toLocaleLowerCase()));
  return current.filter((tag) => !removeKeys.has(tag.toLocaleLowerCase()));
}
