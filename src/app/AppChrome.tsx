import { ArrowLeft, ArrowRight, Grid2X2, Home, Moon, Plus, RefreshCw, Search, Settings, SlidersHorizontal, Sun } from 'lucide-react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import { primaryNavItems, type View } from './appNavigation';

type AppChromeProps = {
  accent: { rgb: string; strongRgb: string; contrast: string };
  children: ReactNode;
  librarySearchValue: string;
  onFocusLibrarySearch: () => void;
  onRequestAddGame: () => void;
  onSetView: (view: View) => void;
  onToggleLibraryFilters: () => void;
  onToggleTheme: () => void;
  onUpdateLibrarySearch: (value: string) => void;
  onRefresh: () => void;
  resolvedTheme: 'dark' | 'light';
  title: string;
  topSearchRef: RefObject<HTMLInputElement | null>;
  view: View;
};

export function AppChrome({ accent, children, librarySearchValue, onFocusLibrarySearch, onRefresh, onRequestAddGame, onSetView, onToggleLibraryFilters, onToggleTheme, onUpdateLibrarySearch, resolvedTheme, title, topSearchRef, view }: AppChromeProps) {
  return (
    <div className="relative flex h-screen overflow-hidden text-slate-100" data-theme={resolvedTheme} style={{ '--accent-rgb': accent.rgb, '--accent-strong-rgb': accent.strongRgb, '--accent-contrast': accent.contrast } as CSSProperties}>
      <aside className="relative z-10 flex w-14 shrink-0 flex-col justify-between border-r border-white/10 bg-[rgb(var(--rail-rgb)/0.72)] px-[6px] py-2 backdrop-blur-xl">
        <div className="flex flex-col items-center gap-2">
          <button className="motion-button flex h-9 w-9 items-center justify-center rounded-md font-mono text-2xl font-bold text-[rgb(var(--accent-rgb))] hover:bg-white/[0.08]" onClick={() => onSetView('dashboard')} title="MikaVN" type="button">
            V
          </button>
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={cn(
                  'motion-button flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-white/[0.08] hover:text-slate-100',
                  view === item.id && 'bg-[rgb(var(--accent-rgb)/0.22)] text-slate-100 shadow-sm',
                )}
                onClick={() => onSetView(item.id)}
                title={item.label}
                type="button"
              >
                <Icon className="h-5 w-5" />
              </button>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-2">
          <Button aria-label="添加游戏" className="h-9 w-9" size="icon" title="添加游戏" variant="ghost" onClick={onRequestAddGame}>
            <Plus className="h-5 w-5" />
          </Button>
          <button
            className={cn(
              'motion-button flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-white/[0.08] hover:text-slate-100',
              view === 'settings' && 'bg-[rgb(var(--accent-rgb)/0.22)] text-slate-100 shadow-sm',
            )}
            onClick={() => onSetView('settings')}
            title="设置"
            type="button"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </aside>

      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex h-[50px] shrink-0 items-center justify-between border-b border-white/10 bg-[rgb(var(--topbar-rgb)/0.58)] px-3 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-2">
            <Button aria-label="后退" className="h-8 w-8" size="icon" variant="ghost" disabled><ArrowLeft className="h-4 w-4" /></Button>
            <Button aria-label="前进" className="h-8 w-8" size="icon" variant="ghost" disabled><ArrowRight className="h-4 w-4" /></Button>
            <div className="relative ml-2 w-[250px] shrink-0">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-500" />
              <input
                ref={topSearchRef}
                aria-label="搜索游戏"
                className="h-8 w-full rounded-md border-0 bg-black/20 pl-8 pr-3 text-sm text-slate-100 outline-none placeholder:italic placeholder:text-slate-500 focus:ring-2 focus:ring-[rgb(var(--accent-rgb)/0.28)]"
                onChange={(event) => onUpdateLibrarySearch(event.target.value)}
                onFocus={onFocusLibrarySearch}
                placeholder="Search"
                value={librarySearchValue}
              />
            </div>
            <div className="ml-1 flex items-center gap-2">
              <ToolbarButton active={view === 'dashboard'} label="首页" onClick={() => onSetView('dashboard')}><Home className="h-4 w-4" /></ToolbarButton>
              <ToolbarButton active={view === 'library'} label="游戏库" onClick={() => onSetView('library')}><Grid2X2 className="h-4 w-4" /></ToolbarButton>
              <ToolbarButton label="筛选" onClick={onToggleLibraryFilters}><SlidersHorizontal className="h-4 w-4" /></ToolbarButton>
              <ToolbarButton label="刷新" onClick={onRefresh}><RefreshCw className="h-4 w-4" /></ToolbarButton>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="mr-2 max-w-36 truncate text-xs text-slate-400">{title}</span>
            <ToolbarButton label={resolvedTheme === 'dark' ? '浅色模式' : '深色模式'} onClick={onToggleTheme}>{resolvedTheme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</ToolbarButton>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}

function ToolbarButton({ active = false, label, onClick, children }: { active?: boolean; label: string; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      aria-label={label}
      className={cn(
        'motion-button flex h-8 w-8 items-center justify-center rounded-md bg-black/15 text-slate-400 shadow-sm hover:bg-white/[0.08] hover:text-slate-100',
        active && 'bg-[rgb(var(--accent-rgb)/0.24)] text-slate-100',
      )}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}
