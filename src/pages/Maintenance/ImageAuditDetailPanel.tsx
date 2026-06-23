import { Copy, FolderOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SoftRow } from '@/components/ui/page';
import type { ImageReferenceAudit, ImageReferenceAuditItem } from '@/types/archive';
import {
  formatImageAuditCount as formatCount,
  imageAuditRecommendation,
  imageBadgeClass,
  imageFieldLabel,
  imageIssueLabel,
  isRevealableImageAuditPath,
  summarizeImageAuditGames,
  summarizeImageAuditSources,
  type ImageAuditGameSummary,
  type ImageAuditSourceSummary,
} from './imageAuditDetailModel';

export function ImageAuditDetailPanel({ audit, filteredItems, issueFilter, query, onIssueFilterChange, onOpenGame, onQueryChange, onResetFilters, onRevealPath }: { audit: ImageReferenceAudit; filteredItems: ImageReferenceAuditItem[]; issueFilter: string; query: string; onIssueFilterChange: (value: string) => void; onOpenGame?: (gameId: string) => void; onQueryChange: (value: string) => void; onResetFilters: () => void; onRevealPath?: (path: string) => void }) {
  const summaries = summarizeImageAuditSources(audit.items);
  const gameSummaries = summarizeImageAuditGames(audit.items);
  const focusIssueFilter = (value: string) => {
    onQueryChange('');
    onIssueFilterChange(value);
  };
  const focusGameSummary = (summary: ImageAuditGameSummary) => {
    onIssueFilterChange('all');
    onQueryChange(summary.gameId || summary.title);
  };
  const focusSourceSummary = (summary: ImageAuditSourceSummary) => {
    onIssueFilterChange('all');
    onQueryChange(summary.label);
  };

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <ImageAuditCompactStat label="图片引用" value={audit.totalRefs} />
        <ImageAuditCompactStat actionLabel="显示全部问题" label="问题引用" onClick={() => focusIssueFilter('all')} value={audit.issueCount} tone={audit.issueCount > 0 ? 'warn' : 'ok'} />
        <ImageAuditCompactStat actionLabel="按 缺失本地文件 筛选" label="缺失本地文件" onClick={() => focusIssueFilter('missing')} value={audit.missingCount} tone={audit.missingCount > 0 ? 'warn' : 'ok'} />
        <ImageAuditCompactStat actionLabel="按 C 盘残留筛选" label="C 盘残留" onClick={() => focusIssueFilter('c_drive')} value={audit.cDriveCount} tone={audit.cDriveCount > 0 ? 'warn' : 'ok'} />
        <ImageAuditCompactStat actionLabel="按 Playnite 残留筛选" label="Playnite 残留" onClick={() => focusIssueFilter('playnite')} value={audit.playniteCount} tone={audit.playniteCount > 0 ? 'warn' : 'ok'} />
      </div>
      {summaries.length > 0 && <ImageAuditSourceSummaryGrid onFocusSummary={focusSourceSummary} summaries={summaries} />}
      {gameSummaries.length > 0 && <ImageAuditGameSummaryGrid onFocusSummary={focusGameSummary} onOpenGame={onOpenGame} summaries={gameSummaries} />}
      <SoftRow className="grid gap-2 px-3 py-3 md:grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)_auto] md:items-end">
        <label className="min-w-0 text-xs text-slate-500">
          搜索图片引用
          <Input aria-label="图片引用搜索" className="mt-1 w-full" placeholder="游戏 / 字段 / 路径 / 问题" value={query} onChange={(event) => onQueryChange(event.target.value)} />
        </label>
        <label className="min-w-0 text-xs text-slate-500">
          问题类型
          <Select aria-label="图片引用问题筛选" className="mt-1 w-full" value={issueFilter} onChange={(event) => onIssueFilterChange(event.target.value)}>
            <option value="all">全部问题</option>
            <option value="missing">缺失本地文件</option>
            <option value="c_drive">C 盘残留</option>
            <option value="playnite">Playnite 残留</option>
          </Select>
        </label>
        <Button className="h-9" disabled={!query.trim() && issueFilter === 'all'} size="sm" variant="outline" onClick={onResetFilters}>重置筛选</Button>
      </SoftRow>
      {audit.items.length > 0 ? (
        <div className="space-y-2">
          <div className="px-1 text-xs text-slate-500">当前显示 {formatCount(filteredItems.length)} / {formatCount(audit.items.length)} 条引用。</div>
          {filteredItems.length > 0 ? filteredItems.map((item, index) => <ImageAuditRow item={item} key={`${item.gameId ?? 'game'}-${item.sourceKind}-${item.fieldName ?? 'field'}-${item.value}-${index}`} onOpenGame={onOpenGame} onRevealPath={onRevealPath} />) : <SoftRow className="px-3 py-3 text-sm text-slate-400">当前筛选没有匹配的图片引用。</SoftRow>}
          {audit.truncated && <div className="px-1 text-xs text-slate-500">结果较多，当前只显示前 80 条问题引用。</div>}
        </div>
      ) : (
        <SoftRow className="px-3 py-3 text-sm text-slate-400">没有发现需要处理的图片引用。</SoftRow>
      )}
    </>
  );
}

