import { CheckSquare, Eye, EyeOff, Grid2X2, List, Plus, SlidersHorizontal, Star, Tags, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { GameFilter, PlayStatus } from '@/types/game';
import { PLAY_STATUS_LABEL } from '@/types/game';
import { formatLibraryCount, libraryStatuses } from './libraryPageModel';
import type { useLibraryBulkActions } from './useLibraryBulkActions';
import type { useLibraryFilters } from './useLibraryFilters';

export type LibraryViewMode = 'list' | 'grid';

type LibraryFilterControls = ReturnType<typeof useLibraryFilters>;
type LibraryBulkControls = ReturnType<typeof useLibraryBulkActions>;

type LibrarySidebarControlsProps = {
  bulkActions: LibraryBulkControls;
  filters: LibraryFilterControls;
  gameCount: number;
  onAdd: () => void;
  onViewModeChange: (mode: LibraryViewMode) => void;
  viewMode: LibraryViewMode;
};

export function LibrarySidebarControls({ bulkActions, filters, gameCount, onAdd, onViewModeChange, viewMode }: LibrarySidebarControlsProps) {
  return (
    <div className="space-y-2 border-b border-white/10 px-2 py-2">
      <div className="flex h-8 items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-slate-300">游戏库</div>
          <div className="mt-0.5 text-[11px] text-slate-500">{formatLibraryCount(gameCount)} 个游戏</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button aria-label="列表视图" className="h-7 w-7" size="icon" variant={viewMode === 'list' ? 'secondary' : 'ghost'} onClick={() => onViewModeChange('list')}><List className="h-4 w-4" /></Button>
          <Button aria-label="海报墙视图" className="h-7 w-7" size="icon" variant={viewMode === 'grid' ? 'secondary' : 'ghost'} onClick={() => onViewModeChange('grid')}><Grid2X2 className="h-4 w-4" /></Button>
          <Button className="h-7 w-7" size="icon" title="添加游戏" variant="ghost" onClick={onAdd}><Plus className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Button className="h-7 flex-1 justify-start px-2" size="sm" variant={filters.advancedOpen ? 'secondary' : 'outline'} onClick={() => filters.setAdvancedOpen((value) => !value)}>
          <SlidersHorizontal className="h-4 w-4" />筛选{filters.activeAdvancedCount > 0 ? ` · ${filters.activeAdvancedCount}` : ''}
        </Button>
        <Button className="h-7 px-2" size="sm" variant={bulkActions.bulkMode ? 'secondary' : 'outline'} onClick={bulkActions.toggleBulkMode}><CheckSquare className="h-4 w-4" />批量</Button>
        {filters.activeAdvancedCount > 0 && <Button className="h-7 px-2" size="sm" variant="ghost" onClick={filters.clearAdvancedFilters}>清空</Button>}
      </div>

      {bulkActions.bulkMode && <LibraryBulkPanel bulkActions={bulkActions} gameCount={gameCount} />}
      {filters.advancedOpen && <LibraryAdvancedFiltersPanel collections={bulkActions.collections} filters={filters} />}
    </div>
  );
}

function LibraryBulkPanel({ bulkActions, gameCount }: { bulkActions: LibraryBulkControls; gameCount: number }) {
  return (
    <div className="animate-view-in space-y-2 rounded-md border border-white/10 bg-black/10 p-2">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
        <span>已选 {formatLibraryCount(bulkActions.bulkSelectedVisibleCount)}</span>
        <div className="flex shrink-0 gap-1">
          <Button className="h-7 px-2" disabled={bulkActions.bulkBusy || gameCount === 0} size="sm" variant="ghost" onClick={bulkActions.selectVisibleGames}>选中当前</Button>
          <Button className="h-7 px-2" disabled={bulkActions.bulkBusy || gameCount === 0} size="sm" variant="ghost" onClick={bulkActions.invertVisibleBulkSelection}>反选当前</Button>
          <Button className="h-7 px-2" disabled={bulkActions.bulkBusy || bulkActions.bulkSelectedVisibleCount === 0} size="sm" variant="ghost" onClick={bulkActions.clearBulkSelection}>清空</Button>
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5">
        <Select aria-label="批量游玩状态" className="w-full" disabled={bulkActions.bulkBusy} value={bulkActions.bulkPlayStatus} onChange={(event) => bulkActions.setBulkPlayStatus(event.target.value as PlayStatus)}>
          {libraryStatuses.filter((item): item is PlayStatus => item !== 'all').map((item) => <option key={item} value={item}>{PLAY_STATUS_LABEL[item]}</option>)}
        </Select>
        <Button className="h-8 px-2" disabled={bulkActions.bulkBusy || bulkActions.bulkSelectedVisibleCount === 0} size="sm" variant="secondary" onClick={() => void bulkActions.applyBulkUpdate({ playStatus: bulkActions.bulkPlayStatus }, `游玩状态：${PLAY_STATUS_LABEL[bulkActions.bulkPlayStatus]}`)}>应用状态</Button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Select aria-label="批量加入合集" className="col-span-2 w-full" disabled={bulkActions.bulkBusy || bulkActions.collections.length === 0} value={bulkActions.bulkCollectionId} onChange={(event) => bulkActions.setBulkCollectionId(event.target.value)}>
          <option value="">选择合集</option>
          {bulkActions.collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
        </Select>
        <Button className="h-8 px-2" disabled={bulkActions.bulkBusy || bulkActions.bulkSelectedVisibleCount === 0 || !bulkActions.selectedBulkCollection} size="sm" variant="secondary" onClick={() => void bulkActions.applyBulkCollection('add')}>加入合集</Button>
        <Button className="h-8 px-2" disabled={bulkActions.bulkBusy || bulkActions.bulkSelectedVisibleCount === 0 || !bulkActions.selectedBulkCollection} size="sm" variant="outline" onClick={() => void bulkActions.applyBulkCollection('remove')}>移出合集</Button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Input aria-label="批量标签" className="col-span-2 w-full" disabled={bulkActions.bulkBusy} placeholder="标签，逗号分隔" value={bulkActions.bulkTagInput} onChange={(event) => bulkActions.setBulkTagInput(event.target.value)} />
        <Button aria-label="批量添加标签" className="h-8 px-2" disabled={bulkActions.bulkBusy || bulkActions.bulkSelectedVisibleCount === 0 || bulkActions.bulkParsedTags.length === 0} size="sm" variant="secondary" onClick={() => void bulkActions.applyBulkTags('add')}><Tags className="h-4 w-4" />添加</Button>
        <Button aria-label="批量移除标签" className="h-8 px-2" disabled={bulkActions.bulkBusy || bulkActions.bulkSelectedVisibleCount === 0 || bulkActions.bulkParsedTags.length === 0} size="sm" variant="outline" onClick={() => void bulkActions.applyBulkTags('remove')}><X className="h-4 w-4" />移除</Button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Button className="h-8 px-2" disabled={bulkActions.bulkBusy || bulkActions.bulkSelectedVisibleCount === 0} size="sm" variant="outline" onClick={() => void bulkActions.applyBulkUpdate({ favorite: true }, '标为收藏')}><Star className="h-4 w-4" />标为收藏</Button>
        <Button className="h-8 px-2" disabled={bulkActions.bulkBusy || bulkActions.bulkSelectedVisibleCount === 0} size="sm" variant="outline" onClick={() => void bulkActions.applyBulkUpdate({ favorite: false }, '取消收藏')}><Star className="h-4 w-4" />取消收藏</Button>
        <Button className="h-8 px-2" disabled={bulkActions.bulkBusy || bulkActions.bulkSelectedVisibleCount === 0} size="sm" variant="outline" onClick={() => void bulkActions.applyBulkUpdate({ hidden: true }, '隐藏条目')}><EyeOff className="h-4 w-4" />隐藏</Button>
        <Button className="h-8 px-2" disabled={bulkActions.bulkBusy || bulkActions.bulkSelectedVisibleCount === 0} size="sm" variant="outline" onClick={() => void bulkActions.applyBulkUpdate({ hidden: false }, '取消隐藏')}><Eye className="h-4 w-4" />取消隐藏</Button>
      </div>
    </div>
  );
}

function LibraryAdvancedFiltersPanel({ collections, filters }: { collections: LibraryBulkControls['collections']; filters: LibraryFilterControls }) {
  return (
    <div className="animate-view-in rounded-md border border-white/10 bg-black/10 p-2">
      <div className="grid grid-cols-2 gap-2">
        <Select className="w-full" value={filters.status} onChange={(event) => filters.setStatus(event.target.value as PlayStatus | 'all')}>
          {libraryStatuses.map((item) => <option key={item} value={item}>{item === 'all' ? '全部状态' : PLAY_STATUS_LABEL[item]}</option>)}
        </Select>
        <Select className="w-full" value={filters.sortBy} onChange={(event) => filters.setSortBy(event.target.value as GameFilter['sortBy'])}>
          <option value="updated_at">最近更新</option>
          <option value="last_played_at">最近游玩</option>
          <option value="created_at">入库时间</option>
          <option value="release_date">发售日</option>
          <option value="title">标题</option>
          <option value="rating">评分</option>
        </Select>
        <Input value={filters.tag} onChange={(event) => filters.setTag(event.target.value)} placeholder="标签" />
        <Input value={filters.developer} onChange={(event) => filters.setDeveloper(event.target.value)} placeholder="会社 / 品牌" />
        <Select value={filters.collectionId} onChange={(event) => filters.setCollectionId(event.target.value)}>
          <option value="">全部合集</option>
          {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
        </Select>
        <Select aria-label="元数据筛选" value={filters.metadataStatus} onChange={(event) => filters.setMetadataStatus(event.target.value)}>
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
        <Select aria-label="路径筛选" value={filters.pathStatus} onChange={(event) => filters.setPathStatus(event.target.value)}>
          <option value="all">全部路径</option>
          <option value="unknown">未检查</option>
          <option value="ok">路径正常</option>
          <option value="incomplete">路径不完整</option>
          <option value="broken">路径异常</option>
        </Select>
        <Select value={filters.hiddenFilter} onChange={(event) => filters.setHiddenFilter(event.target.value as 'all' | 'visible' | 'hidden')}>
          <option value="all">全部可见性</option>
          <option value="visible">仅非隐藏</option>
          <option value="hidden">仅隐藏</option>
        </Select>
        <Button variant={filters.favoriteOnly ? 'secondary' : 'outline'} size="sm" onClick={() => filters.setFavoriteOnly((value) => !value)}>{filters.favoriteOnly ? '只看收藏' : '收藏不限'}</Button>
      </div>
    </div>
  );
}
