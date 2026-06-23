import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CoverImage } from '@/components/ui/cover';
import { EmptyState } from '@/components/ui/notice';
import type { Game } from '@/types/game';
import { PLAY_STATUS_LABEL } from '@/types/game';
import { cn } from '@/utils/cn';
import {
  formatLibraryLoadMoreLabel,
  buildLibraryGameIndexLookup,
  getLibraryRenderIdentity,
  getLibraryRenderWindow,
  groupLibraryGames,
  libraryGridInitialRenderCount,
  libraryGridRenderBatchSize,
  libraryListInitialRenderCount,
  libraryListRenderBatchSize,
  nextLibraryRenderCount,
} from './libraryPageModel';

type LibraryGameNavProps = {
  blurCovers: boolean;
  bulkMode: boolean;
  games: Game[];
  onSelect: (id: string) => void;
  onToggleSelection: (id: string, checked: boolean) => void;
  selectedId: string | null;
  selectedIds: Set<string>;
};

export function GameList({ blurCovers, bulkMode, games, onSelect, onToggleSelection, selectedId, selectedIds }: LibraryGameNavProps) {
  const renderIdentity = useMemo(() => getLibraryRenderIdentity(games), [games]);
  const gameIndexLookup = useMemo(() => buildLibraryGameIndexLookup(games), [games]);
  const [renderState, setRenderState] = useState({ identity: renderIdentity, count: libraryListInitialRenderCount });
  const renderCount = renderState.identity === renderIdentity ? renderState.count : libraryListInitialRenderCount;

  if (games.length === 0) {
    return <EmptyLibrary />;
  }

  const renderWindow = getLibraryRenderWindow(games, renderCount, selectedId, gameIndexLookup);
  const groups = [
    ...(renderWindow.selectedGame ? [{ id: 'selected' as const, label: '当前选中', games: [renderWindow.selectedGame] }] : []),
    ...groupLibraryGames(renderWindow.primaryGames, PLAY_STATUS_LABEL),
  ];

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
              <GameListRow
                blurCovers={blurCovers}
                bulkMode={bulkMode}
                game={game}
                key={`${group.id}-${game.id}`}
                onSelect={onSelect}
                onToggleSelection={onToggleSelection}
                selected={selectedId === game.id}
                selectedIds={selectedIds}
              />
            ))}
          </div>
        </div>
      ))}
      {renderWindow.hasMore && (
        <div className="px-2 pb-2 pt-1">
          <Button className="h-8 w-full text-xs" size="sm" variant="outline" onClick={() => setRenderState((current) => ({ identity: renderIdentity, count: nextLibraryRenderCount(games.length, current.identity === renderIdentity ? current.count : libraryListInitialRenderCount, libraryListRenderBatchSize) }))}>
            {formatLibraryLoadMoreLabel(renderWindow.primaryGames.length, games.length)}
          </Button>
        </div>
      )}
    </div>
  );
}

