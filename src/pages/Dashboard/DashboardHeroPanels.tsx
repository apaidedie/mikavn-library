import { Activity, AlertTriangle, Clock3, FolderSearch, Gamepad2, ListChecks, Plus, Settings, Trophy, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CoverImage } from '@/components/ui/cover';
import { EmptyState } from '@/components/ui/notice';
import { MetricTile, Panel, PanelContent, PanelHeader } from '@/components/ui/page';
import type { SettingsTab } from '@/pages/Settings/SettingsPage';
import type { DashboardData, Game } from '@/types/game';
import { PLAY_STATUS_LABEL } from '@/types/game';
import type { TaskFilterPreset } from '@/types/task';
import { formatDateTime, formatPlayTime } from '@/utils/time';

export function TodayStrip({ data, attentionCount, runningCount, onAddGame, onOpenMaintenance, onOpenScanner, onOpenSettings, onOpenTasks }: { data: DashboardData; attentionCount: number; runningCount: number; onAddGame?: () => void; onOpenMaintenance?: (section?: string | null) => void; onOpenScanner?: () => void; onOpenSettings?: (tab?: SettingsTab) => void; onOpenTasks?: (taskId?: string | null, preset?: TaskFilterPreset | null) => void }) {
  return (
    <Panel>
      <PanelContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100">今日状态</h2>
            <p className="mt-1 text-xs text-slate-500">先继续游戏，再处理本地路径、素材和任务提醒。</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={onAddGame}><Plus className="h-4 w-4" />添加游戏</Button>
            <Button variant="outline" onClick={onOpenScanner}><FolderSearch className="h-4 w-4" />扫描入库</Button>
            {onOpenMaintenance && <Button variant="ghost" onClick={() => onOpenMaintenance()}><Wrench className="h-4 w-4" />维护</Button>}
            {onOpenTasks && <Button variant="ghost" onClick={() => onOpenTasks(null, { statusFilter: 'attention' })}><Activity className="h-4 w-4" />任务</Button>}
            {onOpenSettings && <Button variant="ghost" onClick={() => onOpenSettings('local')}><Settings className="h-4 w-4" />本地设置</Button>}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          <MetricTile icon={<Gamepad2 className="h-4 w-4" />} label="游戏总数" value={`${data.totalGames}`} />
          <MetricTile icon={<Clock3 className="h-4 w-4" />} label="总游玩时间" value={formatPlayTime(data.totalPlaySeconds)} />
          <MetricTile icon={<ListChecks className="h-4 w-4" />} label="进行中" value={`${data.playingGames}`} />
          <MetricTile icon={<Trophy className="h-4 w-4" />} label="已通关" value={`${data.completedGames}`} />
          <MetricTile icon={<AlertTriangle className="h-4 w-4" />} label="待处理" value={`${attentionCount}`} detail={runningCount > 0 ? `${runningCount} 个任务进行中` : '本地提醒'} />
        </div>
      </PanelContent>
    </Panel>
  );
}

export function ContinuePanel({ games, onOpenGame, onAddGame, onOpenScanner }: { games: Game[]; onOpenGame: (id: string) => void; onAddGame?: () => void; onOpenScanner?: () => void }) {
  return (
    <Panel>
      <PanelHeader title="继续游玩" description="优先显示进行中、最近玩过或有游玩时长的条目。" icon={<Gamepad2 className="h-4 w-4" />} />
      <PanelContent>
        {games.length === 0 ? (
          <EmptyState className="py-8">
            <div className="space-y-3">
              <div>还没有可继续的游戏。添加或扫描本地目录后，这里会变成你的启动入口。</div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="sm" onClick={onAddGame}><Plus className="h-4 w-4" />添加游戏</Button>
                <Button size="sm" variant="outline" onClick={onOpenScanner}><FolderSearch className="h-4 w-4" />扫描入库</Button>
              </div>
            </div>
          </EmptyState>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,148px)] justify-between gap-6 gap-y-9 pb-2">
            {games.map((game) => (
              <button className="group text-left" key={game.id} onClick={() => onOpenGame(game.id)} type="button">
                <div className="motion-poster relative overflow-hidden rounded-lg shadow-md shadow-black/25 group-hover:ring-2 group-hover:ring-[rgb(var(--accent-rgb))]">
                  <CoverImage alt={game.title} className="aspect-[2/3] w-[148px]" src={game.coverImage} />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="media-overlay-text flex items-center justify-between gap-2 text-[11px]">
                      <span>{formatPlayTime(game.totalPlaySeconds)}</span>
                      <Badge className="min-h-5 px-2 text-[10px]">{PLAY_STATUS_LABEL[game.playStatus]}</Badge>
                    </div>
                  </div>
                </div>
                <div className="mt-2 truncate text-center text-xs text-slate-200 group-hover:text-[rgb(var(--accent-rgb))]">{game.title}</div>
                <div className="mt-0.5 truncate text-center text-[11px] text-slate-500">{formatDateTime(game.lastPlayedAt ?? game.createdAt)}</div>
              </button>
            ))}
          </div>
        )}
      </PanelContent>
    </Panel>
  );
}
