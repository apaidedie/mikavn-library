import { useEffect, useState } from 'react';
import { EmptyState, Notice } from '@/components/ui/notice';
import { api } from '@/services/api';
import type { Game, LibraryFilterPreset } from '@/types/game';
import { cn } from '@/utils/cn';
import { GameDetail } from './GameDetail';
import { LibraryGameDialog } from './LibraryGameDialog';
import { GameGrid, GameList } from './LibraryGameNav';
import { LibrarySidebarControls, type LibraryViewMode } from './LibrarySidebarControls';
import { changedLibraryMetadataFields } from './libraryPageModel';
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

  const selectedGame = visibleGames.find((game) => game.id === selectedGameId) ?? null;
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
    const nextSelectedId = visibleGames.some((game) => game.id === selectedGameId) ? selectedGameId : visibleGames[0]?.id ?? null;
    if (nextSelectedId !== selectedGameId) {
      onSelectedGameChange(nextSelectedId);
    }
  }, [loading, onSelectedGameChange, selectedGameId, visibleGames]);

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
      <aside className="flex shrink-0 flex-col bg-[rgb(var(--librarybar-rgb)/0.46)]" style={{ width: libraryPanelWidth }}>
        <LibrarySidebarControls bulkActions={bulkActions} filters={filters} gameCount={visibleGames.length} onAdd={openAdd} onViewModeChange={setViewMode} viewMode={viewMode} />

        <div className="min-h-0 flex-1 overflow-auto p-1">
          {error && <Notice className="mb-2" tone="error">{error}</Notice>}
          {bulkActions.bulkMessage && <Notice className="mb-2 py-2">{bulkActions.bulkMessage}</Notice>}
          {loading ? <EmptyState className="py-8">正在读取游戏列表...</EmptyState> : viewMode === 'list' ? <GameList games={visibleGames} selectedId={selectedGameId} onSelect={onSelectedGameChange} blurCovers={blurCovers} bulkMode={bulkActions.bulkMode} selectedIds={bulkActions.bulkSelectedIds} onToggleSelection={bulkActions.toggleBulkSelection} /> : <GameGrid games={visibleGames} selectedId={selectedGameId} onSelect={onSelectedGameChange} blurCovers={blurCovers} bulkMode={bulkActions.bulkMode} selectedIds={bulkActions.bulkSelectedIds} onToggleSelection={bulkActions.toggleBulkSelection} />}
        </div>
      </aside>

      <div
        aria-label="调整游戏库侧栏宽度"
        className={cn('library-resizer group relative z-10 h-full w-1 shrink-0 cursor-ew-resize', draggingPanel && 'is-dragging')}
        onDoubleClick={resetLibraryPanelWidth}
        onPointerDown={startPanelResize}
        role="separator"
      >
        <div className="absolute inset-y-0 left-0 w-px bg-white/10 transition-all duration-100 group-hover:w-1 group-hover:bg-[rgb(var(--accent-rgb)/0.72)]" />
      </div>

      <section className="min-w-0 flex-1 overflow-hidden">
        <GameDetail game={selectedGame} blurCover={blurCovers} onEdit={(game) => { setEditingGame(game); setDialogOpen(true); }} onDeleted={deleted} onChanged={() => onChanged()} onOpenMaintenance={onOpenMaintenance} onOpenTasks={onOpenTasks} />
      </section>

      <LibraryGameDialog game={editingGame} onSubmit={saveGame} onCancel={() => setDialogOpen(false)} onOpenChange={setDialogOpen} open={dialogOpen} />
    </div>
  );
}
