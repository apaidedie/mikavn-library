import { EmptyState, Notice } from '@/components/ui/notice';
import type { Game } from '@/types/game';
import { GameGrid, GameList } from './LibraryGameNav';
import { LibrarySidebarControls, type LibraryViewMode } from './LibrarySidebarControls';
import type { useLibraryBulkActions } from './useLibraryBulkActions';
import type { useLibraryFilters } from './useLibraryFilters';

type LibraryBulkControls = ReturnType<typeof useLibraryBulkActions>;
type LibraryFilterControls = ReturnType<typeof useLibraryFilters>;

type LibrarySidebarProps = {
  blurCovers: boolean;
  bulkActions: LibraryBulkControls;
  error: string | null;
  filters: LibraryFilterControls;
  loading: boolean;
  onAdd: () => void;
  onSelectedGameChange: (id: string | null) => void;
  onViewModeChange: (mode: LibraryViewMode) => void;
  refreshing: boolean;
  selectedGameId: string | null;
  viewMode: LibraryViewMode;
  visibleGames: Game[];
  width: number;
};

export function LibrarySidebar({
  blurCovers,
  bulkActions,
  error,
  filters,
  loading,
  onAdd,
  onSelectedGameChange,
  onViewModeChange,
  refreshing,
  selectedGameId,
  viewMode,
  visibleGames,
  width,
}: LibrarySidebarProps) {
  return (
    <aside className="flex shrink-0 flex-col bg-[rgb(var(--librarybar-rgb)/0.46)]" style={{ width }}>
      <LibrarySidebarControls bulkActions={bulkActions} filters={filters} gameCount={visibleGames.length} onAdd={onAdd} onViewModeChange={onViewModeChange} viewMode={viewMode} />

      <div className="min-h-0 flex-1 overflow-auto p-1">
        {error && <Notice className="mb-2" tone="error">{error}</Notice>}
        {bulkActions.bulkMessage && <Notice className="mb-2 py-2">{bulkActions.bulkMessage}</Notice>}
        {refreshing && <Notice className="mb-2 py-2">正在更新筛选结果，当前列表会保留到新结果返回。</Notice>}
        {loading ? (
          <EmptyState className="py-8">正在读取游戏列表...</EmptyState>
        ) : viewMode === 'list' ? (
          <GameList
            blurCovers={blurCovers}
            bulkMode={bulkActions.bulkMode}
            games={visibleGames}
            selectedId={selectedGameId}
            selectedIds={bulkActions.bulkSelectedIds}
            onSelect={onSelectedGameChange}
            onToggleSelection={bulkActions.toggleBulkSelection}
          />
        ) : (
          <GameGrid
            blurCovers={blurCovers}
            bulkMode={bulkActions.bulkMode}
            games={visibleGames}
            selectedId={selectedGameId}
            selectedIds={bulkActions.bulkSelectedIds}
            onSelect={onSelectedGameChange}
            onToggleSelection={bulkActions.toggleBulkSelection}
          />
        )}
      </div>
    </aside>
  );
}
