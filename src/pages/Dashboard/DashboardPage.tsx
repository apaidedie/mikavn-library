import { Activity, Clock3, Gamepad2, ListChecks, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { CoverImage } from '@/components/ui/cover';
import { EmptyState, Notice } from '@/components/ui/notice';
import { Button } from '@/components/ui/button';
import { MetricTile, PageFrame, PageShell, Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import { api } from '@/services/api';
import type { DashboardData, Game } from '@/types/game';
import { PLAY_STATUS_LABEL } from '@/types/game';
import type { TaskFilterPreset, TaskRecord } from '@/types/task';
import { cn } from '@/utils/cn';
import { errorMessage } from '@/utils/errorMessage';
import { taskLabel, taskStatusClass, taskStatusLabel } from '@/utils/taskLabels';
import { formatDateTime, formatPlayTime } from '@/utils/time';

type DashboardPageProps = {
  refreshKey: number;
  onOpenGame: (id: string) => void;
  onOpenTasks?: (taskId?: string | null, preset?: TaskFilterPreset | null) => void;
};

export function DashboardPage({ refreshKey, onOpenGame, onOpenTasks }: DashboardPageProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getDashboard()
      .then((next) => {
        setData(next);
        setError(null);
      })
      .catch((reason: unknown) => setError(errorMessage(reason)));
    api.listTasks(5).then(setTasks).catch(() => setTasks([]));
  }, [refreshKey]);

  if (error) {
    return <div className="p-5"><Notice tone="error">{error}</Notice></div>;
  }

  if (!data) {
    return <div className="p-5"><EmptyState>正在读取本地游戏库...</EmptyState></div>;
  }

  return (
    <PageShell>
      <PageFrame className="max-w-[88rem] gap-6">
        <div className="grid gap-3 md:grid-cols-4">
          <MetricTile icon={<Gamepad2 className="h-4 w-4" />} label="游戏总数" value={`${data.totalGames}`} />
          <MetricTile icon={<Clock3 className="h-4 w-4" />} label="总游玩时间" value={formatPlayTime(data.totalPlaySeconds)} />
          <MetricTile icon={<ListChecks className="h-4 w-4" />} label="进行中" value={`${data.playingGames}`} />
          <MetricTile icon={<Trophy className="h-4 w-4" />} label="已通关" value={`${data.completedGames}`} />
        </div>

        <ShowcaseSection games={data.recentGames} title="最近游玩" empty="还没有游玩记录。" onOpenGame={onOpenGame} />
        <ShowcaseSection games={data.recentlyAdded} title="最近入库" empty="手动添加或扫描导入游戏后，会在这里看到新条目。" onOpenGame={onOpenGame} />
        <RecentTasksPanel tasks={tasks} onOpenTasks={onOpenTasks} />
      </PageFrame>
    </PageShell>
  );
}

function RecentTasksPanel({ tasks, onOpenTasks }: { tasks: TaskRecord[]; onOpenTasks?: (taskId?: string | null, preset?: TaskFilterPreset | null) => void }) {
  const runningCount = tasks.filter((task) => task.status === 'pending' || task.status === 'running').length;
  const attentionCount = tasks.filter((task) => task.status === 'failed' || task.status === 'cancelled').length;
  const activeCount = runningCount + attentionCount;

  return (
    <Panel>
      <PanelHeader
        title="近期任务"
        description={activeCount > 0 ? `${activeCount} 个任务需要关注` : '扫描、备份、导出和路径检查会出现在这里。'}
        icon={<Activity className="h-4 w-4" />}
        actions={onOpenTasks && (
          <>
            <Button disabled={attentionCount === 0} size="sm" variant="outline" onClick={() => onOpenTasks(null, { statusFilter: 'attention' })}>需处理 {attentionCount}</Button>
            <Button disabled={runningCount === 0} size="sm" variant="outline" onClick={() => onOpenTasks(null, { statusFilter: 'active' })}>进行中 {runningCount}</Button>
            <Button size="sm" variant="outline" onClick={() => onOpenTasks()}>全部任务</Button>
          </>
        )}
      />
      <PanelContent className="space-y-2">
        {tasks.length === 0 ? (
          <EmptyState className="py-7">暂无任务记录。开始扫描、备份或批量匹配后会在这里看到进度。</EmptyState>
        ) : tasks.map((task) => (
          <SoftRow className={cn('grid gap-3 px-3 py-3 lg:grid-cols-[1fr_6rem_5rem_auto]', task.status === 'failed' && 'border-rose-300/20 bg-rose-400/[0.055]')} key={task.id}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium text-slate-100">{taskLabel(task.taskType)}</span>
                <Badge className={taskStatusClass(task.status)}>{taskStatusLabel(task.status)}</Badge>
              </div>
              <div className="mt-1 truncate text-xs text-slate-500">{task.error || task.message || '无消息'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">进度</div>
              <div className="mt-1 text-sm text-slate-100">{Math.round(task.progress * 100)}%</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">更新</div>
              <div className="mt-1 text-xs text-slate-300">{formatDateTime(task.updatedAt)}</div>
            </div>
            <div className="flex items-center justify-end">
              {onOpenTasks && <Button size="sm" variant="ghost" onClick={() => onOpenTasks(task.id)}>日志</Button>}
            </div>
          </SoftRow>
        ))}
      </PanelContent>
    </Panel>
  );
}

function ShowcaseSection({ title, games, empty, onOpenGame }: { title: string; games: Game[]; empty: string; onOpenGame: (id: string) => void }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-4 px-1">
        <h2 className="shrink-0 text-sm font-medium text-slate-200">{title}</h2>
        <div className="h-px flex-1 border-t border-dashed border-white/10" />
      </div>
      {games.length === 0 ? (
        <EmptyState>{empty}</EmptyState>
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
    </section>
  );
}
