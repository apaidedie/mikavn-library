import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SettingsTab } from '@/pages/Settings/SettingsPage';
import { api } from '@/services/api';
import type { LibraryFilterPreset } from '@/types/game';
import type { TaskFilterPreset } from '@/types/task';
import { AppChrome } from './AppChrome';
import { AppRoutes } from './AppRoutes';
import { navItems, readInitialView, type View } from './appNavigation';

type ThemeMode = 'dark' | 'light' | 'system';

export function App() {
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
  const [settingsTabRequest, setSettingsTabRequest] = useState<{ tab: SettingsTab; key: number } | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => typeof window === 'undefined' ? true : window.matchMedia('(prefers-color-scheme: dark)').matches);

  const title = useMemo(() => navItems.find((item) => item.id === view)?.label ?? 'MikaVN Library', [view]);
  const accentId = settings.ui_accent_color ?? 'vnite';
  const accent = accentThemes[accentId] ?? accentThemes.vnite;
  const themeMode = (settings.ui_theme_mode === 'light' || settings.ui_theme_mode === 'system' ? settings.ui_theme_mode : 'dark') satisfies ThemeMode;
  const resolvedTheme: 'dark' | 'light' = themeMode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : themeMode;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemPrefersDark(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('mikavn.currentView', view);
    }
  }, [view]);

  useEffect(() => {
    api.getAppSettings()
      .then(async (next) => {
        const shouldMigrateToVnite = next.ui_vnite_theme_migrated !== 'true';
        if (!shouldMigrateToVnite) {
          setSettings(next);
          return;
        }

        const migrated = { ...next, ui_accent_color: 'vnite', ui_vnite_theme_migrated: 'true' };
        setSettings(migrated);
        await api.setAppSettings(migrated);
      })
      .catch(() => setSettings({ ui_accent_color: 'vnite', ui_theme_mode: 'dark' }));
  }, [refreshKey]);

  const refresh = () => setRefreshKey((key) => key + 1);
  const previewAccent = useCallback((uiAccentColor: string) => {
    setSettings((current) => ({ ...current, ui_accent_color: uiAccentColor, ui_vnite_theme_migrated: 'true' }));
  }, []);

  const previewTheme = useCallback((uiThemeMode: string) => {
    setSettings((current) => ({ ...current, ui_theme_mode: uiThemeMode }));
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    const nextSettings = { ...settings, ui_theme_mode: nextTheme, ui_vnite_theme_migrated: 'true' };
    setSettings(nextSettings);
    void api.setAppSettings(nextSettings).catch(() => undefined);
  }, [resolvedTheme, settings]);

  const requestAddGame = () => {
    setAddRequestKey((key) => (key ?? 0) + 1);
    setView('library');
  };

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

  const openScanner = useCallback(() => {
    setView('scanner');
  }, []);

  const openSaves = useCallback(() => {
    setView('saves');
  }, []);

  const openSettings = useCallback((tab?: SettingsTab) => {
    if (tab) {
      setSettingsTabRequest((current) => ({ tab, key: (current?.key ?? 0) + 1 }));
    }
    setView('settings');
  }, []);

  useEffect(() => {
    const isEditingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return target.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select';
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const editing = isEditingTarget(event.target);
      const navIndex = Number(event.key) - 1;
      if ((event.altKey || event.ctrlKey) && navIndex >= 0 && navIndex < navItems.length) {
        event.preventDefault();
        setView(navItems[navIndex].id);
        return;
      }

      if (!editing && event.key === '/') {
        event.preventDefault();
        focusLibrarySearch();
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        focusLibrarySearch();
        return;
      }

      if (!editing && event.ctrlKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        requestAddGame();
        return;
      }

      if (!editing && event.ctrlKey && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        refresh();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusLibrarySearch]);

  return (
    <AppChrome
      accent={accent}
      librarySearchValue={librarySearchValue}
      onFocusLibrarySearch={focusLibrarySearch}
      onRefresh={refresh}
      onRequestAddGame={requestAddGame}
      onSetView={setView}
      onToggleLibraryFilters={toggleLibraryFilters}
      onToggleTheme={toggleTheme}
      onUpdateLibrarySearch={updateLibrarySearch}
      resolvedTheme={resolvedTheme}
      title={title}
      topSearchRef={topSearchRef}
      view={view}
    >
      <AppRoutes
        addRequestKey={addRequestKey}
        filterToggleKey={libraryFilterToggleKey}
        libraryFilterPresetRequest={libraryFilterPresetRequest}
        librarySearchValue={librarySearchValue}
        maintenanceFocusRequest={maintenanceFocusRequest}
        metadataQueuePresetRequest={metadataQueuePresetRequest}
        onAccentPreview={previewAccent}
        onAddGame={requestAddGame}
        onAddRequestConsumed={() => setAddRequestKey(null)}
        onChanged={refresh}
        onOpenGame={openGame}
        onOpenLibrary={openLibrary}
        onOpenMaintenance={openMaintenance}
        onOpenMetadata={openMetadata}
        onOpenSaves={openSaves}
        onOpenScanner={openScanner}
        onOpenSettings={openSettings}
        onOpenTasks={openTasks}
        onThemePreview={previewTheme}
        refreshKey={refreshKey}
        selectedGameId={selectedGameId}
        setSelectedGameId={setSelectedGameId}
        settingsTabRequest={settingsTabRequest}
        taskFilterPresetRequest={taskFilterPresetRequest}
        taskFocusRequest={taskFocusRequest}
        view={view}
      />
    </AppChrome>
  );
}

const accentThemes: Record<string, { rgb: string; strongRgb: string; contrast: string }> = {
  vnite: { rgb: '91 118 183', strongRgb: '74 101 168', contrast: '#f8fbff' },
  rose: { rgb: '251 113 133', strongRgb: '244 63 94', contrast: '#fff7f8' },
  teal: { rgb: '94 234 212', strongRgb: '45 212 191', contrast: '#020617' },
  blue: { rgb: '125 211 252', strongRgb: '56 189 248', contrast: '#020617' },
  amber: { rgb: '252 211 77', strongRgb: '245 158 11', contrast: '#17130a' },
};
