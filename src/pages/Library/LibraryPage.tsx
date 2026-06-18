import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState, Notice } from '@/components/ui/notice';
import { api } from '@/services/api';
import type { Game, LibraryFilterPreset } from '@/types/game';
import { cn } from '@/utils/cn';
import { errorMessage } from '@/utils/errorMessage';
import { GameDetail } from './GameDetail';
import { GameForm } from './GameForm';
import { GameGrid, GameList } from './LibraryGameNav';
import { LibrarySidebarControls, type LibraryViewMode } from './LibrarySidebarControls';
import { changedLibraryMetadataFields } from './libraryPageModel';
import { useLibraryBulkActions } from './useLibraryBulkActions';
import { useLibraryFilters } from './useLibraryFilters';
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
  const [games, setGames] = useState<Game[]>([]);
  const [viewMode, setViewMode] = useState<LibraryViewMode>('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const { draggingPanel, libraryPanelWidth, resetLibraryPanelWidth, startPanelResize } = useLibraryPanelResize();
  const filters = useLibraryFilters({ filterPreset, filterToggleKey, games, settings, toolbarQuery });
  const { filter, visibleGames } = filters;

  useEffect(() => {
    setLoading(true);
    api
      .listGames(filter)
      .then((items) => {
        setGames(items);
        setError(null);
      })
      .catch((reason: unknown) => setError(errorMessage(reason)))
      .finally(() => setLoading(false));
  }, [filter, refreshKey]);

  useEffect(() => {
    api.getAppSettings().then(setSettings).catch(() => setSettings({}));
  }, [refreshKey]);

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

      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="motion-dialog-overlay fixed inset-0 z-40 bg-black/80 backdrop-blur-md" />
          <Dialog.Content className={cn('motion-dialog-content fixed left-1/2 top-1/2 z-50 max-h-[90vh] overflow-auto rounded-lg border border-white/15 bg-[rgb(var(--modal-rgb)/0.98)] p-0 shadow-2xl shadow-black/65 ring-1 ring-white/[0.04] backdrop-blur-2xl', editingGame ? 'w-[min(58rem,calc(100vw-2rem))]' : 'w-[min(44rem,calc(100vw-2rem))]')}>
            <div className="sticky top-0 z-10 flex min-h-12 items-center justify-between gap-4 border-b border-white/10 bg-black/[0.18] px-5 backdrop-blur-xl">
              <Dialog.Title className="text-base font-semibold text-slate-100">{editingGame ? '编辑游戏' : '添加游戏'}</Dialog.Title>
              <Dialog.Description className="sr-only">
                {editingGame ? '编辑当前游戏的本地路径、启动配置、媒体和元数据。' : '选择游戏目录或启动程序，并自动识别标题后检索元数据。'}
              </Dialog.Description>
              <Dialog.Close asChild><Button aria-label="关闭" size="icon" variant="ghost"><X className="h-4 w-4" /></Button></Dialog.Close>
            </div>
            <div className="p-5">
              <GameForm game={editingGame} onSubmit={saveGame} onCancel={() => setDialogOpen(false)} />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
