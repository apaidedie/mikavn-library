import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { api } from '@/services/api';
import type { Game, LibraryFilterPreset } from '@/types/game';
import type { LibraryViewMode } from './LibrarySidebarControls';
import { buildLibraryGameLookup, changedLibraryMetadataFields } from './libraryPageModel';
import { useLibraryBulkActions } from './useLibraryBulkActions';

type UseLibraryPageControllerOptions = {
  addRequestKey?: number | null;
  filterPreset?: (LibraryFilterPreset & { key: number }) | null;
  loading: boolean;
  onAddRequestConsumed?: () => void;
  onChanged: () => void;
  onSelectedGameChange: (id: string | null) => void;
  refreshKey: number;
  selectedGameId: string | null;
  setError: (message: string | null) => void;
  setGames: Dispatch<SetStateAction<Game[]>>;
  visibleGames: Game[];
};

export function useLibraryPageController({ addRequestKey, filterPreset, loading, onAddRequestConsumed, onChanged, onSelectedGameChange, refreshKey, selectedGameId, setError, setGames, visibleGames }: UseLibraryPageControllerOptions) {
  const [viewMode, setViewMode] = useState<LibraryViewMode>('list');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const gameLookup = useMemo(() => buildLibraryGameLookup(visibleGames), [visibleGames]);
  const selectedGame = selectedGameId ? gameLookup.get(selectedGameId) ?? null : null;
  const bulkActions = useLibraryBulkActions({ onChanged, refreshKey, setError, setGames, visibleGames });

  const openAdd = useCallback(() => {
    setEditingGame(null);
    setDialogOpen(true);
  }, []);

  const editGame = useCallback((game: Game) => {
    setEditingGame(game);
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => setDialogOpen(false), []);

  const deleted = useCallback(() => {
    onSelectedGameChange(null);
    onChanged();
  }, [onChanged, onSelectedGameChange]);

  const saveGame = useCallback(async (input: Parameters<typeof api.addGame>[0]) => {
    const saved = editingGame ? await api.updateGame(editingGame.id, input) : await api.addGame(input);
    if (editingGame) {
      const changedFields = changedLibraryMetadataFields(editingGame, input);
      if (changedFields.length > 0) await api.setFieldLocks(saved.id, changedFields, true);
    }
    setDialogOpen(false);
    onSelectedGameChange(saved.id);
    onChanged();
  }, [editingGame, onChanged, onSelectedGameChange]);

  useEffect(() => {
    if (loading) return;
    const nextSelectedId = selectedGameId && gameLookup.has(selectedGameId) ? selectedGameId : visibleGames[0]?.id ?? null;
    if (nextSelectedId !== selectedGameId) onSelectedGameChange(nextSelectedId);
  }, [gameLookup, loading, onSelectedGameChange, selectedGameId, visibleGames]);

  useEffect(() => {
    if (addRequestKey == null) return;
    openAdd();
    onAddRequestConsumed?.();
  }, [addRequestKey, onAddRequestConsumed, openAdd]);

  useEffect(() => {
    if (!filterPreset) return;
    bulkActions.resetBulkState();
  }, [filterPreset, bulkActions.resetBulkState]);

  return {
    bulkActions,
    closeDialog,
    deleted,
    dialogOpen,
    editGame,
    editingGame,
    openAdd,
    saveGame,
    selectedGame,
    setDialogOpen,
    setViewMode,
    viewMode,
  };
}
