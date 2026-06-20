import { forwardRef, useMemo } from 'react';
import { Image, ListChecks, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import type { ImageCacheFileIssue, ImageDuplicateNameGroup, ImageHealthReport, ImageReferenceAudit } from '@/types/archive';
import { ImageAuditDetailPanel, matchesImageAuditItem } from './ImageAuditDetailPanel';

export const MaintenanceImageAuditPanel = forwardRef<HTMLElement, {
  audit: ImageReferenceAudit | null;
  artworkDiagnosisLoading: boolean;
  artworkRepairLoading: boolean;
  canLoad: boolean;
  imageHealth: ImageHealthReport | null;
  imageHealthLoading: boolean;
  issueFilter: string;
  loading: boolean;
  query: string;
  onDiagnoseArtwork: () => void;
  onLoadImageHealth: () => void;
  onQuarantineOrphans: () => void;
  onIssueFilterChange: (value: string) => void;
  onLoadAudit: () => void;
  onOpenGame?: (gameId: string) => void;
  onQueryChange: (value: string) => void;
  onResetFilters: () => void;
  onRevealPath: (path: string) => void;
  onStartArtworkRepair: () => void;
}>(function MaintenanceImageAuditPanel({
  audit,
  artworkDiagnosisLoading,
  artworkRepairLoading,
  canLoad,
  imageHealth,
  imageHealthLoading,
  issueFilter,
  loading,
  query,
  onDiagnoseArtwork,
  onLoadImageHealth,
  onQuarantineOrphans,
  onIssueFilterChange,
  onLoadAudit,
  onOpenGame,
  onQueryChange,
  onResetFilters,
  onRevealPath,
  onStartArtworkRepair,
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
          artworkDiagnosisLoading={artworkDiagnosisLoading}
          artworkRepairLoading={artworkRepairLoading}
          loading={imageHealthLoading}
          report={imageHealth}
          onDiagnoseArtwork={onDiagnoseArtwork}
          onLoad={onLoadImageHealth}
          onQuarantineOrphans={onQuarantineOrphans}
          onOpenGame={onOpenGame}
          onRevealPath={onRevealPath}
          onStartArtworkRepair={onStartArtworkRepair}
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

function ImageHealthSummaryPanel({
  artworkDiagnosisLoading,
  artworkRepairLoading,
  loading,
  report,
  onDiagnoseArtwork,
  onLoad,
  onQuarantineOrphans,
  onOpenGame,
  onRevealPath,
  onStartArtworkRepair,
}: {
  artworkDiagnosisLoading: boolean;
  artworkRepairLoading: boolean;
  loading: boolean;
  report: ImageHealthReport | null;
  onDiagnoseArtwork: () => void;
  onLoad: () => void;
  onQuarantineOrphans: () => void;
  onOpenGame?: (gameId: string) => void;
  onRevealPath: (path: string) => void;
  onStartArtworkRepair: () => void;
}) {
  const summary = report?.summary;
  const canQuarantine = Boolean(report && summary && summary.orphanFiles > 0 && !loading);
  const canDiagnoseArtwork = Boolean(report && summary && summary.missingArtworkGames > 0 && !loading && !artworkDiagnosisLoading);
  const canStartArtworkRepair = Boolean(report && summary && summary.missingArtworkGames > 0 && !loading && !artworkRepairLoading);
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
          <Button disabled={!canDiagnoseArtwork} size="sm" variant="outline" onClick={onDiagnoseArtwork}>{artworkDiagnosisLoading ? '诊断中' : '诊断缺图'}</Button>
          <Button disabled={!canStartArtworkRepair} size="sm" variant="secondary" onClick={onStartArtworkRepair}>{artworkRepairLoading ? '创建中' : '开始补图'}</Button>
          <Button disabled={!canQuarantine} size="sm" variant="secondary" onClick={onQuarantineOrphans}>移动到隔离区</Button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-9">
        <ImageHealthStat label="缓存图片" value={summary?.imageFiles ?? report?.cache.fileCount ?? 0} />
        <ImageHealthStat label="孤儿图片" tone={(summary?.orphanFiles ?? 0) > 0 ? 'warn' : 'ok'} value={summary?.orphanFiles ?? 0} />
        <ImageHealthStat label="缺失引用" tone={(summary?.missingLocalRefs ?? 0) > 0 ? 'warn' : 'ok'} value={summary?.missingLocalRefs ?? 0} />
        <ImageHealthStat label="缺封面" tone={(summary?.missingCoverGames ?? 0) > 0 ? 'warn' : 'ok'} value={summary?.missingCoverGames ?? 0} />
        <ImageHealthStat label="媒体图不完整" tone={(summary?.missingArtworkGames ?? 0) > 0 ? 'warn' : 'ok'} value={summary?.missingArtworkGames ?? 0} />
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
            <ImageHealthFileSamples title="无效图片" samples={cache.invalidImageSamples} onOpenGame={onOpenGame} onRevealPath={onRevealPath} />
            <ImageHealthFileSamples title="孤儿图片" samples={cache.orphanSamples} onOpenGame={onOpenGame} onRevealPath={onRevealPath} />
            <ImageHealthFileSamples title="过大图片" samples={cache.oversizedSamples} onOpenGame={onOpenGame} onRevealPath={onRevealPath} />
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

function ImageHealthFileSamples({ title, samples, onOpenGame, onRevealPath }: { title: string; samples: ImageCacheFileIssue[]; onOpenGame?: (gameId: string) => void; onRevealPath: (path: string) => void }) {
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
                <ImageHealthReferenceLine sample={sample} />
                <div className="text-[11px] text-slate-500">{formatBytes(sample.sizeBytes)}</div>
              </div>
              <div className="flex shrink-0 gap-1">
                {sample.referenceSamples[0]?.gameId && onOpenGame ? <Button size="sm" variant="ghost" onClick={() => onOpenGame(sample.referenceSamples[0].gameId!)}>打开游戏</Button> : null}
                <Button size="sm" variant="ghost" onClick={() => onRevealPath(sample.path)}>定位</Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-xs text-slate-600">暂无样本</div>
      )}
    </div>
  );
}

function ImageHealthReferenceLine({ sample }: { sample: ImageCacheFileIssue }) {
  const reference = sample.referenceSamples[0];
  if (!reference) return <div className="text-[11px] text-slate-600">引用：未被数据库引用</div>;
  const source = [reference.gameTitle, reference.fieldName].filter(Boolean).join(' / ');
  return <div className="truncate text-[11px] text-slate-500">引用：{source || reference.sourceKind}</div>;
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
