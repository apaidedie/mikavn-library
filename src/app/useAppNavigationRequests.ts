import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import type { SettingsSection, SettingsTab } from '@/pages/Settings/SettingsPage';
import type { LibraryFilterPreset } from '@/types/game';
import type { TaskFilterPreset } from '@/types/task';
import type { View } from './appNavigation';

export function useAppNavigationRequests({
  setLibrarySearchValue,
  setView,
}: {
  setLibrarySearchValue: Dispatch<SetStateAction<string>>;
  setView: Dispatch<SetStateAction<View>>;
}) {
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [addRequestKey, setAddRequestKey] = useState<number | null>(null);
  const [taskFocusRequest, setTaskFocusRequest] = useState<{ id: string | null; key: number }>({ id: null, key: 0 });
  const [taskFilterPresetRequest, setTaskFilterPresetRequest] = useState<(TaskFilterPreset & { key: number }) | null>(null);
  const [maintenanceFocusRequest, setMaintenanceFocusRequest] = useState<{ section: string | null; key: number }>({ section: null, key: 0 });
  const [libraryFilterPresetRequest, setLibraryFilterPresetRequest] = useState<(LibraryFilterPreset & { key: number }) | null>(null);
  const [metadataQueuePresetRequest, setMetadataQueuePresetRequest] = useState<{ key: number; query?: string; missingProvider?: string }>({ key: 0 });
  const [settingsTabRequest, setSettingsTabRequest] = useState<{ tab: SettingsTab; section?: SettingsSection | null; key: number } | null>(null);

  const requestAddGame = useCallback(() => {
    setAddRequestKey((key) => (key ?? 0) + 1);
    setView('library');
  }, [setView]);

  const openLibrary = useCallback((preset?: LibraryFilterPreset | null) => {
    if (preset) {
      setLibraryFilterPresetRequest((current) => ({ key: (current?.key ?? 0) + 1, ...preset }));
      setLibrarySearchValue(preset.query ?? '');
    }
    setView('library');
  }, [setLibrarySearchValue, setView]);

  const openGame = useCallback((id: string) => {
    setSelectedGameId(id);
    setLibrarySearchValue('');
    setLibraryFilterPresetRequest((current) => ({ key: (current?.key ?? 0) + 1 }));
    setView('library');
  }, [setLibrarySearchValue, setView]);

  const openTasks = useCallback((taskId?: string | null, preset?: TaskFilterPreset | null) => {
    setTaskFocusRequest((current) => ({ id: taskId ?? null, key: current.key + 1 }));
    setTaskFilterPresetRequest((current) => ({ key: (current?.key ?? 0) + 1, ...(preset ?? { statusFilter: 'all', typeFilter: 'all', query: '' }) }));
    setView('tasks');
  }, [setView]);

  const openMaintenance = useCallback((section?: string | null) => {
    setMaintenanceFocusRequest((current) => ({ section: section ?? null, key: current.key + 1 }));
    setView('maintenance');
  }, [setView]);

  const openMetadata = useCallback((preset?: { query?: string; missingProvider?: string } | null) => {
    setMetadataQueuePresetRequest((current) => ({ key: current.key + 1, query: preset?.query ?? '', missingProvider: preset?.missingProvider ?? 'all' }));
    setView('metadata');
  }, [setView]);

  const openScanner = useCallback(() => setView('scanner'), [setView]);
  const openSaves = useCallback(() => setView('saves'), [setView]);
  const openSettings = useCallback((tab?: SettingsTab, section?: SettingsSection | null) => {
    const targetTab = tab ?? (section ? 'local' : undefined);
    if (targetTab) {
      setSettingsTabRequest((current) => ({ tab: targetTab, section: section ?? null, key: (current?.key ?? 0) + 1 }));
    }
    setView('settings');
  }, [setView]);

  const openDatabaseRestore = useCallback(() => {
    openSettings('local', 'database-restore');
  }, [openSettings]);
  const consumeAddRequest = useCallback(() => setAddRequestKey(null), []);

  return {
    addRequestKey,
    consumeAddRequest,
    libraryFilterPresetRequest,
    maintenanceFocusRequest,
    metadataQueuePresetRequest,
    openDatabaseRestore,
    openGame,
    openLibrary,
    openMaintenance,
    openMetadata,
    openSaves,
    openScanner,
    openSettings,
    openTasks,
    requestAddGame,
    selectedGameId,
    setSelectedGameId,
    settingsTabRequest,
    taskFilterPresetRequest,
    taskFocusRequest,
  };
}
