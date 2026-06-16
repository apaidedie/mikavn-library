import { Archive, ArrowLeft, ArrowRight, BarChart3, Cloud, DatabaseZap, FolderSearch, Grid2X2, Home, Layers3, LibraryBig, ListTodo, Moon, Plus, RefreshCw, Search, SearchCheck, Settings, SlidersHorizontal, Sun, Wrench } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/services/api';
import type { LibraryFilterPreset } from '@/types/game';
import type { TaskFilterPreset } from '@/types/task';
import { cn } from '@/utils/cn';

type View = 'dashboard' | 'library' | 'collections' | 'advanced-search' | 'scanner' | 'metadata' | 'tasks' | 'reports' | 'saves' | 'maintenance' | 'settings';
type ThemeMode = 'dark' | 'light' | 'system';

const DashboardPage = lazy(() => import('@/pages/Dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const LibraryPage = lazy(() => import('@/pages/Library/LibraryPage').then((module) => ({ default: module.LibraryPage })));
const CollectionsPage = lazy(() => import('@/pages/Collections/CollectionsPage').then((module) => ({ default: module.CollectionsPage })));
const AdvancedSearchPage = lazy(() => import('@/pages/Search/AdvancedSearchPage').then((module) => ({ default: module.AdvancedSearchPage })));
const ScannerPage = lazy(() => import('@/pages/Scanner/ScannerPage').then((module) => ({ default: module.ScannerPage })));
const BatchMetadataPage = lazy(() => import('@/pages/Metadata/BatchMetadataPage').then((module) => ({ default: module.BatchMetadataPage })));
const TasksPage = lazy(() => import('@/pages/Tasks/TasksPage').then((module) => ({ default: module.TasksPage })));
const ReportsPage = lazy(() => import('@/pages/Reports/ReportsPage').then((module) => ({ default: module.ReportsPage })));
const SavesPage = lazy(() => import('@/pages/Saves/SavesPage').then((module) => ({ default: module.SavesPage })));
const MaintenancePage = lazy(() => import('@/pages/Maintenance/MaintenancePage').then((module) => ({ default: module.MaintenancePage })));
const SettingsPage = lazy(() => import('@/pages/Settings/SettingsPage').then((module) => ({ default: module.SettingsPage })));

const navItems = [
  { id: 'dashboard', label: '首页', icon: Home },
  { id: 'library', label: '游戏库', icon: LibraryBig },
  { id: 'collections', label: '合集', icon: Layers3 },
  { id: 'advanced-search', label: '高级搜索', icon: SearchCheck },
  { id: 'scanner', label: '扫描入库', icon: FolderSearch },
  { id: 'metadata', label: '批量匹配', icon: DatabaseZap },
  { id: 'tasks', label: '任务', icon: ListTodo },
  { id: 'reports', label: '报告', icon: BarChart3 },
  { id: 'saves', label: '存档', icon: Archive },
  { id: 'maintenance', label: '维护', icon: Wrench },
  { id: 'settings', label: '设置', icon: Settings },
] satisfies Array<{ id: View; label: string; icon: typeof Home }>;

const primaryNavItems = navItems.filter((item) => item.id !== 'settings');
const validViewIds = new Set<View>(navItems.map((item) => item.id));

function readInitialView(): View {
  if (typeof window === 'undefined') return 'library';
  const saved = window.localStorage.getItem('mikavn.currentView');
  return saved && validViewIds.has(saved as View) ? saved as View : 'library';
}

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

  const openSettings = useCallback(() => {
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
    <div className="relative flex h-screen overflow-hidden text-slate-100" data-theme={resolvedTheme} style={{ '--accent-rgb': accent.rgb, '--accent-strong-rgb': accent.strongRgb, '--accent-contrast': accent.contrast } as CSSProperties}>
      <aside className="relative z-10 flex w-14 shrink-0 flex-col justify-between border-r border-white/10 bg-[rgb(var(--rail-rgb)/0.72)] px-[6px] py-2 backdrop-blur-xl">
        <div className="flex flex-col items-center gap-2">
          <button className="motion-button flex h-9 w-9 items-center justify-center rounded-md font-mono text-2xl font-bold text-[rgb(var(--accent-rgb))] hover:bg-white/[0.08]" onClick={() => setView('dashboard')} title="MikaVN" type="button">
            V
          </button>
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={cn(
                  'motion-button flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-white/[0.08] hover:text-slate-100',
                  view === item.id && 'bg-[rgb(var(--accent-rgb)/0.22)] text-slate-100 shadow-sm',
                )}
                onClick={() => setView(item.id)}
                title={item.label}
                type="button"
              >
                <Icon className="h-5 w-5" />
              </button>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-2">
          <Button aria-label="添加游戏" className="h-9 w-9" size="icon" title="添加游戏" variant="ghost" onClick={requestAddGame}>
            <Plus className="h-5 w-5" />
          </Button>
          <button
            className={cn(
              'motion-button flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-white/[0.08] hover:text-slate-100',
              view === 'settings' && 'bg-[rgb(var(--accent-rgb)/0.22)] text-slate-100 shadow-sm',
            )}
            onClick={() => setView('settings')}
            title="设置"
            type="button"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </aside>

      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex h-[50px] shrink-0 items-center justify-between border-b border-white/10 bg-[rgb(var(--topbar-rgb)/0.58)] px-3 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-2">
            <Button aria-label="后退" className="h-8 w-8" size="icon" variant="ghost" disabled>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button aria-label="前进" className="h-8 w-8" size="icon" variant="ghost" disabled>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <div className="relative ml-2 w-[250px] shrink-0">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-500" />
              <input
                ref={topSearchRef}
                aria-label="搜索游戏"
                className="h-8 w-full rounded-md border-0 bg-black/20 pl-8 pr-3 text-sm text-slate-100 outline-none placeholder:italic placeholder:text-slate-500 focus:ring-2 focus:ring-[rgb(var(--accent-rgb)/0.28)]"
                onChange={(event) => updateLibrarySearch(event.target.value)}
                onFocus={focusLibrarySearch}
                placeholder="Search"
                value={librarySearchValue}
              />
            </div>
            <div className="ml-1 flex items-center gap-2">
              <ToolbarButton active={view === 'dashboard'} label="首页" onClick={() => setView('dashboard')}><Home className="h-4 w-4" /></ToolbarButton>
              <ToolbarButton active={view === 'library'} label="游戏库" onClick={() => setView('library')}><Grid2X2 className="h-4 w-4" /></ToolbarButton>
              <ToolbarButton label="筛选" onClick={toggleLibraryFilters}><SlidersHorizontal className="h-4 w-4" /></ToolbarButton>
              <ToolbarButton label="刷新" onClick={refresh}><RefreshCw className="h-4 w-4" /></ToolbarButton>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="mr-2 max-w-36 truncate text-xs text-slate-400">{title}</span>
            <ToolbarButton label={resolvedTheme === 'dark' ? '浅色模式' : '深色模式'} onClick={toggleTheme}>{resolvedTheme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</ToolbarButton>
            <ToolbarButton label="同步状态"><Cloud className="h-4 w-4" /></ToolbarButton>
          </div>
        </header>

        <Suspense fallback={<PageLoading />}>
          <div className="min-h-0 flex-1 overflow-hidden">
            {view === 'dashboard' && (
              <DashboardPage
                refreshKey={refreshKey}
                onOpenGame={openGame}
                onAddGame={requestAddGame}
                onOpenScanner={openScanner}
                onOpenLibrary={openLibrary}
                onOpenMaintenance={openMaintenance}
                onOpenMetadata={openMetadata}
                onOpenSaves={openSaves}
                onOpenSettings={openSettings}
                onOpenTasks={openTasks}
              />
            )}
            {view === 'library' && <LibraryPage refreshKey={refreshKey} selectedGameId={selectedGameId} onSelectedGameChange={setSelectedGameId} onChanged={refresh} addRequestKey={addRequestKey} onAddRequestConsumed={() => setAddRequestKey(null)} filterPreset={libraryFilterPresetRequest} filterToggleKey={libraryFilterToggleKey} toolbarQuery={librarySearchValue} onOpenTasks={openTasks} onOpenMaintenance={openMaintenance} />}
            {view === 'collections' && <CollectionsPage refreshKey={refreshKey} onOpenGame={openGame} onChanged={refresh} />}
            {view === 'advanced-search' && <AdvancedSearchPage refreshKey={refreshKey} onOpenGame={openGame} />}
            {view === 'scanner' && <ScannerPage onOpenTask={openTasks} />}
            {view === 'metadata' && <BatchMetadataPage queuePresetRequest={metadataQueuePresetRequest} refreshKey={refreshKey} onOpenTask={openTasks} />}
            {view === 'tasks' && <TasksPage filterPreset={taskFilterPresetRequest} focusTaskId={taskFocusRequest.id} focusRequestKey={taskFocusRequest.key} refreshKey={refreshKey} />}
            {view === 'reports' && <ReportsPage refreshKey={refreshKey} onOpenGame={openGame} onOpenLibrary={openLibrary} onOpenTask={openTasks} />}
            {view === 'saves' && <SavesPage refreshKey={refreshKey} onOpenTask={openTasks} />}
            {view === 'maintenance' && <MaintenancePage focusRequestKey={maintenanceFocusRequest.key} focusSection={maintenanceFocusRequest.section} refreshKey={refreshKey} onOpenGame={openGame} onOpenLibrary={openLibrary} onOpenMetadata={openMetadata} onOpenTasks={openTasks} />}
            {view === 'settings' && <SettingsPage onAccentPreview={previewAccent} onThemePreview={previewTheme} onSaved={refresh} onOpenTask={openTasks} />}
          </div>
        </Suspense>
      </main>
    </div>
  );
}

function PageLoading() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-slate-400">
      载入页面...
    </div>
  );
}

function ToolbarButton({ active = false, label, onClick, children }: { active?: boolean; label: string; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      aria-label={label}
      className={cn(
        'motion-button flex h-8 w-8 items-center justify-center rounded-md bg-black/15 text-slate-400 shadow-sm hover:bg-white/[0.08] hover:text-slate-100',
        active && 'bg-[rgb(var(--accent-rgb)/0.24)] text-slate-100',
      )}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

const accentThemes: Record<string, { rgb: string; strongRgb: string; contrast: string }> = {
  vnite: { rgb: '91 118 183', strongRgb: '74 101 168', contrast: '#f8fbff' },
  rose: { rgb: '251 113 133', strongRgb: '244 63 94', contrast: '#fff7f8' },
  teal: { rgb: '94 234 212', strongRgb: '45 212 191', contrast: '#020617' },
  blue: { rgb: '125 211 252', strongRgb: '56 189 248', contrast: '#020617' },
  amber: { rgb: '252 211 77', strongRgb: '245 158 11', contrast: '#17130a' },
};
