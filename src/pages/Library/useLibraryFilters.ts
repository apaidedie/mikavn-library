import { useEffect, useMemo, useState } from 'react';
import type { Game, GameFilter, LibraryFilterPreset, PlayStatus } from '@/types/game';

type UseLibraryFiltersOptions = {
  filterPreset?: (LibraryFilterPreset & { key: number }) | null;
  filterToggleKey: number;
  games: Game[];
  settings: Record<string, string>;
  toolbarQuery?: string;
};

function useDebouncedValue<T>(value: T, delayMs = 180) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debounced;
}

export function useLibraryFilters({ filterPreset, filterToggleKey, games, settings, toolbarQuery }: UseLibraryFiltersOptions) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<PlayStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<GameFilter['sortBy']>('updated_at');
  const [tag, setTag] = useState('');
  const [developer, setDeveloper] = useState('');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [hiddenFilter, setHiddenFilter] = useState<'all' | 'visible' | 'hidden'>('all');
  const [metadataStatus, setMetadataStatus] = useState('all');
  const [pathStatus, setPathStatus] = useState('all');
  const [collectionId, setCollectionId] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query);
  const debouncedTag = useDebouncedValue(tag);
  const debouncedDeveloper = useDebouncedValue(developer);

  const filter = useMemo<GameFilter>(() => ({
    query: debouncedQuery,
    status,
    tag: debouncedTag.trim() || undefined,
    developer: debouncedDeveloper.trim() || undefined,
    favorite: favoriteOnly ? true : undefined,
    hidden: hiddenFilter === 'all' ? undefined : hiddenFilter === 'hidden',
    metadataStatus: metadataStatus === 'all' ? undefined : metadataStatus,
    pathStatus: pathStatus === 'all' ? undefined : pathStatus,
    collectionId: collectionId || undefined,
    sortBy,
    sortDirection: sortBy === 'title' ? 'asc' : 'desc',
  }), [collectionId, debouncedDeveloper, debouncedQuery, debouncedTag, favoriteOnly, hiddenFilter, metadataStatus, pathStatus, sortBy, status]);

  const visibleGames = useMemo(() => settings.privacy_hide_hidden === 'true' && hiddenFilter !== 'hidden' ? games.filter((game) => !game.hidden) : games, [games, hiddenFilter, settings.privacy_hide_hidden]);
  const activeAdvancedCount = [tag.trim(), developer.trim(), favoriteOnly, hiddenFilter !== 'all', metadataStatus !== 'all', pathStatus !== 'all', collectionId].filter(Boolean).length;

  useEffect(() => {
    if (filterToggleKey === 0) return;
    setAdvancedOpen((value) => !value);
  }, [filterToggleKey]);

  useEffect(() => {
    if (toolbarQuery == null || toolbarQuery === query) return;
    setQuery(toolbarQuery);
  }, [query, toolbarQuery]);

  useEffect(() => {
    if (!filterPreset) return;
    setQuery(filterPreset.query ?? '');
    setStatus(filterPreset.status ?? 'all');
    setSortBy(filterPreset.sortBy ?? 'updated_at');
    setTag(filterPreset.tag ?? '');
    setDeveloper(filterPreset.developer ?? '');
    setFavoriteOnly(filterPreset.favorite === true);
    setHiddenFilter(filterPreset.hidden === true ? 'hidden' : filterPreset.hidden === false ? 'visible' : 'all');
    setMetadataStatus(filterPreset.metadataStatus ?? 'all');
    setPathStatus(filterPreset.pathStatus ?? 'all');
    setCollectionId(filterPreset.collectionId ?? '');
    setAdvancedOpen(true);
  }, [filterPreset]);

  const clearAdvancedFilters = () => {
    setTag('');
    setDeveloper('');
    setFavoriteOnly(false);
    setHiddenFilter('all');
    setMetadataStatus('all');
    setPathStatus('all');
    setCollectionId('');
  };

  return {
    activeAdvancedCount,
    advancedOpen,
    clearAdvancedFilters,
    collectionId,
    developer,
    favoriteOnly,
    filter,
    hiddenFilter,
    metadataStatus,
    pathStatus,
    query,
    setAdvancedOpen,
    setCollectionId,
    setDeveloper,
    setFavoriteOnly,
    setHiddenFilter,
    setMetadataStatus,
    setPathStatus,
    setQuery,
    setSortBy,
    setStatus,
    setTag,
    sortBy,
    status,
    tag,
    visibleGames,
  };
}