function ImageAuditSourceSummaryGrid({ summaries, onFocusSummary }: { summaries: ImageAuditSourceSummary[]; onFocusSummary: (summary: ImageAuditSourceSummary) => void }) {
  return (
    <div aria-label="图片引用来源分布" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-slate-100">问题来源分布</div>
        <div className="text-xs text-slate-500">按封面、背景、简介图和媒体图库归类。</div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {summaries.map((summary) => <ImageAuditSourceSummaryCard key={summary.key} onFocusSummary={onFocusSummary} summary={summary} />)}
      </div>
    </div>
  );
}

function ImageAuditSourceSummaryCard({ summary, onFocusSummary }: { summary: ImageAuditSourceSummary; onFocusSummary: (summary: ImageAuditSourceSummary) => void }) {
  const issueParts = [
    summary.missingCount > 0 ? `缺失 ${formatCount(summary.missingCount)}` : '',
    summary.cDriveCount > 0 ? `C 盘 ${formatCount(summary.cDriveCount)}` : '',
    summary.playniteCount > 0 ? `Playnite ${formatCount(summary.playniteCount)}` : '',
  ].filter(Boolean);
  return (
    <SoftRow data-image-audit-source={summary.label} className="grid gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">{summary.label}</span>
          <span data-image-audit-source-count="true" className="font-mono text-sm text-amber-200">{formatCount(summary.issueCount)}</span>
        </div>
        <div className="mt-1 truncate text-[11px] text-slate-600" title={issueParts.join(' · ')}>{issueParts.join(' · ') || '无细分问题'}</div>
      </div>
      <Button className="h-7 px-2" size="sm" variant="outline" onClick={() => onFocusSummary(summary)}>定位</Button>
    </SoftRow>
  );
}

function ImageAuditGameSummaryGrid({ summaries, onFocusSummary, onOpenGame }: { summaries: ImageAuditGameSummary[]; onFocusSummary: (summary: ImageAuditGameSummary) => void; onOpenGame?: (gameId: string) => void }) {
  const visibleSummaries = summaries.slice(0, 6);
  const hiddenCount = summaries.length - visibleSummaries.length;
  return (
    <div aria-label="图片引用游戏分布" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-slate-100">问题游戏分布</div>
        <div className="text-xs text-slate-500">按游戏聚合问题引用，优先显示问题最多的条目。</div>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        {visibleSummaries.map((summary) => <ImageAuditGameSummaryCard key={summary.key} onFocusSummary={onFocusSummary} onOpenGame={onOpenGame} summary={summary} />)}
      </div>
      {hiddenCount > 0 && <div className="px-1 text-xs text-slate-500">还有 {formatCount(hiddenCount)} 个游戏存在图片引用问题，可用下方搜索继续定位。</div>}
    </div>
  );
}

function ImageAuditGameSummaryCard({ summary, onFocusSummary, onOpenGame }: { summary: ImageAuditGameSummary; onFocusSummary: (summary: ImageAuditGameSummary) => void; onOpenGame?: (gameId: string) => void }) {
  return (
    <SoftRow data-image-audit-game={summary.gameId ?? summary.key} className="grid gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-slate-100" title={summary.title}>{summary.title}</span>
          <span data-image-audit-game-count="true" className="font-mono text-sm text-amber-200">{formatCount(summary.issueCount)}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {summary.sourceLabels.slice(0, 4).map((label) => <Badge key={label}>{label}</Badge>)}
          {summary.issues.slice(0, 4).map((issue) => <Badge className={imageBadgeClass(issue)} key={issue}>{imageIssueLabel(issue)}</Badge>)}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        <Button className="h-7 px-2" size="sm" variant="outline" onClick={() => onFocusSummary(summary)}>定位</Button>
        {summary.gameId && onOpenGame && <Button className="h-7 px-2" size="sm" variant="ghost" onClick={() => onOpenGame(summary.gameId!)}>游戏</Button>}
      </div>
    </SoftRow>
  );
}

