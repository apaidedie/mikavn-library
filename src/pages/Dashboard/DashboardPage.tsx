import { Activity, AlertTriangle, Archive, Clock3, Database, FolderSearch, Gamepad2, HardDrive, ImageOff, ListChecks, Plus, RotateCcw, Search, ShieldCheck, Trophy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CoverImage } from '@/components/ui/cover';
import { EmptyState, Notice } from '@/components/ui/notice';
import { MetricTile, PageFrame, PageShell, Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import { api } from '@/services/api';
import type { SettingsTab } from '@/pages/Settings/SettingsPage';
import type { AppDataDiagnostics } from '@/types/archive';
import type { DashboardData, Game, LibraryFilterPreset } from '@/types/game';
import { PLAY_STATUS_LABEL } from '@/types/game';
import type { TaskFilterPreset, TaskRecord } from '@/types/task';
import { cn } from '@/utils/cn';
import { errorMessage } from '@/utils/errorMessage';
import { taskLabel, taskStatusClass, taskStatusLabel } from '@/utils/taskLabels';
import { formatDateTime, formatPlayTime } from '@/utils/time';
import { canRetryDashboardTask, deriveDashboardAttentionItems, deriveDashboardTaskSummary, deriveDatabaseBackupStatus, rankContinueGames, uniqueDashboardGames, type DashboardAttentionItem } from './dashboardPersonal';

type DashboardPageProps = {
  refreshKey: number;
  onOpenGame: (id: string) => void;
  onAddGame?: () => void;
  onOpenScanner?: () => void;
  onOpenLibrary?: (preset?: LibraryFilterPreset | null) => void;
  onOpenMaintenance?: (section?: string | null) => void;
  onOpenMetadata?: (preset?: { query?: string; missingProvider?: string } | null) => void;
  onOpenSaves?: () => void;
  onOpenSettings?: (tab?: SettingsTab) => void;
  onOpenTasks?: (taskId?: string | null, preset?: TaskFilterPreset | null) => void;
};

export function DashboardPage({ refreshKey, onOpenGame, onAddGame, onOpenScanner, onOpenLibrary, onOpenMaintenance, onOpenMetadata, onOpenSaves, onOpenSettings, onOpenTasks }: DashboardPageProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [playingGames, setPlayingGames] = useState<Game[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [diagnostics, setDiagnostics] = useState<AppDataDiagnostics | null>(null);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sectionErrors, setSectionErrors] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const errors: string[] = [];
    setSectionErrors([]);

    api
      .getDashboard()
      .then((next) => {
        if (!cancelled) {
          setData(next);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(errorMessage(reason));
      });

    api.listTasks(8).then((next) => !cancelled && setTasks(next)).catch(() => !cancelled && setTasks([]));
    api.getAppSettings().then((next) => !cancelled && setSettings(next)).catch(() => undefined);
    api.getAppDataDiagnostics()
      .then((next) => !cancelled && setDiagnostics(next))
      .catch((reason: unknown) => {
        errors.push(`本地自检暂时不可用：${errorMessage(reason)}`);
        if (!cancelled) setSectionErrors([...errors]);
      });
    api.listGames({ status: 'playing', sortBy: 'last_played_at', sortDirection: 'desc' })
      .then((next) => !cancelled && setPlayingGames(next))
      .catch((reason: unknown) => {
        errors.push(`继续游玩列表暂时不可用：${errorMessage(reason)}`);
        if (!cancelled) setSectionErrors([...errors]);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const hideHidden = settings.privacy_hide_hidden === 'true';
  const continueGames = useMemo(() => data ? rankContinueGames(uniqueDashboardGames([...playingGames, ...data.recentGames, ...data.recentlyAdded]), { hideHidden, limit: 6 }) : [], [data, hideHidden, playingGames]);
  const attentionItems = useMemo(() => deriveDashboardAttentionItems({ diagnostics, tasks }), [diagnostics, tasks]);
  const taskSummary = useMemo(() => deriveDashboardTaskSummary(tasks), [tasks]);

  if (error) {
    return <div className="p-5"><Notice tone="error">{error}</Notice></div>;
  }

  if (!data) {
    return <div className="p-5"><EmptyState>正在读取本地游戏库...</EmptyState></div>;
  }

  return (
    <PageShell>
      <PageFrame className="max-w-[88rem] gap-6">
        <TodayStrip data={data} attentionCount={attentionItems.length} runningCount={taskSummary.runningCount} onAddGame={onAddGame} onOpenScanner={onOpenScanner} onOpenTasks={onOpenTasks} />
        {sectionErrors.length > 0 && (
          <div className="space-y-2">
            {sectionErrors.map((item) => <Notice key={item} tone="warning">{item}</Notice>)}
          </div>
        )}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.75fr)]">
          <ContinuePanel games={continueGames} onOpenGame={onOpenGame} onAddGame={onAddGame} onOpenScanner={onOpenScanner} />
          <NeedsAttentionPanel items={attentionItems} onOpenLibrary={onOpenLibrary} onOpenMaintenance={onOpenMaintenance} onOpenMetadata={onOpenMetadata} onOpenSettings={onOpenSettings} onOpenTasks={onOpenTasks} />
        </div>
        <LocalSafetyPanel diagnostics={diagnostics} onOpenSaves={onOpenSaves} onOpenSettings={onOpenSettings} onOpenTasks={onOpenTasks} />
        <RecentTasksPanel tasks={tasks} onOpenTasks={onOpenTasks} />
      </PageFrame>
    </PageShell>
  );
}

function TodayStrip({ data, attentionCount, runningCount, onAddGame, onOpenScanner, onOpenTasks }: { data: DashboardData; attentionCount: number; runningCount: number; onAddGame?: () => void; onOpenScanner?: () => void; onOpenTasks?: (taskId?: string | null, preset?: TaskFilterPreset | null) => void }) {
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
            {onOpenTasks && <Button variant="ghost" onClick={() => onOpenTasks(null, { statusFilter: 'attention' })}><Activity className="h-4 w-4" />任务</Button>}
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

function ContinuePanel({ games, onOpenGame, onAddGame, onOpenScanner }: { games: Game[]; onOpenGame: (id: string) => void; onAddGame?: () => void; onOpenScanner?: () => void }) {
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

function NeedsAttentionPanel({ items, onOpenLibrary, onOpenMaintenance, onOpenMetadata, onOpenSettings, onOpenTasks }: { items: DashboardAttentionItem[]; onOpenLibrary?: (preset?: LibraryFilterPreset | null) => void; onOpenMaintenance?: (section?: string | null) => void; onOpenMetadata?: (preset?: { query?: string; missingProvider?: string } | null) => void; onOpenSettings?: (tab?: SettingsTab) => void; onOpenTasks?: (taskId?: string | null, preset?: TaskFilterPreset | null) => void }) {
  return (
    <Panel>
      <PanelHeader title="需要关注" description={items.length > 0 ? '这些提醒都指向本地修复入口。' : '当前没有需要立刻处理的本地提醒。'} icon={<AlertTriangle className="h-4 w-4" />} />
      <PanelContent className="space-y-2">
        {items.length === 0 ? (
          <EmptyState className="py-8">路径、素材、外部 ID 和近期任务都没有明显问题。</EmptyState>
        ) : items.map((item) => (
          <SoftRow className={cn('grid grid-cols-[auto_1fr_auto] items-center gap-3', item.tone === 'danger' && 'border-rose-300/20 bg-rose-400/[0.055]', item.tone === 'warning' && 'border-amber-300/20 bg-amber-400/[0.055]')} key={item.kind}>
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-black/20', item.tone === 'danger' && 'text-rose-200', item.tone === 'warning' && 'text-amber-200', item.tone === 'info' && 'text-sky-200')}>
              <AttentionIcon kind={item.kind} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-slate-100">{item.title}</span>
                {item.count > 0 && <Badge>{item.count}</Badge>}
              </div>
              <div className="mt-1 text-xs text-slate-500">{item.detail}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => openAttentionItem(item, { onOpenLibrary, onOpenMaintenance, onOpenMetadata, onOpenSettings, onOpenTasks })}>查看</Button>
          </SoftRow>
        ))}
      </PanelContent>
    </Panel>
  );
}

function LocalSafetyPanel({ diagnostics, onOpenSaves, onOpenSettings, onOpenTasks }: { diagnostics: AppDataDiagnostics | null; onOpenSaves?: () => void; onOpenSettings?: (tab?: SettingsTab) => void; onOpenTasks?: (taskId?: string | null, preset?: TaskFilterPreset | null) => void }) {
  const backupStatus = deriveDatabaseBackupStatus(diagnostics?.databaseBackups);
  const databaseSummary = diagnostics ? `${diagnostics.database.gameCount} 个游戏 · ${backupStatus.summary}` : '读取本地自检后显示数据库和备份状态。';
  const backupDetail = diagnostics ? `${backupStatus.detail}${backupStatus.latestBackupAt ? ` 最近：${formatDateTime(backupStatus.latestBackupAt)}` : ''}` : '数据库备份会保存在本机 app-data 中。';
  const imageSummary = diagnostics ? `${diagnostics.images.fileCount} 个图片缓存 · ${diagnostics.logs.fileCount} 个日志文件` : '图片、日志和缓存都保存在本机 app-data。';

  return (
    <Panel>
      <PanelHeader title="本地安全" description="自用版优先保证数据位置清楚、备份入口明显、恢复前可复核。" icon={<ShieldCheck className="h-4 w-4" />} />
      <PanelContent>
        <div className="grid gap-3 lg:grid-cols-3">
          <SoftRow className={cn('flex flex-col justify-between gap-3', backupStatus.actionNeeded && 'border-amber-300/20 bg-amber-400/[0.055]')}>
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-100"><Database className="h-4 w-4 text-[rgb(var(--accent-rgb))]" />数据库与自检</div>
              <div className="mt-1 text-xs text-slate-500">{databaseSummary}</div>
              <div className={cn('mt-1 text-xs', backupStatus.actionNeeded ? 'text-amber-200' : 'text-slate-500')}>{backupDetail}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => onOpenSettings?.('local')}>打开设置</Button>
          </SoftRow>
          <SoftRow className="flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-100"><Archive className="h-4 w-4 text-[rgb(var(--accent-rgb))]" />存档备份</div>
              <div className="mt-1 text-xs text-slate-500">管理游戏存档路径、手动备份和恢复前保护备份。</div>
            </div>
            <Button size="sm" variant="outline" onClick={onOpenSaves}>打开存档</Button>
          </SoftRow>
          <SoftRow className="flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-100"><HardDrive className="h-4 w-4 text-[rgb(var(--accent-rgb))]" />本地文件</div>
              <div className="mt-1 text-xs text-slate-500">{imageSummary}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => onOpenSettings?.('local')}>数据目录</Button>
              {onOpenTasks && <Button size="sm" variant="ghost" onClick={() => onOpenTasks(null, { statusFilter: 'attention' })}>任务日志</Button>}
            </div>
          </SoftRow>
        </div>
      </PanelContent>
    </Panel>
  );
}

function RecentTasksPanel({ tasks, onOpenTasks }: { tasks: TaskRecord[]; onOpenTasks?: (taskId?: string | null, preset?: TaskFilterPreset | null) => void }) {
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const taskSummary = useMemo(() => deriveDashboardTaskSummary(tasks), [tasks]);

  async function retryFromDashboard(id: string) {
    setRetryingId(id);
    try {
      const task = await api.retryTask(id);
      setActionError(null);
      onOpenTasks?.(task.id, { typeFilter: task.taskType });
    } catch (reason) {
      setActionError(errorMessage(reason));
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <Panel>
      <PanelHeader
        title="近期任务"
        description={taskSummary.activeCount > 0 ? `${taskSummary.activeCount} 个任务需要关注` : '扫描、备份、导出和路径检查会出现在这里。'}
        icon={<Activity className="h-4 w-4" />}
        actions={onOpenTasks && (
          <>
            <Button disabled={taskSummary.attentionCount === 0} size="sm" variant="outline" onClick={() => onOpenTasks(null, { statusFilter: 'attention' })}>需处理 {taskSummary.attentionCount}</Button>
            <Button disabled={taskSummary.runningCount === 0} size="sm" variant="outline" onClick={() => onOpenTasks(null, { statusFilter: 'active' })}>进行中 {taskSummary.runningCount}</Button>
            <Button disabled={taskSummary.completedCount === 0} size="sm" variant="outline" onClick={() => onOpenTasks(null, { statusFilter: 'completed' })}>已完成 {taskSummary.completedCount}</Button>
            <Button size="sm" variant="outline" onClick={() => onOpenTasks()}>全部任务</Button>
          </>
        )}
      />
      <PanelContent className="space-y-2">
        {actionError && <Notice tone="error">{actionError}</Notice>}
        {tasks.length === 0 ? (
          <EmptyState className="py-7">暂无任务记录。开始扫描、备份或批量匹配后会在这里看到进度。</EmptyState>
        ) : (
          <>
            {taskSummary.recentResults.length > 0 && (
              <div aria-label="首页最近任务结果" className="space-y-2 rounded-md border border-white/10 bg-black/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-slate-100">最近结果</div>
                    <div className="mt-0.5 text-xs text-slate-500">最近结束的任务可以直接打开日志复核。</div>
                  </div>
                  <Badge>{taskSummary.recentResults.length} 条</Badge>
                </div>
                <div className="grid gap-2 xl:grid-cols-2">
                  {taskSummary.recentResults.map((task) => (
                    <div className="rounded-md border border-white/10 bg-black/15 px-3 py-3" data-task-result-id={task.id} key={task.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={taskStatusClass(task.status)}>{taskStatusLabel(task.status)}</Badge>
                        <span className="truncate text-xs font-medium text-slate-300">{taskLabel(task.taskType)}</span>
                      </div>
                      <div className="mt-2 line-clamp-2 text-sm text-slate-100">{task.message || task.error || '任务已结束。'}</div>
                      {task.error && <div className="mt-1 line-clamp-1 text-xs text-rose-200">{task.error}</div>}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500">{formatDateTime(task.updatedAt)}</span>
                        <div className="flex items-center justify-end gap-2">
                          {onOpenTasks && <Button size="sm" variant="ghost" onClick={() => onOpenTasks(task.id)}>日志</Button>}
                          {canRetryDashboardTask(task) && <Button disabled={retryingId === task.id} size="sm" variant="outline" onClick={() => void retryFromDashboard(task.id)}><RotateCcw className="h-4 w-4" />{retryingId === task.id ? '重试中' : '重试'}</Button>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {tasks.map((task) => (
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
          </>
        )}
      </PanelContent>
    </Panel>
  );
}

function AttentionIcon({ kind }: { kind: DashboardAttentionItem['kind'] }) {
  switch (kind) {
    case 'failed_tasks':
      return <Activity className="h-4 w-4" />;
    case 'running_tasks':
      return <Clock3 className="h-4 w-4" />;
    case 'path_health':
      return <HardDrive className="h-4 w-4" />;
    case 'missing_artwork':
      return <ImageOff className="h-4 w-4" />;
    case 'missing_external_ids':
      return <Search className="h-4 w-4" />;
    case 'database_backup':
      return <Database className="h-4 w-4" />;
  }
}

function openAttentionItem(item: DashboardAttentionItem, actions: { onOpenLibrary?: (preset?: LibraryFilterPreset | null) => void; onOpenMaintenance?: (section?: string | null) => void; onOpenMetadata?: (preset?: { query?: string; missingProvider?: string } | null) => void; onOpenSettings?: (tab?: SettingsTab) => void; onOpenTasks?: (taskId?: string | null, preset?: TaskFilterPreset | null) => void }) {
  switch (item.action) {
    case 'tasks_attention':
      actions.onOpenTasks?.(null, { statusFilter: 'attention' });
      break;
    case 'tasks_active':
      actions.onOpenTasks?.(null, { statusFilter: 'active' });
      break;
    case 'library_paths':
      actions.onOpenLibrary?.({ pathStatus: 'broken' });
      break;
    case 'maintenance_artwork':
      actions.onOpenMaintenance?.('artwork');
      break;
    case 'metadata_missing_ids':
      actions.onOpenMetadata?.({ missingProvider: 'all' });
      break;
    case 'settings_local':
      actions.onOpenSettings?.('local');
      break;
  }
}
