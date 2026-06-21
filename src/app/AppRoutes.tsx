import { lazy, Suspense } from 'react';
import type { SettingsSection, SettingsTab } from '@/pages/Settings/SettingsPage';
import type { LibraryFilterPreset } from '@/types/game';
import type { TaskFilterPreset } from '@/types/task';
import type { View } from './appNavigation';

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

type AppRoutesProps = {
  addRequestKey: number | null;
  filterToggleKey: number;
  libraryFilterPresetRequest: (LibraryFilterPreset & { key: number }) | null;
  librarySearchValue: string;
  maintenanceFocusRequest: { section: string | null; key: number };
  metadataQueuePresetRequest: { key: number; query?: string; missingProvider?: string };
  onAccentPreview: (uiAccentColor: string) => void;
  onAddGame: () => void;
  onChanged: () => void;
  onOpenGame: (id: string) => void;
  onOpenLibrary: (preset?: LibraryFilterPreset | null) => void;
  onOpenMaintenance: (section?: string | null) => void;
  onOpenMetadata: (preset?: { query?: string; missingProvider?: string } | null) => void;
  onOpenSaves: () => void;
  onOpenScanner: () => void;
  onOpenSettings: (tab?: SettingsTab, section?: SettingsSection | null) => void;
  onOpenTasks: (taskId?: string | null, preset?: TaskFilterPreset | null) => void;
  onThemePreview: (uiThemeMode: string) => void;
  onAddRequestConsumed: () => void;
  refreshKey: number;
  selectedGameId: string | null;
  setSelectedGameId: (id: string | null) => void;
  settingsTabRequest: { tab: SettingsTab; section?: SettingsSection | null; key: number } | null;
  taskFilterPresetRequest: (TaskFilterPreset & { key: number }) | null;
  taskFocusRequest: { id: string | null; key: number };
  view: View;
};

export function AppRoutes({ addRequestKey, filterToggleKey, libraryFilterPresetRequest, librarySearchValue, maintenanceFocusRequest, metadataQueuePresetRequest, onAccentPreview, onAddGame, onAddRequestConsumed, onChanged, onOpenGame, onOpenLibrary, onOpenMaintenance, onOpenMetadata, onOpenSaves, onOpenScanner, onOpenSettings, onOpenTasks, onThemePreview, refreshKey, selectedGameId, setSelectedGameId, settingsTabRequest, taskFilterPresetRequest, taskFocusRequest, view }: AppRoutesProps) {
  return (
    <Suspense fallback={<PageLoading />}>
      <div className="min-h-0 flex-1 overflow-hidden">
        {view === 'dashboard' && <DashboardPage refreshKey={refreshKey} onOpenGame={onOpenGame} onAddGame={onAddGame} onOpenScanner={onOpenScanner} onOpenLibrary={onOpenLibrary} onOpenMaintenance={onOpenMaintenance} onOpenMetadata={onOpenMetadata} onOpenSaves={onOpenSaves} onOpenSettings={onOpenSettings} onOpenTasks={onOpenTasks} />}
        {view === 'library' && <LibraryPage refreshKey={refreshKey} selectedGameId={selectedGameId} onSelectedGameChange={setSelectedGameId} onChanged={onChanged} addRequestKey={addRequestKey} onAddRequestConsumed={onAddRequestConsumed} filterPreset={libraryFilterPresetRequest} filterToggleKey={filterToggleKey} toolbarQuery={librarySearchValue} onOpenTasks={onOpenTasks} onOpenMaintenance={onOpenMaintenance} />}
        {view === 'collections' && <CollectionsPage refreshKey={refreshKey} onOpenGame={onOpenGame} onChanged={onChanged} />}
        {view === 'advanced-search' && <AdvancedSearchPage refreshKey={refreshKey} onOpenGame={onOpenGame} />}
        {view === 'scanner' && <ScannerPage onOpenTask={onOpenTasks} />}
        {view === 'metadata' && <BatchMetadataPage queuePresetRequest={metadataQueuePresetRequest} refreshKey={refreshKey} onOpenTask={onOpenTasks} />}
        {view === 'tasks' && <TasksPage filterPreset={taskFilterPresetRequest} focusTaskId={taskFocusRequest.id} focusRequestKey={taskFocusRequest.key} refreshKey={refreshKey} />}
        {view === 'reports' && <ReportsPage refreshKey={refreshKey} onOpenGame={onOpenGame} onOpenLibrary={onOpenLibrary} onOpenTask={onOpenTasks} />}
        {view === 'saves' && <SavesPage refreshKey={refreshKey} onOpenTask={onOpenTasks} />}
        {view === 'maintenance' && <MaintenancePage focusRequestKey={maintenanceFocusRequest.key} focusSection={maintenanceFocusRequest.section} refreshKey={refreshKey} onOpenGame={onOpenGame} onOpenLibrary={onOpenLibrary} onOpenMetadata={onOpenMetadata} onOpenTasks={onOpenTasks} />}
        {view === 'settings' && <SettingsPage tabRequest={settingsTabRequest} onAccentPreview={onAccentPreview} onThemePreview={onThemePreview} onSaved={onChanged} onOpenTask={onOpenTasks} />}
      </div>
    </Suspense>
  );
}

function PageLoading() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-slate-400">
      载入页面...
    </div>
  );
}