export function GameGrid({ blurCovers, bulkMode, games, onSelect, onToggleSelection, selectedId, selectedIds }: LibraryGameNavProps) {
  const renderIdentity = useMemo(() => getLibraryRenderIdentity(games), [games]);
  const gameIndexLookup = useMemo(() => buildLibraryGameIndexLookup(games), [games]);
  const [renderState, setRenderState] = useState({ identity: renderIdentity, count: libraryGridInitialRenderCount });
  const renderCount = renderState.identity === renderIdentity ? renderState.count : libraryGridInitialRenderCount;

  if (games.length === 0) {
    return <EmptyLibrary />;
  }

  const renderWindow = getLibraryRenderWindow(games, renderCount, selectedId, gameIndexLookup);

  return (
    <div className="space-y-3">
      {renderWindow.selectedGame && (
        <div>
          <div className="mb-2 px-1 text-[11px] font-medium text-slate-500">当前选中</div>
          <div className="grid grid-cols-2 gap-4 p-1">
            <GameGridCard blurCovers={blurCovers} bulkMode={bulkMode} game={renderWindow.selectedGame} onSelect={onSelect} onToggleSelection={onToggleSelection} selected selectedIds={selectedIds} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 p-1">
        {renderWindow.primaryGames.map((game) => (
          <GameGridCard blurCovers={blurCovers} bulkMode={bulkMode} game={game} key={game.id} onSelect={onSelect} onToggleSelection={onToggleSelection} selected={selectedId === game.id} selectedIds={selectedIds} />
        ))}
      </div>
      {renderWindow.hasMore && (
        <div className="px-2 pb-3">
          <Button className="h-8 w-full text-xs" size="sm" variant="outline" onClick={() => setRenderState((current) => ({ identity: renderIdentity, count: nextLibraryRenderCount(games.length, current.identity === renderIdentity ? current.count : libraryGridInitialRenderCount, libraryGridRenderBatchSize) }))}>
            {formatLibraryLoadMoreLabel(renderWindow.primaryGames.length, games.length)}
          </Button>
        </div>
      )}
    </div>
  );
}

function EmptyLibrary() {
  return <EmptyState>还没有匹配的游戏。可以手动添加，或到扫描入库页面导入。</EmptyState>;
}

function GameListRow({ blurCovers, bulkMode, game, onSelect, onToggleSelection, selected, selectedIds }: Omit<LibraryGameNavProps, 'games' | 'selectedId'> & { game: Game; selected: boolean }) {
  return (
    <div
      className={cn(
        'motion-button game-nav-row flex h-5 w-full items-center gap-2 rounded-none px-2 text-left text-xs text-slate-300 hover:bg-white/[0.07] hover:text-slate-100',
        selected && 'is-selected bg-[rgb(var(--accent-rgb)/0.24)] text-slate-100 shadow-sm',
      )}
      title={game.title}
    >
      {bulkMode && <Checkbox aria-label={`选择${game.title}`} checked={selectedIds.has(game.id)} className="h-3.5 w-3.5" onChange={(event) => onToggleSelection(game.id, event.target.checked)} />}
      <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => onSelect(game.id)} type="button">
        <CoverImage alt={game.title} blur={blurCovers} className="h-[18px] w-[18px] shrink-0 rounded-md shadow-sm" fetchPriority="low" src={game.coverImage} />
        <span className="min-w-0 flex-1 truncate">{game.title}</span>
        {game.favorite && <span className="shrink-0 text-[10px] text-amber-200">★</span>}
        {game.pathStatus === 'broken' && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-300" title="路径异常" />}
        {game.pathStatus === 'incomplete' && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" title="路径不完整" />}
      </button>
    </div>
  );
}

function GameGridCard({ blurCovers, bulkMode, game, onSelect, onToggleSelection, selected, selectedIds }: Omit<LibraryGameNavProps, 'games' | 'selectedId'> & { game: Game; selected: boolean }) {
  return (
    <div className={cn('group relative text-left', selected && 'text-[rgb(var(--accent-rgb))]')}>
      {bulkMode && (
        <label className="absolute left-1 top-1 z-10 rounded-md border border-white/15 bg-black/70 p-1 backdrop-blur" onClick={(event) => event.stopPropagation()}>
          <Checkbox aria-label={`选择${game.title}`} checked={selectedIds.has(game.id)} onChange={(event) => onToggleSelection(game.id, event.target.checked)} />
        </label>
      )}
      <button className="w-full text-left" onClick={() => onSelect(game.id)} type="button">
        <div className={cn('motion-poster overflow-hidden rounded-lg shadow-md group-hover:ring-2 group-hover:ring-[rgb(var(--accent-rgb))]', selected && 'ring-2 ring-[rgb(var(--accent-rgb))]')}>
          <CoverImage alt={game.title} blur={blurCovers} className="aspect-[2/3]" fetchPriority="low" src={game.coverImage} />
        </div>
        <div className="mt-2 truncate text-center text-xs text-slate-200">{game.title}</div>
      </button>
      {(game.pathStatus === 'broken' || game.pathStatus === 'incomplete') && <div className="mt-1 text-center text-[11px] text-amber-100">{game.pathStatus === 'broken' ? '路径异常' : '路径不完整'}</div>}
    </div>
  );
}
