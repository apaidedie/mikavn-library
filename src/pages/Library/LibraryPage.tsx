import * as Dialog from '@radix-ui/react-dialog';
import { CheckSquare, Eye, EyeOff, Grid2X2, List, Plus, SlidersHorizontal, Star, Tags, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, Notice } from '@/components/ui/notice';
import { Select } from '@/components/ui/select';
import { api } from '@/services/api';
import type { Game, GameFilter, LibraryFilterPreset, PlayStatus } from '@/types/game';
import { PLAY_STATUS_LABEL } from '@/types/game';
import { cn } from '@/utils/cn';
import { errorMessage } from '@/utils/errorMessage';
import { GameDetail } from './GameDetail';
import { GameForm } from './GameForm';
import { GameGrid, GameList } from './LibraryGameNav';
import { changedLibraryMetadataFields, formatLibraryCount, libraryStatuses } from './libraryPageModel';
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
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const { draggingPanel, libraryPanelWidth, resetLibraryPanelWidth, startPanelResize } = useLibraryPanelResize();
  const {
    activeAdvancedCount,
    advancedOpen,
    clearAdvancedFilters,
    collectionId,
    developer,
    favoriteOnly,
    filter,
    hiddenFilter,
    metadataStatus,
    pathStatus,
    setAdvancedOpen,
    setCollectionId,
    setDeveloper,
    setFavoriteOnly,
    setHiddenFilter,
    setMetadataStatus,
    setPathStatus,
    setSortBy,
    setStatus,
    setTag,
    sortBy,
    status,
    tag,
    visibleGames,
  } = useLibraryFilters({ filterPreset, filterToggleKey, games, settings, toolbarQuery });

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
  const {
    applyBulkCollection,
    applyBulkTags,
    applyBulkUpdate,
    bulkBusy,
    bulkCollectionId,
    bulkMessage,
    bulkMode,
    bulkParsedTags,
    bulkPlayStatus,
    bulkSelectedIds,
    bulkSelectedVisibleCount,
    bulkTagInput,
    clearBulkSelection,
    collections,
    invertVisibleBulkSelection,
    resetBulkState,
    selectedBulkCollection,
    selectVisibleGames,
    setBulkCollectionId,
    setBulkPlayStatus,
    setBulkTagInput,
    toggleBulkMode,
    toggleBulkSelection,
  } = useLibraryBulkActions({
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
    resetBulkState();
  }, [filterPreset, resetBulkState]);

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
        <div className="space-y-2 border-b border-white/10 px-2 py-2">
          <div className="flex h-8 items-center justify-between gap-2 px-1">
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold uppercase tracking-wide text-slate-300">Library</div>
              <div className="mt-0.5 text-[11px] text-slate-500">{visibleGames.length} games</div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button aria-label="列表视图" className="h-7 w-7" size="icon" variant={viewMode === 'list' ? 'secondary' : 'ghost'} onClick={() => setViewMode('list')}><List className="h-4 w-4" /></Button>
              <Button aria-label="海报墙视图" className="h-7 w-7" size="icon" variant={viewMode === 'grid' ? 'secondary' : 'ghost'} onClick={() => setViewMode('grid')}><Grid2X2 className="h-4 w-4" /></Button>
              <Button className="h-7 w-7" size="icon" title="添加游戏" variant="ghost" onClick={openAdd}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button className="h-7 flex-1 justify-start px-2" size="sm" variant={advancedOpen ? 'secondary' : 'outline'} onClick={() => setAdvancedOpen((value) => !value)}>
              <SlidersHorizontal className="h-4 w-4" />筛选{activeAdvancedCount > 0 ? ` · ${activeAdvancedCount}` : ''}
            </Button>
            <Button className="h-7 px-2" size="sm" variant={bulkMode ? 'secondary' : 'outline'} onClick={toggleBulkMode}><CheckSquare className="h-4 w-4" />批量</Button>
            {activeAdvancedCount > 0 && <Button className="h-7 px-2" size="sm" variant="ghost" onClick={clearAdvancedFilters}>清空</Button>}
          </div>

          {bulkMode && (
            <div className="animate-view-in space-y-2 rounded-md border border-white/10 bg-black/10 p-2">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                <span>已选 {formatLibraryCount(bulkSelectedVisibleCount)}</span>
                <div className="flex shrink-0 gap-1">
                  <Button className="h-7 px-2" disabled={bulkBusy || visibleGames.length === 0} size="sm" variant="ghost" onClick={selectVisibleGames}>选中当前</Button>
                  <Button className="h-7 px-2" disabled={bulkBusy || visibleGames.length === 0} size="sm" variant="ghost" onClick={invertVisibleBulkSelection}>反选当前</Button>
                  <Button className="h-7 px-2" disabled={bulkBusy || bulkSelectedVisibleCount === 0} size="sm" variant="ghost" onClick={clearBulkSelection}>清空</Button>
                </div>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5">
                <Select aria-label="批量游玩状态" className="w-full" disabled={bulkBusy} value={bulkPlayStatus} onChange={(event) => setBulkPlayStatus(event.target.value as PlayStatus)}>
                  {libraryStatuses.filter((item): item is PlayStatus => item !== 'all').map((item) => <option key={item} value={item}>{PLAY_STATUS_LABEL[item]}</option>)}
                </Select>
                <Button className="h-8 px-2" disabled={bulkBusy || bulkSelectedVisibleCount === 0} size="sm" variant="secondary" onClick={() => void applyBulkUpdate({ playStatus: bulkPlayStatus }, `游玩状态：${PLAY_STATUS_LABEL[bulkPlayStatus]}`)}>应用状态</Button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Select aria-label="批量加入合集" className="col-span-2 w-full" disabled={bulkBusy || collections.length === 0} value={bulkCollectionId} onChange={(event) => setBulkCollectionId(event.target.value)}>
                  <option value="">选择合集</option>
                  {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
                </Select>
                <Button className="h-8 px-2" disabled={bulkBusy || bulkSelectedVisibleCount === 0 || !selectedBulkCollection} size="sm" variant="secondary" onClick={() => void applyBulkCollection('add')}>加入合集</Button>
                <Button className="h-8 px-2" disabled={bulkBusy || bulkSelectedVisibleCount === 0 || !selectedBulkCollection} size="sm" variant="outline" onClick={() => void applyBulkCollection('remove')}>移出合集</Button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Input aria-label="批量标签" className="col-span-2 w-full" disabled={bulkBusy} placeholder="标签，逗号分隔" value={bulkTagInput} onChange={(event) => setBulkTagInput(event.target.value)} />
                <Button aria-label="批量添加标签" className="h-8 px-2" disabled={bulkBusy || bulkSelectedVisibleCount === 0 || bulkParsedTags.length === 0} size="sm" variant="secondary" onClick={() => void applyBulkTags('add')}><Tags className="h-4 w-4" />添加</Button>
                <Button aria-label="批量移除标签" className="h-8 px-2" disabled={bulkBusy || bulkSelectedVisibleCount === 0 || bulkParsedTags.length === 0} size="sm" variant="outline" onClick={() => void applyBulkTags('remove')}><X className="h-4 w-4" />移除</Button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Button className="h-8 px-2" disabled={bulkBusy || bulkSelectedVisibleCount === 0} size="sm" variant="outline" onClick={() => void applyBulkUpdate({ favorite: true }, '标为收藏')}><Star className="h-4 w-4" />标为收藏</Button>
                <Button className="h-8 px-2" disabled={bulkBusy || bulkSelectedVisibleCount === 0} size="sm" variant="outline" onClick={() => void applyBulkUpdate({ favorite: false }, '取消收藏')}><Star className="h-4 w-4" />取消收藏</Button>
                <Button className="h-8 px-2" disabled={bulkBusy || bulkSelectedVisibleCount === 0} size="sm" variant="outline" onClick={() => void applyBulkUpdate({ hidden: true }, '隐藏条目')}><EyeOff className="h-4 w-4" />隐藏</Button>
                <Button className="h-8 px-2" disabled={bulkBusy || bulkSelectedVisibleCount === 0} size="sm" variant="outline" onClick={() => void applyBulkUpdate({ hidden: false }, '取消隐藏')}><Eye className="h-4 w-4" />取消隐藏</Button>
              </div>
            </div>
          )}

          {advancedOpen && (
            <div className="animate-view-in rounded-md border border-white/10 bg-black/10 p-2">
              <div className="grid grid-cols-2 gap-2">
            <Select className="w-full" value={status} onChange={(event) => setStatus(event.target.value as PlayStatus | 'all')}>
              {libraryStatuses.map((item) => <option key={item} value={item}>{item === 'all' ? '全部状态' : PLAY_STATUS_LABEL[item]}</option>)}
            </Select>
            <Select className="w-full" value={sortBy} onChange={(event) => setSortBy(event.target.value as GameFilter['sortBy'])}>
              <option value="updated_at">最近更新</option>
              <option value="last_played_at">最近游玩</option>
              <option value="created_at">入库时间</option>
              <option value="release_date">发售日</option>
              <option value="title">标题</option>
              <option value="rating">评分</option>
            </Select>
                <Input value={tag} onChange={(event) => setTag(event.target.value)} placeholder="标签" />
                <Input value={developer} onChange={(event) => setDeveloper(event.target.value)} placeholder="会社 / 品牌" />
                <Select value={collectionId} onChange={(event) => setCollectionId(event.target.value)}>
                  <option value="">全部合集</option>
                  {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
                </Select>
                <Select aria-label="元数据筛选" value={metadataStatus} onChange={(event) => setMetadataStatus(event.target.value)}>
                  <option value="all">全部元数据</option>
                  <option value="complete">元数据完整</option>
                  <option value="needs_metadata">需要补全</option>
                  <option value="missing_description">缺少简介</option>
                  <option value="missing_cover">缺少封面</option>
                  <option value="missing_banner">缺少横幅</option>
                  <option value="missing_background">缺少背景</option>
                  <option value="missing_artwork">媒体图不完整</option>
                  <option value="missing_description_image">缺少简介图片</option>
                  <option value="missing_external_id">缺少外部 ID</option>
                </Select>
                <Select aria-label="路径筛选" value={pathStatus} onChange={(event) => setPathStatus(event.target.value)}>
                  <option value="all">全部路径</option>
                  <option value="unknown">未检查</option>
                  <option value="ok">路径正常</option>
                  <option value="incomplete">路径不完整</option>
                  <option value="broken">路径异常</option>
                </Select>
                <Select value={hiddenFilter} onChange={(event) => setHiddenFilter(event.target.value as 'all' | 'visible' | 'hidden')}>
                  <option value="all">全部可见性</option>
                  <option value="visible">仅非隐藏</option>
                  <option value="hidden">仅隐藏</option>
                </Select>
                <Button variant={favoriteOnly ? 'secondary' : 'outline'} size="sm" onClick={() => setFavoriteOnly((value) => !value)}>{favoriteOnly ? '只看收藏' : '收藏不限'}</Button>
              </div>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-1">
          {error && <Notice className="mb-2" tone="error">{error}</Notice>}
          {bulkMessage && <Notice className="mb-2 py-2">{bulkMessage}</Notice>}
          {loading ? <EmptyState className="py-8">正在读取游戏列表...</EmptyState> : viewMode === 'list' ? <GameList games={visibleGames} selectedId={selectedGameId} onSelect={onSelectedGameChange} blurCovers={blurCovers} bulkMode={bulkMode} selectedIds={bulkSelectedIds} onToggleSelection={toggleBulkSelection} /> : <GameGrid games={visibleGames} selectedId={selectedGameId} onSelect={onSelectedGameChange} blurCovers={blurCovers} bulkMode={bulkMode} selectedIds={bulkSelectedIds} onToggleSelection={toggleBulkSelection} />}
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
