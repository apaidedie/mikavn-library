import { useEffect, useMemo, useState } from 'react';
import { api } from '@/services/api';
import type { Game, LibraryFilterPreset } from '@/types/game';
import { GameDetail } from './GameDetail';
import { LibraryGameDialog } from './LibraryGameDialog';
import { LibraryResizeHandle } from './LibraryResizeHandle';
import { LibrarySidebar } from './LibrarySidebar';
import type { LibraryViewMode } from './LibrarySidebarControls';
import { buildLibraryGameLookup, changedLibraryMetadataFields } from './libraryPageModel';
import { useLibraryBulkActions } from './useLibraryBulkActions';
import { useLibraryPageData } from './useLibraryPageData';
import { useLibraryPanelResize } from './useLibraryPanelResize';

type LibraryPageProps = {
  refreshKey: number;
  selectedGameId: string | null;
  onSelectedGameChange: (id: string | null) => void;
  onChanged: () => void;
  onOpenTasks?: (taskId?: string | null) => void;
  onOpenMaintenance?: (section?: string | null) => void;
  addRequestKey?: number | null;
  onAddRequestConsumed?: () => void;
  filterToggleKey?: number;
  filterPreset?: (LibraryFilterPreset & { key: number }) | null;
  toolbarQuery?: string;
};

export function LibraryPage({ refreshKey, selectedGameId, onSelectedGameChange, onChanged, onOpenTasks, onOpenMaintenance, addRequestKey, onAddRequestConsumed, filterPreset, filterToggleKey = 0, toolbarQuery }: LibraryPageProps) {
  const [viewMode, setViewMode] = useState<LibraryViewMode>('list');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const { draggingPanel, libraryPanelWidth, resetLibraryPanelWidth, startPanelResize } = useLibraryPanelResize();
  const { error, filters, loading, setError, setGames, settings } = useLibraryPageData({ filterPreset, filterToggleKey, refreshKey, toolbarQuery });
  const { visibleGames } = filters;

  const gameLookup = useMemo(() => buildLibraryGameLookup(visibleGames), [visibleGames]);
  const selectedGame = selectedGameId ? gameLookup.get(selectedGameId) ?? null : null;
  const blurCovers = settings.privacy_blur_covers === 'true';
  const bulkActions = useLibraryBulkActions({
    onChanged,
    refreshKey,
    setError,
    setGames,
    visibleGames,
  });

  useEffect(() => {
    if (loading) return;
    const nextSelectedId = selectedGameId && gameLookup.has(selectedGameId) ? selectedGameId : visibleGames[0]?.id ?? null;
    if (nextSelectedId !== selectedGameId) {
      onSelectedGameChange(nextSelectedId);
    }
  }, [gameLookup, loading, onSelectedGameChange, selectedGameId, visibleGames]);

  useEffect(() => {
    if (addRequestKey == null) return;
    openAdd();
    onAddRequestConsumed?.();
  }, [addRequestKey, onAddRequestConsumed]);

  useEffect(() => {
    if (!filterPreset) return;
    bulkActions.resetBulkState();
  }, [filterPreset, bulkActions.resetBulkState]);

  const openAdd = () => {
    setEditingGame(null);
    setDialogOpen(true);
  };

  const saveGame = async (input: Parameters<typeof api.addGame>[0]) => {
    const saved = editingGame ? await api.updateGame(editingGame.id, input) : await api.addGame(input);
    if (editingGame) {
      const changedFields = changedLibraryMetadataFields(editingGame, input);
      if (changedFields.length > 0) {
        await api.setFieldLocks(saved.id, changedFields, true);
      }
    }
    setDialogOpen(false);
    onSelectedGameChange(saved.id);
    onChanged();
  };

  const deleted = () => {
    onSelectedGameChange(null);
    onChanged();
  };

  return (
    <div className="animate-view-in flex h-full min-h-0 overflow-hidden">
      <LibrarySidebar
        blurCovers={blurCovers}
        bulkActions={bulkActions}
        error={error}
        filters={filters}
        loading={loading}
        selectedGameId={selectedGameId}
        viewMode={viewMode}
        visibleGames={visibleGames}
        width={libraryPanelWidth}
        onAdd={openAdd}
        onSelectedGameChange={onSelectedGameChange}
        onViewModeChange={setViewMode}
      />

      <LibraryResizeHandle dragging={draggingPanel} onReset={resetLibraryPanelWidth} onStartResize={startPanelResize} />

      <section className="min-w-0 flex-1 overflow-hidden">
        <GameDetail game={selectedGame} blurCover={blurCovers} onEdit={(game) => { setEditingGame(game); setDialogOpen(true); }} onDeleted={deleted} onChanged={() => onChanged()} onOpenMaintenance={onOpenMaintenance} onOpenTasks={onOpenTasks} />
      </section>

      <LibraryGameDialog game={editingGame} onSubmit={saveGame} onCancel={() => setDialogOpen(false)} onOpenChange={setDialogOpen} open={dialogOpen} />
    </div>
  );
}
