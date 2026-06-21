import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SettingsSection, SettingsTab } from '@/pages/Settings/SettingsPage';
import type { LibraryFilterPreset } from '@/types/game';
import type { TaskFilterPreset } from '@/types/task';
import { navItems, readInitialView, type View } from './appNavigation';
import { useAppKeyboardShortcuts } from './useAppKeyboardShortcuts';
import { useAppThemeSettings } from './useAppThemeSettings';
import { useStartupDatabaseBackup } from './useStartupDatabaseBackup';
import { useStartupDatabaseBackupDiagnosticExport } from './useStartupDatabaseBackupDiagnosticExport';
import { useStartupUpdater } from './useStartupUpdater';

export function useAppController() {
  const [view, setView] = useState<View>(() => readInitialView());
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [addRequestKey, setAddRequestKey] = useState<number | null>(null);
  const [searchFocusKey, setSearchFocusKey] = useState(0);
  const [libraryFilterToggleKey, setLibraryFilterToggleKey] = useState(0);
  const [librarySearchValue, setLibrarySearchValue] = useState('');
  const topSearchRef = useRef<HTMLInputElement | null>(null);
  const [taskFocusRequest, setTaskFocusRequest] = useState<{ id: string | null; key: number }>({ id: null, key: 0 });
  const [taskFilterPresetRequest, setTaskFilterPresetRequest] = useState<(TaskFilterPreset & { key: number }) | null>(null);
  const [maintenanceFocusRequest, setMaintenanceFocusRequest] = useState<{ section: string | null; key: number }>({ section: null, key: 0 });
  const [libraryFilterPresetRequest, setLibraryFilterPresetRequest] = useState<(LibraryFilterPreset & { key: number }) | null>(null);
  const [metadataQueuePresetRequest, setMetadataQueuePresetRequest] = useState<{ key: number; query?: string; missingProvider?: string }>({ key: 0 });
  const [settingsTabRequest, setSettingsTabRequest] = useState<{ tab: SettingsTab; section?: SettingsSection | null; key: number } | null>(null);

  const title = useMemo(() => navItems.find((item) => item.id === view)?.label ?? 'MikaVN Library', [view]);
  const { accent, previewAccent, previewTheme, resolvedTheme, toggleTheme } = useAppThemeSettings(refreshKey);
  const startupDatabaseBackup = useStartupDatabaseBackup();
  const startupDatabaseBackupDiagnosticExport = useStartupDatabaseBackupDiagnosticExport();
  const startupUpdater = useStartupUpdater();
  const startupUpdateNotice = startupUpdater.notice?.kind === 'available' ? startupUpdater.notice : null;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('mikavn.currentView', view);
    }
  }, [view]);

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  const requestAddGame = useCallback(() => {
    setAddRequestKey((key) => (key ?? 0) + 1);
    setView('library');
  }, []);

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

  const openLibrary = useCallback((preset?: LibraryFilterPreset | null) => {
    if (preset) {
      setLibraryFilterPresetRequest((current) => ({ key: (current?.key ?? 0) + 1, ...preset }));
      setLibrarySearchValue(preset.query ?? '');
    }
    setView('library');
  }, []);

  const openGame = useCallback((id: string) => {
    setSelectedGameId(id);
    setLibrarySearchValue('');
    setLibraryFilterPresetRequest((current) => ({ key: (current?.key ?? 0) + 1 }));
    setView('library');
  }, []);

  const openTasks = useCallback((taskId?: string | null, preset?: TaskFilterPreset | null) => {
    setTaskFocusRequest((current) => ({ id: taskId ?? null, key: current.key + 1 }));
    setTaskFilterPresetRequest((current) => ({ key: (current?.key ?? 0) + 1, ...(preset ?? { statusFilter: 'all', typeFilter: 'all', query: '' }) }));
    setView('tasks');
  }, []);

  const openMaintenance = useCallback((section?: string | null) => {
    setMaintenanceFocusRequest((current) => ({ section: section ?? null, key: current.key + 1 }));
    setView('maintenance');
  }, []);

  const openMetadata = useCallback((preset?: { query?: string; missingProvider?: string } | null) => {
    setMetadataQueuePresetRequest((current) => ({ key: current.key + 1, query: preset?.query ?? '', missingProvider: preset?.missingProvider ?? 'all' }));
    setView('metadata');
  }, []);

  const openScanner = useCallback(() => setView('scanner'), []);
  const openSaves = useCallback(() => setView('saves'), []);

  const openSettings = useCallback((tab?: SettingsTab, section?: SettingsSection | null) => {
    const targetTab = tab ?? (section ? 'local' : undefined);
    if (targetTab) {
      setSettingsTabRequest((current) => ({ tab: targetTab, section: section ?? null, key: (current?.key ?? 0) + 1 }));
    }
    setView('settings');
  }, []);

  const consumeAddRequest = useCallback(() => setAddRequestKey(null), []);

  useAppKeyboardShortcuts({ focusLibrarySearch, refresh, requestAddGame, setView });

  return {
    accent,
    addRequestKey,
    consumeAddRequest,
    focusLibrarySearch,
    libraryFilterPresetRequest,
    libraryFilterToggleKey,
    librarySearchValue,
    maintenanceFocusRequest,
    metadataQueuePresetRequest,
    openGame,
    openLibrary,
    openMaintenance,
    openMetadata,
    openSaves,
    openScanner,
    openSettings,
    openTasks,
    previewAccent,
    previewTheme,
    refresh,
    refreshKey,
    requestAddGame,
    resolvedTheme,
    selectedGameId,
    setSelectedGameId,
    setView,
    settingsTabRequest,
    startupUpdateNotice,
    startupDatabaseBackup,
    ...startupDatabaseBackupDiagnosticExport,
    startupUpdater,
    taskFilterPresetRequest,
    taskFocusRequest,
    title,
    toggleLibraryFilters,
    toggleTheme,
    topSearchRef,
    updateLibrarySearch,
    view,
  };
}
