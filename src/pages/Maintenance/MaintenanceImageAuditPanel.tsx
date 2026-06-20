import { forwardRef, useMemo } from 'react';
import { Image, ListChecks, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import type { ImageCacheFileIssue, ImageDuplicateNameGroup, ImageHealthReport, ImageReferenceAudit } from '@/types/archive';
import { ImageAuditDetailPanel, matchesImageAuditItem } from './ImageAuditDetailPanel';

export const MaintenanceImageAuditPanel = forwardRef<HTMLElement, {
  audit: ImageReferenceAudit | null;
  canLoad: boolean;
  imageHealth: ImageHealthReport | null;
  imageHealthLoading: boolean;
  issueFilter: string;
  loading: boolean;
  query: string;
  onLoadImageHealth: () => void;
  onQuarantineOrphans: () => void;
  onIssueFilterChange: (value: string) => void;
  onLoadAudit: () => void;
  onOpenGame?: (gameId: string) => void;
  onQueryChange: (value: string) => void;
  onResetFilters: () => void;
  onRevealPath: (path: string) => void;
}>(function MaintenanceImageAuditPanel({
  audit,
  canLoad,
  imageHealth,
  imageHealthLoading,
  issueFilter,
  loading,
  query,
  onLoadImageHealth,
  onQuarantineOrphans,
  onIssueFilterChange,
  onLoadAudit,
  onOpenGame,
  onQueryChange,
  onResetFilters,
  onRevealPath,
}, ref) {
  const filteredItems = useMemo(() => audit?.items.filter((item) => matchesImageAuditItem(item, query, issueFilter)) ?? [], [audit, issueFilter, query]);
  const disabled = loading || !canLoad;

  return (
    <Panel ref={ref}>
      <PanelHeader
        title="图片引用问题"
        description="定位缺失、C 盘残留和 Playnite 残留图片引用。"
        icon={<Image className="h-4 w-4" />}
        actions={<Button disabled={disabled} size="sm" variant="ghost" onClick={onLoadAudit}><ListChecks className="h-4 w-4" />{loading ? '读取中' : '读取明细'}</Button>}
      />
      <PanelContent className="space-y-3">
        <ImageHealthSummaryPanel
          loading={imageHealthLoading}
          report={imageHealth}
          onLoad={onLoadImageHealth}
          onQuarantineOrphans={onQuarantineOrphans}
          onRevealPath={onRevealPath}
        />
        {audit ? (
          <ImageAuditDetailPanel
            audit={audit}
            filteredItems={filteredItems}
            issueFilter={issueFilter}
            query={query}
            onIssueFilterChange={onIssueFilterChange}
            onOpenGame={onOpenGame}
            onQueryChange={onQueryChange}
            onRevealPath={onRevealPath}
            onResetFilters={onResetFilters}
          />
        ) : (
          <SoftRow className="flex items-center justify-between gap-3 px-3 py-3">
            <div className="min-w-0 text-sm text-slate-400">读取后会列出具体游戏、来源字段、原始路径和已解析到的文件路径。</div>
            <Button disabled={disabled} size="sm" variant="secondary" onClick={onLoadAudit}><ListChecks className="h-4 w-4" />读取</Button>
          </SoftRow>
        )}
      </PanelContent>
    </Panel>
  );
});

function ImageHealthSummaryPanel({ loading, report, onLoad, onQuarantineOrphans, onRevealPath }: { loading: boolean; report: ImageHealthReport | null; onLoad: () => void; onQuarantineOrphans: () => void; onRevealPath: (path: string) => void }) {
  const summary = report?.summary;
  const canQuarantine = Boolean(report && summary && summary.orphanFiles > 0 && !loading);
  const cache = report?.cache;
  return (
    <SoftRow className="space-y-3 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-100"><ShieldCheck className="h-4 w-4 text-emerald-200" />图片健康</div>
          <div className="mt-1 text-xs text-slate-500">检查图片引用和缓存文件；无效图片表示空文件或损坏文件。移动到隔离区只搬运孤儿图片，不会永久删除文件。</div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button disabled={loading} size="sm" variant="outline" onClick={onLoad}><ListChecks className="h-4 w-4" />{loading ? '检查中' : '检查图片健康'}</Button>
          <Button disabled={!canQuarantine} size="sm" variant="secondary" onClick={onQuarantineOrphans}>移动到隔离区</Button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <ImageHealthStat label="缓存图片" value={summary?.imageFiles ?? report?.cache.fileCount ?? 0} />
        <ImageHealthStat label="孤儿图片" tone={(summary?.orphanFiles ?? 0) > 0 ? 'warn' : 'ok'} value={summary?.orphanFiles ?? 0} />
        <ImageHealthStat label="缺失引用" tone={(summary?.missingLocalRefs ?? 0) > 0 ? 'warn' : 'ok'} value={summary?.missingLocalRefs ?? 0} />
        <ImageHealthStat label="Playnite 旧导入" tone={(summary?.legacyAppDataImportRefs ?? 0) > 0 ? 'warn' : 'ok'} value={summary?.legacyAppDataImportRefs ?? 0} />
        <ImageHealthStat label="重复文件名" tone={(summary?.duplicateFileNameGroups ?? 0) > 0 ? 'warn' : 'ok'} value={summary?.duplicateFileNameGroups ?? 0} />
        <ImageHealthStat label="过大图片" tone={(summary?.oversizedFiles ?? 0) > 0 ? 'warn' : 'ok'} value={summary?.oversizedFiles ?? 0} />
        <ImageHealthStat label="无效图片" tone={(summary?.invalidImageFiles ?? 0) > 0 ? 'warn' : 'ok'} value={summary?.invalidImageFiles ?? 0} />
      </div>
      {report?.recommendations.length ? <div className="text-xs text-slate-500">{report.recommendations[0]}</div> : <div className="text-xs text-slate-600">未检查前不会修改任何文件。</div>}
      {cache ? (
        <div className="space-y-2">
          <div className="text-[11px] font-medium text-slate-400">图片样本</div>
          <div className="grid gap-2 lg:grid-cols-2">
            <ImageHealthFileSamples title="无效图片" samples={cache.invalidImageSamples} onRevealPath={onRevealPath} />
            <ImageHealthFileSamples title="孤儿图片" samples={cache.orphanSamples} onRevealPath={onRevealPath} />
            <ImageHealthFileSamples title="过大图片" samples={cache.oversizedSamples} onRevealPath={onRevealPath} />
            <ImageHealthDuplicateSamples samples={cache.duplicateNameSamples} />
          </div>
        </div>
      ) : null}
    </SoftRow>
  );
}

function ImageHealthStat({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'ok' | 'warn' }) {
  const toneClass = tone === 'ok' ? 'text-emerald-200' : tone === 'warn' ? 'text-amber-200' : 'text-slate-200';
  return (
    <div className="rounded-md border border-white/10 bg-black/[0.10] px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-sm ${toneClass}`}>{new Intl.NumberFormat('zh-CN').format(value)}</div>
    </div>
  );
}

function ImageHealthFileSamples({ title, samples, onRevealPath }: { title: string; samples: ImageCacheFileIssue[]; onRevealPath: (path: string) => void }) {
  const visible = samples.slice(0, 3);
  return (
    <div className="rounded-md border border-white/10 bg-black/[0.10] p-2">
      <div className="text-[11px] font-medium text-slate-400">{title}</div>
      {visible.length ? (
        <div className="mt-2 space-y-1.5">
          {visible.map((sample) => (
            <div key={`${title}-${sample.path}`} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-xs text-slate-200">{sample.relativePath}</div>
                <div className="text-[11px] text-slate-500">{formatBytes(sample.sizeBytes)}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => onRevealPath(sample.path)}>定位</Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-xs text-slate-600">暂无样本</div>
      )}
    </div>
  );
}

function ImageHealthDuplicateSamples({ samples }: { samples: ImageDuplicateNameGroup[] }) {
  const visible = samples.slice(0, 3);
  return (
    <div className="rounded-md border border-white/10 bg-black/[0.10] p-2">
      <div className="text-[11px] font-medium text-slate-400">重复文件名</div>
      {visible.length ? (
        <div className="mt-2 space-y-1.5">
          {visible.map((sample) => (
            <div key={sample.fileName} className="min-w-0">
              <div className="truncate text-xs text-slate-200">{sample.fileName}</div>
              <div className="truncate text-[11px] text-slate-500">{sample.count} 个：{sample.samples.join(' / ')}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-xs text-slate-600">暂无样本</div>
      )}
    </div>
  );
}

function formatBytes(value: number) {
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}
