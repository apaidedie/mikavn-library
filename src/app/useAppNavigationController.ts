import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { navItems, readInitialView, type View } from './appNavigation';
import { useAppKeyboardShortcuts } from './useAppKeyboardShortcuts';
import { useAppNavigationRequests } from './useAppNavigationRequests';

export function useAppNavigationController() {
  const [view, setView] = useState<View>(() => readInitialView());
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchFocusKey, setSearchFocusKey] = useState(0);
  const [libraryFilterToggleKey, setLibraryFilterToggleKey] = useState(0);
  const [librarySearchValue, setLibrarySearchValue] = useState('');
  const topSearchRef = useRef<HTMLInputElement | null>(null);
  const navigationRequests = useAppNavigationRequests({ setLibrarySearchValue, setView });
  const title = useMemo(() => navItems.find((item) => item.id === view)?.label ?? 'MikaVN Library', [view]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('mikavn.currentView', view);
    }
  }, [view]);

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  const focusLibrarySearch = useCallback(() => {
    setView('library');
    setSearchFocusKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (searchFocusKey === 0) return;
    window.requestAnimationFrame(() => {
      topSearchRef.current?.focus();
      topSearchRef.current?.select();
    });
  }, [searchFocusKey]);

  const toggleLibraryFilters = useCallback(() => {
    setView('library');
    setLibraryFilterToggleKey((key) => key + 1);
  }, []);

  const updateLibrarySearch = useCallback((value: string) => {
    setLibrarySearchValue(value);
    setView('library');
  }, []);

  useAppKeyboardShortcuts({ focusLibrarySearch, refresh, requestAddGame: navigationRequests.requestAddGame, setView });
  return {
    focusLibrarySearch,
    libraryFilterToggleKey,
    librarySearchValue,
    refresh,
    refreshKey,
    setView,
    title,
    toggleLibraryFilters,
    topSearchRef,
    updateLibrarySearch,
    view,
    ...navigationRequests,
  };
}
