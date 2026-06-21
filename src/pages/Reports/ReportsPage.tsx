import { AlertTriangle, BarChart3, CalendarDays, Clock3, Download, History, ImageOff, Link2Off, Wrench } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/notice';
import { MetricTile, PageFrame, PageHeader, PageShell, Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import { TaskNotice } from '@/components/ui/task-notice';
import { api } from '@/services/api';
import { chooseMarkdownSavePath } from '@/services/dialog';
import type { Game, LibraryFilterPreset } from '@/types/game';
import { PLAY_STATUS_LABEL } from '@/types/game';
import { formatPlayTime } from '@/utils/time';

type TaskMessage = { text: string; taskId?: string | null };
type GapExample = { id: string; title: string };

export function ReportsPage({ refreshKey, onOpenTask, onOpenLibrary, onOpenGame }: { refreshKey: number; onOpenTask?: (taskId: string) => void; onOpenLibrary?: (preset?: LibraryFilterPreset | null) => void; onOpenGame?: (gameId: string) => void }) {
  const reportLoadRequestRef = useRef(0);
  const [games, setGames] = useState<Game[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<TaskMessage | null>(null);

  useEffect(() => {
    const requestId = ++reportLoadRequestRef.current;
    const loadReportData = async () => {
      const [gameList, nextSettings] = await Promise.all([
        api.listGames({ sortBy: 'updated_at', sortDirection: 'desc' }).catch(() => []),
        api.getAppSettings().catch(() => ({})),
      ]);
      if (requestId !== reportLoadRequestRef.current) return;
      setGames(gameList);
      setSettings(nextSettings);
    };
    void loadReportData();
    return () => {
      reportLoadRequestRef.current += 1;
    };
  }, [refreshKey]);

  const visibleGames = useMemo(() => settings.privacy_filter_reports === 'false' ? games : games.filter((game) => !game.hidden && game.ageRating !== 'R18'), [games, settings]);
  const stats = useMemo(() => buildStats(visibleGames), [visibleGames]);

  const exportMarkdown = async () => {
    const content = buildMarkdown(visibleGames, stats);
    const path = await chooseMarkdownSavePath(`mikavn-report-${new Date().toISOString().slice(0, 10)}.md`);
    if (!path) return;
    const task = await api.exportReportMarkdownTask(path, content);
    setMessage({ text: `报告导出任务已创建：${task.id}`, taskId: task.id });
  };

  return (
    <PageShell>
      <PageFrame>
      <PageHeader
        title="游玩报告"
        description="统计会遵守隐私设置中的报告过滤选项。"
        actions={<Button onClick={exportMarkdown}><Download className="h-4 w-4" />导出 Markdown</Button>}
      />
      {message && <TaskNotice message={message.text} taskId={message.taskId} onOpenTask={onOpenTask} />}

      <div className="grid gap-3 md:grid-cols-4">
        <MetricTile icon={<Clock3 className="h-4 w-4" />} label="累计游玩" value={formatPlayTime(stats.totalPlaySeconds)} />
        <MetricTile icon={<CalendarDays className="h-4 w-4" />} label="本周游玩" value={formatPlayTime(stats.weekPlaySeconds)} />
        <MetricTile icon={<History className="h-4 w-4" />} label="本月游玩" value={formatPlayTime(stats.monthPlaySeconds)} />
        <MetricTile icon={<BarChart3 className="h-4 w-4" />} label="报告条目" value={`${visibleGames.length}`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <StatCard title="状态分布" items={stats.status} />
        <StatCard title="标签 Top" items={stats.tags} />
        <StatCard title="会社 Top" items={stats.developers} />
        <StatCard title="游玩时间 Top" items={stats.playtime.map((item) => ({ label: item.label, value: formatPlayTime(item.seconds) }))} />
      </div>

      <Panel>
        <PanelHeader title="元数据完整度" />
        <PanelContent className="grid gap-3 md:grid-cols-4">
          <Completeness label="封面" value={stats.completeness.cover} total={visibleGames.length} />
          <Completeness label="简介" value={stats.completeness.description} total={visibleGames.length} />
          <Completeness label="发售日" value={stats.completeness.releaseDate} total={visibleGames.length} />
          <Completeness label="外部 ID" value={stats.completeness.externalIds} total={visibleGames.length} />
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader title="可处理缺口" description="从报告直接定位需要补图、补 ID 或修路径的条目。" />
        <PanelContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ActionableGap
            actionLabel="在游戏库查看缺封面"
            count={stats.gaps.missingCover}
            detail="封面字段为空"
            examples={stats.gaps.examples.missingCover}
            icon={<ImageOff className="h-4 w-4" />}
            label="缺封面"
            onOpen={onOpenLibrary ? () => onOpenLibrary({ metadataStatus: 'missing_cover' }) : undefined}
            onOpenExample={onOpenGame}
          />
          <ActionableGap
            actionLabel="在游戏库查看缺简介图片"
            count={stats.gaps.missingDescriptionImage}
            detail="DLsite / FANZA 条目简介未含图片"
            examples={stats.gaps.examples.missingDescriptionImage}
            icon={<ImageOff className="h-4 w-4" />}
            label="缺简介图片"
            onOpen={onOpenLibrary ? () => onOpenLibrary({ metadataStatus: 'missing_description_image' }) : undefined}
            onOpenExample={onOpenGame}
          />
          <ActionableGap
            actionLabel="在游戏库查看缺外部 ID"
            count={stats.gaps.missingExternalIds}
            detail="VNDB / DLsite / FANZA 等全为空"
            examples={stats.gaps.examples.missingExternalIds}
            icon={<Link2Off className="h-4 w-4" />}
            label="缺外部 ID"
            onOpen={onOpenLibrary ? () => onOpenLibrary({ metadataStatus: 'missing_external_id' }) : undefined}
            onOpenExample={onOpenGame}
          />
          <ActionableGap
            actionLabel="在游戏库查看路径异常"
            count={stats.gaps.brokenPath}
            detail="安装目录或启动路径异常"
            examples={stats.gaps.examples.brokenPath}
            icon={<AlertTriangle className="h-4 w-4" />}
            label="路径异常"
            onOpen={onOpenLibrary ? () => onOpenLibrary({ pathStatus: 'broken' }) : undefined}
            onOpenExample={onOpenGame}
          />
        </PanelContent>
      </Panel>
      </PageFrame>
    </PageShell>
  );
}

function buildStats(games: Game[]) {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
  const playedSince = (since: number) => games
    .filter((game) => game.lastPlayedAt && Date.parse(game.lastPlayedAt) >= since)
    .reduce((sum, game) => sum + game.totalPlaySeconds, 0);

  return {
    totalPlaySeconds: games.reduce((sum, game) => sum + game.totalPlaySeconds, 0),
    weekPlaySeconds: playedSince(weekAgo),
    monthPlaySeconds: playedSince(monthAgo),
    status: countValues(games.map((game) => PLAY_STATUS_LABEL[game.playStatus] ?? game.playStatus)),
    tags: countValues(games.flatMap((game) => game.tags)).slice(0, 8),
    developers: countValues(games.map((game) => game.developer || game.brand || '未填写')).slice(0, 8),
    playtime: [...games].sort((a, b) => b.totalPlaySeconds - a.totalPlaySeconds).slice(0, 8).map((game) => ({ label: game.title, seconds: game.totalPlaySeconds })),
    completeness: {
      cover: games.filter((game) => game.coverImage).length,
      description: games.filter((game) => game.description).length,
      releaseDate: games.filter((game) => game.releaseDate).length,
      externalIds: games.filter((game) => game.vndbId || game.dlsiteId || game.fanzaId || game.bangumiId || game.ymgalId).length,
    },
    gaps: {
      missingCover: games.filter((game) => !game.coverImage?.trim()).length,
      missingDescriptionImage: games.filter((game) => Boolean((game.dlsiteId?.trim() || game.fanzaId?.trim()) && !hasDescriptionImage(game.description))).length,
      missingExternalIds: games.filter((game) => !(game.vndbId?.trim() || game.dlsiteId?.trim() || game.fanzaId?.trim() || game.bangumiId?.trim() || game.ymgalId?.trim())).length,
      brokenPath: games.filter((game) => game.pathStatus === 'broken').length,
      examples: {
        missingCover: gapExamples(games.filter((game) => !game.coverImage?.trim())),
        missingDescriptionImage: gapExamples(games.filter((game) => Boolean((game.dlsiteId?.trim() || game.fanzaId?.trim()) && !hasDescriptionImage(game.description)))),
        missingExternalIds: gapExamples(games.filter((game) => !(game.vndbId?.trim() || game.dlsiteId?.trim() || game.fanzaId?.trim() || game.bangumiId?.trim() || game.ymgalId?.trim()))),
        brokenPath: gapExamples(games.filter((game) => game.pathStatus === 'broken')),
      },
    },
  };
}

function gapExamples(games: Game[]) {
  return games.slice(0, 3).map((game) => ({ id: game.id, title: game.title }));
}

function hasDescriptionImage(description?: string | null) {
  return Boolean(description && /!\[[^\]]*\]\([^\)]+\)|<img\b/i.test(description));
}

function countValues(values: string[]) {
  const map = new Map<string, number>();
  for (const value of values.filter(Boolean)) map.set(value, (map.get(value) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
}

function buildMarkdown(games: Game[], stats: ReturnType<typeof buildStats>) {
  const lines = [
    '# MikaVN Library 游玩报告',
    '',
    `- 生成时间：${new Date().toISOString()}`,
    `- 报告条目：${games.length}`,
    `- 累计游玩：${formatPlayTime(stats.totalPlaySeconds)}`,
    `- 本周游玩：${formatPlayTime(stats.weekPlaySeconds)}`,
    `- 本月游玩：${formatPlayTime(stats.monthPlaySeconds)}`,
    '',
    '## 状态分布',
    ...stats.status.map((item) => `- ${item.label}: ${item.value}`),
    '',
    '## 标签 Top',
    ...stats.tags.map((item) => `- ${item.label}: ${item.value}`),
    '',
    '## 会社 Top',
    ...stats.developers.map((item) => `- ${item.label}: ${item.value}`),
    '',
    '## 游玩时间 Top',
    ...stats.playtime.map((item) => `- ${item.label}: ${formatPlayTime(item.seconds)}`),
    '',
    '## 可处理缺口',
    `- 缺封面: ${stats.gaps.missingCover}`,
    `  - 样例: ${formatGapExamples(stats.gaps.examples.missingCover)}`,
    `- 缺简介图片: ${stats.gaps.missingDescriptionImage}`,
    `  - 样例: ${formatGapExamples(stats.gaps.examples.missingDescriptionImage)}`,
    `- 缺外部 ID: ${stats.gaps.missingExternalIds}`,
    `  - 样例: ${formatGapExamples(stats.gaps.examples.missingExternalIds)}`,
    `- 路径异常: ${stats.gaps.brokenPath}`,
    `  - 样例: ${formatGapExamples(stats.gaps.examples.brokenPath)}`,
  ];
  return `${lines.join('\n')}\n`;
}

function formatGapExamples(examples: GapExample[]) {
  return examples.length > 0 ? examples.map((example) => example.title).join(' / ') : '无';
}

function StatCard({ title, items }: { title: string; items: Array<{ label: string; value: number | string }> }) {
  const numericMax = Math.max(1, ...items.map((item) => typeof item.value === 'number' ? item.value : 0));
  return (
    <Panel>
      <PanelHeader title={title} />
      <PanelContent className="space-y-2">
        {items.length === 0 ? <EmptyState className="py-8">暂无数据。</EmptyState> : items.map((item) => (
          <SoftRow className="px-3 py-2" key={item.label}>
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-sm text-slate-300">{item.label}</span>
              <Badge>{item.value}</Badge>
            </div>
            {typeof item.value === 'number' && (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/20">
                <div className="h-full rounded-full bg-[rgb(var(--accent-rgb)/0.72)]" style={{ width: `${Math.max(6, Math.round((item.value / numericMax) * 100))}%` }} />
              </div>
            )}
          </SoftRow>
        ))}
      </PanelContent>
    </Panel>
  );
}

function ActionableGap({ actionLabel, count, detail, examples, icon, label, onOpen, onOpenExample }: { actionLabel: string; count: number; detail: string; examples: GapExample[]; icon: ReactNode; label: string; onOpen?: () => void; onOpenExample?: (gameId: string) => void }) {
  const toneClass = count > 0 ? 'border-amber-300/25 bg-amber-300/10 text-amber-100' : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100';
  return (
    <SoftRow className="px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${toneClass}`}>{icon}</span>
            <span>{label}</span>
          </div>
          <div className="text-xs text-slate-500">{detail}</div>
        </div>
        <Badge>{count}</Badge>
      </div>
      <div className="mt-3 min-h-[2.25rem] space-y-1">
        <div className="text-[11px] font-medium text-slate-500">样例</div>
        {examples.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {examples.map((example) => (
              <button
                className="motion-button max-w-full truncate rounded-md border border-white/10 bg-black/15 px-2 py-1 text-left text-xs text-slate-300 hover:border-[rgb(var(--accent-rgb)/0.5)] hover:bg-[rgb(var(--accent-rgb)/0.16)] hover:text-slate-100 disabled:cursor-default disabled:hover:border-white/10 disabled:hover:bg-black/15 disabled:hover:text-slate-300"
                disabled={!onOpenExample}
                key={example.id}
                onClick={() => onOpenExample?.(example.id)}
                title={example.title}
                type="button"
              >
                {example.title}
              </button>
            ))}
          </div>
        ) : <div className="text-xs text-slate-500">无</div>}
      </div>
      <Button className="mt-3 w-full justify-center" disabled={!onOpen || count === 0} size="sm" variant="outline" onClick={onOpen}>
        <Wrench className="h-4 w-4" />{actionLabel}
      </Button>
    </SoftRow>
  );
}

function Completeness({ label, value, total }: { label: string; value: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <MetricTile
      detail={(
        <span className="block">
          <span>{value}/{total}</span>
          <span className="mt-2 block h-1 overflow-hidden rounded-full bg-black/20">
            <span className="block h-full rounded-full bg-[rgb(var(--accent-rgb)/0.72)]" style={{ width: `${percent}%` }} />
          </span>
        </span>
      )}
      label={label}
      value={`${percent}%`}
    />
  );
}