function ImageAuditRow({ item, onOpenGame, onRevealPath }: { item: ImageReferenceAuditItem; onOpenGame?: (gameId: string) => void; onRevealPath?: (path: string) => void }) {
  const title = item.gameTitle?.trim() || item.gameId || '未知游戏';
  const issues = item.issues.length > 0 ? item.issues : [item.status];
  const recommendation = imageAuditRecommendation(issues);
  const copyableOriginalPath = item.value.trim();
  const copyableResolvedPath = item.resolvedPath?.trim() || null;
  const revealableOriginalPath = isRevealableImageAuditPath(item.value) ? item.value.trim() : null;
  const revealableResolvedPath = item.resolvedPath && isRevealableImageAuditPath(item.resolvedPath) ? item.resolvedPath.trim() : null;
  return (
    <SoftRow className="grid gap-3 px-3 py-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]" data-image-audit-row="true">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-slate-100" title={title}>{title}</span>
          <Badge>{item.sourceLabel}</Badge>
          {item.fieldName && <Badge>{imageFieldLabel(item.fieldName)}</Badge>}
          {copyableOriginalPath && <Button aria-label="复制原始路径" className="h-7 px-2" size="sm" title="复制原始路径" variant="outline" onClick={() => void copyImageAuditPath(copyableOriginalPath)}><Copy className="h-4 w-4" />原始</Button>}
          {copyableResolvedPath && <Button aria-label="复制解析路径" className="h-7 px-2" size="sm" title="复制解析路径" variant="outline" onClick={() => void copyImageAuditPath(copyableResolvedPath)}><Copy className="h-4 w-4" />解析</Button>}
          {revealableOriginalPath && onRevealPath && <Button aria-label="打开原始路径" className="h-7 px-2" size="sm" title="打开原始路径" variant="outline" onClick={() => onRevealPath(revealableOriginalPath)}><FolderOpen className="h-4 w-4" />原始</Button>}
          {revealableResolvedPath && onRevealPath && <Button aria-label="打开解析路径" className="h-7 px-2" size="sm" title="打开解析路径" variant="outline" onClick={() => onRevealPath(revealableResolvedPath)}><FolderOpen className="h-4 w-4" />解析</Button>}
          {item.gameId && onOpenGame && <Button className="h-7 px-2" size="sm" variant="ghost" onClick={() => onOpenGame(item.gameId!)}>游戏</Button>}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {issues.map((issue) => <Badge className={imageBadgeClass(issue)} key={issue}>{imageIssueLabel(issue)}</Badge>)}
        </div>
      </div>
      <div className="min-w-0 space-y-1 text-[11px] leading-5">
        <div className="grid gap-1 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
          <span className="text-slate-600">处理建议</span>
          <span className="text-slate-400">{recommendation}</span>
        </div>
        <div className="grid gap-1 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
          <span className="text-slate-600">原始值</span>
          <span className="break-all font-mono text-slate-300">{item.value}</span>
        </div>
        {item.resolvedPath && (
          <div className="grid gap-1 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
            <span className="text-slate-600">解析路径</span>
            <span className="break-all font-mono text-slate-500">{item.resolvedPath}</span>
          </div>
        )}
      </div>
    </SoftRow>
  );
}

async function copyImageAuditPath(path: string) {
  await navigator.clipboard.writeText(path);
}

function ImageAuditCompactStat({ actionLabel, label, onClick, value, tone = 'neutral' }: { actionLabel?: string; label: string; onClick?: () => void; value: number | string; tone?: 'neutral' | 'ok' | 'warn' }) {
  const toneClass = tone === 'ok' ? 'text-emerald-200' : tone === 'warn' ? 'text-amber-200' : 'text-slate-200';
  const displayValue = typeof value === 'number' ? formatCount(value) : value;
  if (onClick) {
    return (
      <button aria-label={actionLabel ?? label} className="motion-button rounded-md border border-white/10 bg-black/[0.10] px-3 py-2 text-left hover:border-[rgb(var(--accent-rgb)/0.38)] hover:bg-[rgb(var(--accent-rgb)/0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-rgb)/0.42)]" onClick={onClick} type="button">
        <div className="text-[11px] text-slate-500">{label}</div>
        <div className={`mt-1 font-mono text-sm ${toneClass}`}>{displayValue}</div>
      </button>
    );
  }
  return (
    <SoftRow className="px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-sm ${toneClass}`}>{displayValue}</div>
    </SoftRow>
  );
}
