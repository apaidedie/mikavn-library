import * as Dialog from '@radix-ui/react-dialog';
import { Grid2X2, List, Plus, SlidersHorizontal, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CoverImage } from '@/components/ui/cover';
import { Input } from '@/components/ui/input';
import { EmptyState, Notice } from '@/components/ui/notice';
import { Select } from '@/components/ui/select';
import { api } from '@/services/api';
import type { Game, GameCollection, GameFilter, PlayStatus } from '@/types/game';
import { PLAY_STATUS_LABEL } from '@/types/game';
import { cn } from '@/utils/cn';
import { errorMessage } from '@/utils/errorMessage';
import { GameDetail } from './GameDetail';
import { GameForm } from './GameForm';

type LibraryPageProps = {
  refreshKey: number;
  selectedGameId: string | null;
  onSelectedGameChange: (id: string | null) => void;
  onChanged: () => void;
  onOpenTasks?: (taskId?: string | null) => void;
  addRequestKey?: number | null;
  onAddRequestConsumed?: () => void;
  filterToggleKey?: number;
  toolbarQuery?: string;
};

const statuses: Array<PlayStatus | 'all'> = ['all', 'planned', 'playing', 'completed', 'paused', 'archived'];
const defaultLibraryPanelWidth = 270;
const minLibraryPanelWidth = 220;
const maxLibraryPanelWidth = 400;

function clampLibraryPanelWidth(value: number) {
  return Math.max(minLibraryPanelWidth, Math.min(maxLibraryPanelWidth, value));
}

