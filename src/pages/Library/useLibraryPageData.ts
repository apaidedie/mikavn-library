import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { api } from '@/services/api';
import type { Game, LibraryFilterPreset } from '@/types/game';
import { errorMessage } from '@/utils/errorMessage';
import { useLibraryFilters } from './useLibraryFilters';

type UseLibraryPageDataOptions = {
  filterPreset?: (LibraryFilterPreset & { key: number }) | null;
  filterToggleKey: number;
  refreshKey: number;
  toolbarQuery?: string;
};

type UseLibraryPageDataResult = {
  error: string | null;
  filters: ReturnType<typeof useLibraryFilters>;
  loading: boolean;
  setError: (message: string | null) => void;
  setGames: Dispatch<SetStateAction<Game[]>>;
  settings: Record<string, string>;
};

export function useLibraryPageData({ filterPreset, filterToggleKey, refreshKey, toolbarQuery }: UseLibraryPageDataOptions): UseLibraryPageDataResult {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const filters = useLibraryFilters({ filterPreset, filterToggleKey, games, settings, toolbarQuery });

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    api
      .listGames(filters.filter)
      .then((items) => {
        if (cancelled) return;
        setGames(items);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(errorMessage(reason));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filters.filter, refreshKey]);

  useEffect(() => {
    let cancelled = false;

    api
      .getAppSettings()
      .then((nextSettings) => {
        if (cancelled) return;
        setSettings(nextSettings);
      })
      .catch(() => {
        if (cancelled) return;
        setSettings({});
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return { error, filters, loading, setError, setGames, settings };
}
