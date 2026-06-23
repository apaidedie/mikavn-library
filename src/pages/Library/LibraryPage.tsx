import type { LibraryFilterPreset } from '@/types/game';
import { GameDetail } from './GameDetail';
import { LibraryGameDialog } from './LibraryGameDialog';
import { LibraryResizeHandle } from './LibraryResizeHandle';
import { LibrarySidebar } from './LibrarySidebar';
import { useLibraryPageController } from './useLibraryPageController';
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
  const { draggingPanel, libraryPanelWidth, resetLibraryPanelWidth, startPanelResize } = useLibraryPanelResize();
  const { error, filters, loading, refreshing, setError, setGames, settings } = useLibraryPageData({ filterPreset, filterToggleKey, refreshKey, toolbarQuery });
  const { visibleGames } = filters;
  const blurCovers = settings.privacy_blur_covers === 'true';
  const controller = useLibraryPageController({ addRequestKey, filterPreset, loading, onAddRequestConsumed, onChanged, onSelectedGameChange, refreshKey, selectedGameId, setError, setGames, visibleGames });

  return (
    <div className="animate-view-in flex h-full min-h-0 overflow-hidden">
      <LibrarySidebar
        blurCovers={blurCovers}
        bulkActions={controller.bulkActions}
        error={error}
        filters={filters}
        loading={loading}
        refreshing={refreshing}
        selectedGameId={selectedGameId}
        viewMode={controller.viewMode}
        visibleGames={visibleGames}
        width={libraryPanelWidth}
        onAdd={controller.openAdd}
        onSelectedGameChange={onSelectedGameChange}
        onViewModeChange={controller.setViewMode}
      />

      <LibraryResizeHandle dragging={draggingPanel} onReset={resetLibraryPanelWidth} onStartResize={startPanelResize} />

      <section className="min-w-0 flex-1 overflow-hidden">
        <GameDetail game={controller.selectedGame} blurCover={blurCovers} onEdit={controller.editGame} onDeleted={controller.deleted} onChanged={() => onChanged()} onOpenMaintenance={onOpenMaintenance} onOpenTasks={onOpenTasks} />
      </section>

      <LibraryGameDialog game={controller.editingGame} onSubmit={controller.saveGame} onCancel={controller.closeDialog} onOpenChange={controller.setDialogOpen} open={controller.dialogOpen} />
    </div>
  );
}