export function LibraryPage({ refreshKey, selectedGameId, onSelectedGameChange, onChanged, onOpenTasks, addRequestKey, onAddRequestConsumed, filterToggleKey = 0, toolbarQuery }: LibraryPageProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [query, setQuery] = useState('');
  const dragStartRef = useRef({ x: 0, width: defaultLibraryPanelWidth });
  const [status, setStatus] = useState<PlayStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<GameFilter['sortBy']>('updated_at');
  const [tag, setTag] = useState('');
  const [developer, setDeveloper] = useState('');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [hiddenFilter, setHiddenFilter] = useState<'all' | 'visible' | 'hidden'>('all');
  const [metadataStatus, setMetadataStatus] = useState('all');
  const [pathStatus, setPathStatus] = useState('all');
  const [collectionId, setCollectionId] = useState('');
  const [collections, setCollections] = useState<GameCollection[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [libraryPanelWidth, setLibraryPanelWidth] = useState(() => {
    if (typeof window === 'undefined') return defaultLibraryPanelWidth;
    const saved = Number(window.localStorage.getItem('mikavn.libraryPanelWidth'));
    return Number.isFinite(saved) ? clampLibraryPanelWidth(saved) : defaultLibraryPanelWidth;
  });
  const [draggingPanel, setDraggingPanel] = useState(false);

  const filter = useMemo<GameFilter>(() => ({
    query,
    status,
    tag: tag.trim() || undefined,
    developer: developer.trim() || undefined,
    favorite: favoriteOnly ? true : undefined,
    hidden: hiddenFilter === 'all' ? undefined : hiddenFilter === 'hidden',
    metadataStatus: metadataStatus === 'all' ? undefined : metadataStatus,
    pathStatus: pathStatus === 'all' ? undefined : pathStatus,
    collectionId: collectionId || undefined,
    sortBy,
    sortDirection: sortBy === 'title' ? 'asc' : 'desc',
  }), [collectionId, developer, favoriteOnly, hiddenFilter, metadataStatus, pathStatus, query, sortBy, status, tag]);

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

  useEffect(() => {
    api.listCollections().then(setCollections).catch(() => setCollections([]));
  }, [refreshKey]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('mikavn.libraryPanelWidth', String(libraryPanelWidth));
    }
  }, [libraryPanelWidth]);

  useEffect(() => {
    if (!draggingPanel) return;

    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    const onPointerMove = (event: PointerEvent) => {
      const delta = event.clientX - dragStartRef.current.x;
      setLibraryPanelWidth(clampLibraryPanelWidth(dragStartRef.current.width + delta));
    };

    const onPointerUp = () => {
      setDraggingPanel(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [draggingPanel]);

  const visibleGames = useMemo(() => settings.privacy_hide_hidden === 'true' && hiddenFilter !== 'hidden' ? games.filter((game) => !game.hidden) : games, [games, hiddenFilter, settings.privacy_hide_hidden]);
  const selectedGame = visibleGames.find((game) => game.id === selectedGameId) ?? null;
  const blurCovers = settings.privacy_blur_covers === 'true';
  const activeAdvancedCount = [tag.trim(), developer.trim(), favoriteOnly, hiddenFilter !== 'all', metadataStatus !== 'all', pathStatus !== 'all', collectionId].filter(Boolean).length;

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
    if (filterToggleKey === 0) return;
    setAdvancedOpen((value) => !value);
  }, [filterToggleKey]);

  useEffect(() => {
    if (toolbarQuery == null || toolbarQuery === query) return;
    setQuery(toolbarQuery);
  }, [query, toolbarQuery]);

  const openAdd = () => {
    setEditingGame(null);
    setDialogOpen(true);
  };

  const saveGame = async (input: Parameters<typeof api.addGame>[0]) => {
    const saved = editingGame ? await api.updateGame(editingGame.id, input) : await api.addGame(input);
    if (editingGame) {
      const changedFields = changedMetadataFields(editingGame, input);
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

  const clearAdvancedFilters = () => {
    setTag('');
    setDeveloper('');
    setFavoriteOnly(false);
    setHiddenFilter('all');
    setMetadataStatus('all');
    setPathStatus('all');
    setCollectionId('');
  };

  const startPanelResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragStartRef.current = { x: event.clientX, width: libraryPanelWidth };
    setDraggingPanel(true);
  }, [libraryPanelWidth]);

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
            {activeAdvancedCount > 0 && <Button className="h-7 px-2" size="sm" variant="ghost" onClick={clearAdvancedFilters}>清空</Button>}
          </div>

          {advancedOpen && (
            <div className="animate-view-in rounded-md border border-white/10 bg-black/10 p-2">
              <div className="grid grid-cols-2 gap-2">
            <Select className="w-full" value={status} onChange={(event) => setStatus(event.target.value as PlayStatus | 'all')}>
              {statuses.map((item) => <option key={item} value={item}>{item === 'all' ? '全部状态' : PLAY_STATUS_LABEL[item]}</option>)}
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
                <Select value={metadataStatus} onChange={(event) => setMetadataStatus(event.target.value)}>
                  <option value="all">全部元数据</option>
                  <option value="complete">元数据完整</option>
                  <option value="needs_metadata">需要补全</option>
                  <option value="missing_cover">缺少封面</option>
                  <option value="missing_external_id">缺少外部 ID</option>
                </Select>
                <Select value={pathStatus} onChange={(event) => setPathStatus(event.target.value)}>
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
          {loading ? <EmptyState className="py-8">正在读取游戏列表...</EmptyState> : viewMode === 'list' ? <GameList games={visibleGames} selectedId={selectedGameId} onSelect={onSelectedGameChange} blurCovers={blurCovers} /> : <GameGrid games={visibleGames} selectedId={selectedGameId} onSelect={onSelectedGameChange} blurCovers={blurCovers} />}
        </div>
      </aside>

      <div
        aria-label="调整游戏库侧栏宽度"
        className={cn('library-resizer group relative z-10 h-full w-1 shrink-0 cursor-ew-resize', draggingPanel && 'is-dragging')}
        onDoubleClick={() => setLibraryPanelWidth(defaultLibraryPanelWidth)}
        onPointerDown={startPanelResize}
        role="separator"
      >
        <div className="absolute inset-y-0 left-0 w-px bg-white/10 transition-all duration-100 group-hover:w-1 group-hover:bg-[rgb(var(--accent-rgb)/0.72)]" />
      </div>

      <section className="min-w-0 flex-1 overflow-hidden">
        <GameDetail game={selectedGame} blurCover={blurCovers} onEdit={(game) => { setEditingGame(game); setDialogOpen(true); }} onDeleted={deleted} onChanged={() => onChanged()} onOpenTasks={onOpenTasks} />
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

function GameList({ games, selectedId, onSelect, blurCovers }: { games: Game[]; selectedId: string | null; onSelect: (id: string) => void; blurCovers: boolean }) {
  if (games.length === 0) {
    return <EmptyLibrary />;
  }

  const groups = groupedGames(games);

  return (
    <div className="space-y-2.5 py-1">
      {groups.map((group) => (
        <div key={group.id}>
          <div className="mb-1 flex h-5 items-center justify-between px-2 text-[11px] font-medium text-slate-500">
            <span>{group.label}</span>
            <span>{group.games.length}</span>
          </div>
          <div className="space-y-[1px]">
            {group.games.map((game) => (
              <button
                className={cn(
                  'motion-button game-nav-row flex h-5 w-full items-center gap-2 rounded-none px-2 text-left text-xs text-slate-300 hover:bg-white/[0.07] hover:text-slate-100',
                  selectedId === game.id && 'is-selected bg-[rgb(var(--accent-rgb)/0.24)] text-slate-100 shadow-sm',
                )}
                key={`${group.id}-${game.id}`}
                onClick={() => onSelect(game.id)}
                title={game.title}
                type="button"
              >
                <CoverImage alt={game.title} blur={blurCovers} className="h-[18px] w-[18px] shrink-0 rounded-md shadow-sm" src={game.coverImage} />
                <span className="min-w-0 flex-1 truncate">{game.title}</span>
                {game.favorite && <span className="shrink-0 text-[10px] text-amber-200">★</span>}
                {game.pathStatus === 'broken' && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-300" title="路径异常" />}
                {game.pathStatus === 'incomplete' && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" title="路径不完整" />}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function groupedGames(games: Game[]) {
  const recent = games.filter((game) => game.lastPlayedAt).slice(0, 7);
  const recentIds = new Set(recent.map((game) => game.id));
  const groups = recent.length > 0 ? [{ id: 'recent', label: 'Recent Games', games: recent }] : [];

  for (const status of statuses.filter((item): item is PlayStatus => item !== 'all')) {
    const items = games.filter((game) => game.playStatus === status && !recentIds.has(game.id));
    if (items.length > 0) groups.push({ id: status, label: PLAY_STATUS_LABEL[status], games: items });
  }

  return groups.length > 0 ? groups : [{ id: 'all', label: 'All Games', games }];
}

function GameGrid({ games, selectedId, onSelect, blurCovers }: { games: Game[]; selectedId: string | null; onSelect: (id: string) => void; blurCovers: boolean }) {
  if (games.length === 0) {
    return <EmptyLibrary />;
  }

  return (
    <div className="grid grid-cols-2 gap-4 p-1">
      {games.map((game) => (
        <button className={cn('group text-left', selectedId === game.id && 'text-[rgb(var(--accent-rgb))]')} key={game.id} onClick={() => onSelect(game.id)} type="button">
          <div className={cn('motion-poster overflow-hidden rounded-lg shadow-md group-hover:ring-2 group-hover:ring-[rgb(var(--accent-rgb))]', selectedId === game.id && 'ring-2 ring-[rgb(var(--accent-rgb))]')}>
            <CoverImage alt={game.title} blur={blurCovers} className="aspect-[2/3]" src={game.coverImage} />
          </div>
          <div className="mt-2 truncate text-center text-xs text-slate-200">{game.title}</div>
          {(game.pathStatus === 'broken' || game.pathStatus === 'incomplete') && <div className="mt-1 text-center text-[11px] text-amber-100">{game.pathStatus === 'broken' ? '路径异常' : '路径不完整'}</div>}
        </button>
      ))}
    </div>
  );
}

function EmptyLibrary() {
  return <EmptyState>还没有匹配的游戏。可以手动添加，或到扫描入库页面导入。</EmptyState>;
}

function changedMetadataFields(game: Game, input: Parameters<typeof api.addGame>[0]) {
  const fields: string[] = [];
  const normalize = (value?: string | null) => value?.trim() || '';
  const normalizeList = (values?: string[] | null) => (values ?? []).map((item) => item.trim()).filter(Boolean).join('\n');

  if (normalize(game.title) !== normalize(input.title)) fields.push('title');
  if (normalize(game.originalTitle) !== normalize(input.originalTitle)) fields.push('originalTitle');
  if (normalize(game.description) !== normalize(input.description)) fields.push('description');
  if (normalize(game.notes) !== normalize(input.notes)) fields.push('notes');
  if (normalize(game.releaseDate) !== normalize(input.releaseDate)) fields.push('releaseDate');
  if (normalize(game.developer) !== normalize(input.developer)) fields.push('developer');
  if (normalize(game.publisher) !== normalize(input.publisher)) fields.push('publisher');
  if (normalize(game.coverImage) !== normalize(input.coverImage)) fields.push('coverImage');
  if (normalize(game.ageRating) !== normalize(input.ageRating)) fields.push('ageRating');
  if (normalizeList(game.tags) !== normalizeList(input.tags)) fields.push('tags');
  if (normalizeList(game.genres) !== normalizeList(input.genres)) fields.push('genres');
  if (normalize(game.vndbId) !== normalize(input.vndbId) || normalize(game.dlsiteId) !== normalize(input.dlsiteId) || normalize(game.fanzaId) !== normalize(input.fanzaId) || normalize(game.bangumiId) !== normalize(input.bangumiId) || normalize(game.ymgalId) !== normalize(input.ymgalId)) fields.push('externalIds');

  return fields;
}
