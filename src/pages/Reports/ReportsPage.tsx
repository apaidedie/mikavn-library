import { AlertTriangle, BarChart3, CalendarDays, Clock3, Download, History, ImageOff, Link2Off, Wrench } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/notice';
import { MetricTile, PageFrame, PageHeader, PageShell, Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import { TaskNotice } from '@/components/ui/task-notice';
import { api } from '@/services/api';
import { chooseMarkdownSavePath } from '@/services/dialog';
import type { LibraryFilterPreset } from '@/types/game';
import type { ReportGapExample, ReportSummary } from '@/types/reports';
import { formatPlayTime } from '@/utils/time';

type TaskMessage = { text: string; taskId?: string | null };

export function ReportsPage({ refreshKey, onOpenTask, onOpenLibrary, onOpenGame }: { refreshKey: number; onOpenTask?: (taskId: string) => void; onOpenLibrary?: (preset?: LibraryFilterPreset | null) => void; onOpenGame?: (gameId: string) => void }) {
  const reportLoadRequestRef = useRef(0);
  const [summary, setSummary] = useState<ReportSummary>(() => emptyReportSummary());
  const [message, setMessage] = useState<TaskMessage | null>(null);

  useEffect(() => {
    const requestId = ++reportLoadRequestRef.current;
    const loadReportData = async () => {
      const nextSummary = await api.getReportSummary().catch(() => emptyReportSummary());
      if (requestId !== reportLoadRequestRef.current) return;
      setSummary(nextSummary);
    };
    void loadReportData();
    return () => {
      reportLoadRequestRef.current += 1;
    };
  }, [refreshKey]);

  const exportMarkdown = async () => {
    const content = buildMarkdown(summary);
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
        <MetricTile icon={<Clock3 className="h-4 w-4" />} label="累计游玩" value={formatPlayTime(summary.totalPlaySeconds)} />
        <MetricTile icon={<CalendarDays className="h-4 w-4" />} label="本周游玩" value={formatPlayTime(summary.weekPlaySeconds)} />
        <MetricTile icon={<History className="h-4 w-4" />} label="本月游玩" value={formatPlayTime(summary.monthPlaySeconds)} />
        <MetricTile icon={<BarChart3 className="h-4 w-4" />} label="报告条目" value={`${summary.totalGames}`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <StatCard title="状态分布" items={summary.status} />
        <StatCard title="标签 Top" items={summary.tags} />
        <StatCard title="会社 Top" items={summary.developers} />
        <StatCard title="游玩时间 Top" items={summary.playtime.map((item) => ({ label: item.label, value: formatPlayTime(item.seconds) }))} />
      </div>

      <Panel>
        <PanelHeader title="元数据完整度" />
        <PanelContent className="grid gap-3 md:grid-cols-4">
          <Completeness label="封面" value={summary.completeness.cover} total={summary.totalGames} />
          <Completeness label="简介" value={summary.completeness.description} total={summary.totalGames} />
          <Completeness label="发售日" value={summary.completeness.releaseDate} total={summary.totalGames} />
          <Completeness label="外部 ID" value={summary.completeness.externalIds} total={summary.totalGames} />
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader title="可处理缺口" description="从报告直接定位需要补图、补 ID 或修路径的条目。" />
        <PanelContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ActionableGap
            actionLabel="在游戏库查看缺封面"
            count={summary.gaps.missingCover}
            detail="封面字段为空"
            examples={summary.gaps.examples.missingCover}
            icon={<ImageOff className="h-4 w-4" />}
            label="缺封面"
            onOpen={onOpenLibrary ? () => onOpenLibrary({ metadataStatus: 'missing_cover' }) : undefined}
            onOpenExample={onOpenGame}
          />
          <ActionableGap
            actionLabel="在游戏库查看缺简介图片"
            count={summary.gaps.missingDescriptionImage}
            detail="DLsite / FANZA 条目简介未含图片"
            examples={summary.gaps.examples.missingDescriptionImage}
            icon={<ImageOff className="h-4 w-4" />}
            label="缺简介图片"
            onOpen={onOpenLibrary ? () => onOpenLibrary({ metadataStatus: 'missing_description_image' }) : undefined}
            onOpenExample={onOpenGame}
          />
          <ActionableGap
            actionLabel="在游戏库查看缺外部 ID"
            count={summary.gaps.missingExternalIds}
            detail="VNDB / DLsite / FANZA 等全为空"
            examples={summary.gaps.examples.missingExternalIds}
            icon={<Link2Off className="h-4 w-4" />}
            label="缺外部 ID"
            onOpen={onOpenLibrary ? () => onOpenLibrary({ metadataStatus: 'missing_external_id' }) : undefined}
            onOpenExample={onOpenGame}
          />
          <ActionableGap
            actionLabel="在游戏库查看路径异常"
            count={summary.gaps.brokenPath}
            detail="安装目录或启动路径异常"
            examples={summary.gaps.examples.brokenPath}
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

function emptyReportSummary(): ReportSummary {
  return {
    totalGames: 0,
    totalPlaySeconds: 0,
    weekPlaySeconds: 0,
    monthPlaySeconds: 0,
    status: [],
    tags: [],
    developers: [],
    playtime: [],
    completeness: { cover: 0, description: 0, releaseDate: 0, externalIds: 0 },
    gaps: {
      missingCover: 0,
      missingDescriptionImage: 0,
      missingExternalIds: 0,
      brokenPath: 0,
      examples: { missingCover: [], missingDescriptionImage: [], missingExternalIds: [], brokenPath: [] },
    },
  };
}

function buildMarkdown(summary: ReportSummary) {
  const lines = [
    '# MikaVN Library 游玩报告',
    '',
    `- 生成时间：${new Date().toISOString()}`,
    `- 报告条目：${summary.totalGames}`,
    `- 累计游玩：${formatPlayTime(summary.totalPlaySeconds)}`,
    `- 本周游玩：${formatPlayTime(summary.weekPlaySeconds)}`,
    `- 本月游玩：${formatPlayTime(summary.monthPlaySeconds)}`,
    '',
    '## 状态分布',
    ...summary.status.map((item) => `- ${item.label}: ${item.value}`),
    '',
    '## 标签 Top',
    ...summary.tags.map((item) => `- ${item.label}: ${item.value}`),
    '',
    '## 会社 Top',
    ...summary.developers.map((item) => `- ${item.label}: ${item.value}`),
    '',
    '## 游玩时间 Top',
    ...summary.playtime.map((item) => `- ${item.label}: ${formatPlayTime(item.seconds)}`),
    '',
    '## 可处理缺口',
    `- 缺封面: ${summary.gaps.missingCover}`,
    `  - 样例: ${formatGapExamples(summary.gaps.examples.missingCover)}`,
    `- 缺简介图片: ${summary.gaps.missingDescriptionImage}`,
    `  - 样例: ${formatGapExamples(summary.gaps.examples.missingDescriptionImage)}`,
    `- 缺外部 ID: ${summary.gaps.missingExternalIds}`,
    `  - 样例: ${formatGapExamples(summary.gaps.examples.missingExternalIds)}`,
    `- 路径异常: ${summary.gaps.brokenPath}`,
    `  - 样例: ${formatGapExamples(summary.gaps.examples.brokenPath)}`,
  ];
  return `${lines.join('\n')}\n`;
}

function formatGapExamples(examples: ReportGapExample[]) {
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

function ActionableGap({ actionLabel, count, detail, examples, icon, label, onOpen, onOpenExample }: { actionLabel: string; count: number; detail: string; examples: ReportGapExample[]; icon: ReactNode; label: string; onOpen?: () => void; onOpenExample?: (gameId: string) => void }) {
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
