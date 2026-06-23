import { forwardRef, useMemo } from 'react';
import { Copy, Image, ListChecks, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import type { ImageCacheFileIssue, ImageDuplicateContentGroup, ImageDuplicateNameGroup, ImageHealthReport, ImageReferenceAudit } from '@/types/archive';
import { ImageAuditDetailPanel } from './ImageAuditDetailPanel';
import { matchesImageAuditItem } from './imageAuditDetailModel';
import { formatImageHealthReferenceSplit, getImageHealthActionHint } from './maintenanceImageHealthModel';

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
  onCopyImageHealthSummary: () => void;
  onLoadImageHealth: () => void;
  onQuarantineContentTypeMismatch: () => void;
  onQuarantineDuplicateContent: () => void;
  onQuarantineInvalidImages: () => void;
  onQuarantineOrphans: () => void;
  onQuarantineOversizedImages: () => void;
  onQuarantineSafeCacheIssues: () => void;
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
  onCopyImageHealthSummary,
  onLoadImageHealth,
  onQuarantineContentTypeMismatch,
  onQuarantineDuplicateContent,
  onQuarantineInvalidImages,
  onQuarantineOrphans,
  onQuarantineOversizedImages,
  onQuarantineSafeCacheIssues,
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
          onCopyImageHealthSummary={onCopyImageHealthSummary}
          onLoad={onLoadImageHealth}
          onLoadAudit={onLoadAudit}
          onQuarantineContentTypeMismatch={onQuarantineContentTypeMismatch}
          onQuarantineDuplicateContent={onQuarantineDuplicateContent}
          onQuarantineInvalidImages={onQuarantineInvalidImages}
          onQuarantineOrphans={onQuarantineOrphans}
          onQuarantineOversizedImages={onQuarantineOversizedImages}
          onQuarantineSafeCacheIssues={onQuarantineSafeCacheIssues}
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
  onCopyImageHealthSummary,
  onLoad,
  onLoadAudit,
  onQuarantineContentTypeMismatch,
  onQuarantineDuplicateContent,
  onQuarantineInvalidImages,
  onQuarantineOrphans,
  onQuarantineOversizedImages,
  onQuarantineSafeCacheIssues,
  onOpenGame,
  onRevealPath,
  onStartArtworkRepair,
}: {
  artworkDiagnosisLoading: boolean;
  artworkRepairLoading: boolean;
  loading: boolean;
  report: ImageHealthReport | null;
  onDiagnoseArtwork: () => void;
  onCopyImageHealthSummary: () => void;
  onLoad: () => void;
  onLoadAudit: () => void;
  onQuarantineContentTypeMismatch: () => void;
  onQuarantineDuplicateContent: () => void;
  onQuarantineInvalidImages: () => void;
  onQuarantineOrphans: () => void;
  onQuarantineOversizedImages: () => void;
  onQuarantineSafeCacheIssues: () => void;
  onOpenGame?: (gameId: string) => void;
  onRevealPath: (path: string) => void;
  onStartArtworkRepair: () => void;
}) {
  const summary = report?.summary;
  const canSafeCleanup = Boolean(report && summary && summary.orphanFiles > 0 && !loading);
  const canCleanupDuplicateContent = Boolean(report && summary && summary.duplicateContentGroups > 0 && !loading);
  const canCleanupInvalidImages = Boolean(report && summary && Math.max(0, summary.invalidImageFiles - summary.invalidImageRefs) > 0 && !loading);
  const canCleanupOversizedImages = Boolean(report && summary && Math.max(0, summary.oversizedFiles - summary.oversizedImageRefs) > 0 && !loading);
  const canCleanupContentTypeMismatch = Boolean(report && summary && Math.max(0, summary.contentTypeMismatchFiles - summary.contentTypeMismatchRefs) > 0 && !loading);
  const canCleanupSafeCacheIssues = canSafeCleanup || canCleanupDuplicateContent || canCleanupInvalidImages || canCleanupOversizedImages || canCleanupContentTypeMismatch;
  const canCopyHealthSummary = Boolean(report && summary && !loading);
  const canDiagnoseArtwork = Boolean(report && summary && summary.missingArtworkGames > 0 && !loading && !artworkDiagnosisLoading);
  const canStartArtworkRepair = Boolean(report && summary && summary.missingArtworkGames > 0 && !loading && !artworkRepairLoading);
  const canInspectBrokenRefs = Boolean(report && summary && !loading && (
    summary.missingLocalRefs > 0
    || summary.invalidImageRefs > 0
    || summary.cDriveRefs > 0
    || summary.playniteRefs > 0
    || summary.externalLegacyRefs > 0
  ));
  const actionHint = getImageHealthActionHint({ report, loading });
  const cache = report?.cache;
  return (
    <SoftRow className="space-y-3 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-100"><ShieldCheck className="h-4 w-4 text-emerald-200" />图片健康</div>
          <div className="mt-1 text-xs text-slate-500">检查图片引用和缓存文件；无效图片表示空文件或损坏文件，类型不匹配表示扩展名和真实格式不同。一键安全整理会整理全部安全项，只处理未被数据库引用的孤儿缓存；整理重复内容只隔离重复内容中的未引用副本；整理无效图片只隔离未被数据库引用的无效图片；整理过大图片只隔离未被数据库引用的过大图片；整理类型不匹配只隔离未被数据库引用的类型不匹配图片，移动到隔离区，不会永久删除文件。</div>
          <div className="mt-1 text-xs text-slate-600">隔离区会写入 manifest.json；如果误隔离，可以按清单找回原路径并恢复文件。</div>
          <div className="mt-1 text-xs text-slate-600">缺封面和失效引用会保留给补图或明细审计，避免误改仍在使用的图片。</div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button disabled={loading} size="sm" variant="outline" onClick={onLoad}><ListChecks className="h-4 w-4" />{loading ? '检查中' : '检查图片健康'}</Button>
          <Button disabled={!canCopyHealthSummary} size="sm" variant="ghost" onClick={onCopyImageHealthSummary}><Copy className="h-4 w-4" />复制健康摘要</Button>
          <Button disabled={!canInspectBrokenRefs} size="sm" variant="outline" onClick={onLoadAudit}>查看失效引用</Button>
          <Button disabled={!canDiagnoseArtwork} size="sm" variant="outline" onClick={onDiagnoseArtwork}>{artworkDiagnosisLoading ? '诊断中' : '诊断缺图'}</Button>
          <Button disabled={!canStartArtworkRepair} size="sm" variant="secondary" onClick={onStartArtworkRepair}>{artworkRepairLoading ? '创建中' : '开始补图'}</Button>
          <Button disabled={!canCleanupSafeCacheIssues} size="sm" variant="secondary" onClick={onQuarantineSafeCacheIssues}>一键安全整理</Button>
          <Button disabled={!canSafeCleanup} size="sm" variant="outline" onClick={onQuarantineOrphans}>整理孤儿图片</Button>
          <Button disabled={!canCleanupDuplicateContent} size="sm" variant="secondary" onClick={onQuarantineDuplicateContent}>整理重复内容</Button>
          <Button disabled={!canCleanupInvalidImages} size="sm" variant="secondary" onClick={onQuarantineInvalidImages}>整理无效图片</Button>
          <Button disabled={!canCleanupOversizedImages} size="sm" variant="secondary" onClick={onQuarantineOversizedImages}>整理过大图片</Button>
          <Button disabled={!canCleanupContentTypeMismatch} size="sm" variant="secondary" onClick={onQuarantineContentTypeMismatch}>整理类型不匹配</Button>
        </div>
      </div>
      <div className="text-xs text-slate-500" data-image-health-action-hint>{actionHint}</div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-12">
        <ImageHealthStat label="缓存体积" value={formatBytes(cache?.totalBytes ?? 0)} />
        <ImageHealthStat label="孤儿体积" detail="可安全整理的孤儿缓存体积" tone={(cache?.orphanBytes ?? 0) > 0 ? 'warn' : 'ok'} value={formatBytes(cache?.orphanBytes ?? 0)} />
        <ImageHealthStat label="缓存图片" value={summary?.imageFiles ?? report?.cache.fileCount ?? 0} />
        <ImageHealthStat label="孤儿图片" tone={(summary?.orphanFiles ?? 0) > 0 ? 'warn' : 'ok'} value={summary?.orphanFiles ?? 0} />
        <ImageHealthStat label="缺失引用" tone={(summary?.missingLocalRefs ?? 0) > 0 ? 'warn' : 'ok'} value={summary?.missingLocalRefs ?? 0} />
        <ImageHealthStat label="失效引用" tone={(summary?.invalidImageRefs ?? 0) > 0 ? 'warn' : 'ok'} value={summary?.invalidImageRefs ?? 0} />
        <ImageHealthStat label="缺封面" tone={(summary?.missingCoverGames ?? 0) > 0 ? 'warn' : 'ok'} value={summary?.missingCoverGames ?? 0} />
        <ImageHealthStat label="媒体图不完整" tone={(summary?.missingArtworkGames ?? 0) > 0 ? 'warn' : 'ok'} value={summary?.missingArtworkGames ?? 0} />
        <ImageHealthStat label="旧导入缓存" value={summary?.legacyAppDataImportRefs ?? 0} />
        <ImageHealthStat label="重复文件名" tone={(summary?.duplicateFileNameGroups ?? 0) > 0 ? 'warn' : 'ok'} value={summary?.duplicateFileNameGroups ?? 0} />
        <ImageHealthStat label="重复内容" tone={(summary?.duplicateContentGroups ?? 0) > 0 ? 'warn' : 'ok'} value={summary?.duplicateContentGroups ?? 0} />
        <ImageHealthStat label="过大图片" detail={formatImageHealthReferenceSplit(summary?.oversizedFiles, summary?.oversizedImageRefs)} tone={(summary?.oversizedFiles ?? 0) > 0 ? 'warn' : 'ok'} value={summary?.oversizedFiles ?? 0} />
        <ImageHealthStat label="无效图片" detail={formatImageHealthReferenceSplit(summary?.invalidImageFiles, summary?.invalidImageRefs)} tone={(summary?.invalidImageFiles ?? 0) > 0 ? 'warn' : 'ok'} value={summary?.invalidImageFiles ?? 0} />
        <ImageHealthStat label="类型不匹配" detail={formatImageHealthReferenceSplit(summary?.contentTypeMismatchFiles, summary?.contentTypeMismatchRefs)} tone={(summary?.contentTypeMismatchFiles ?? 0) > 0 ? 'warn' : 'ok'} value={summary?.contentTypeMismatchFiles ?? 0} />
      </div>
      {report?.recommendations.length ? (
        <div className="space-y-1">
          {report.recommendations.map((recommendation) => (
            <div className="text-xs text-slate-500" data-health-recommendation key={recommendation}>{recommendation}</div>
          ))}
        </div>
      ) : <div className="text-xs text-slate-600">未检查前不会修改任何文件。</div>}
      {(summary?.legacyAppDataImportRefs ?? 0) > 0 ? <div className="text-xs text-slate-600">旧导入缓存仍位于 app-data/images 内，当前不计入失效引用；路径规范化会改数据库，后续执行前需要先完成数据库备份。</div> : null}
      {canInspectBrokenRefs ? <div className="text-xs text-slate-500">缺失引用、失效引用和外部旧路径需要进入明细审计逐条确认。</div> : null}
      {cache ? (
        <div className="space-y-2">
          <div className="text-[11px] font-medium text-slate-400">图片样本</div>
          <div className="grid gap-2 lg:grid-cols-2">
            <ImageHealthFileSamples title="无效图片" samples={cache.invalidImageSamples} onOpenGame={onOpenGame} onRevealPath={onRevealPath} />
            <ImageHealthFileSamples title="类型不匹配" samples={cache.contentTypeMismatchSamples} onOpenGame={onOpenGame} onRevealPath={onRevealPath} />
            <ImageHealthFileSamples title="孤儿图片" samples={cache.orphanSamples} onOpenGame={onOpenGame} onRevealPath={onRevealPath} />
            <ImageHealthFileSamples title="过大图片" samples={cache.oversizedSamples} onOpenGame={onOpenGame} onRevealPath={onRevealPath} />
            <ImageHealthDuplicateSamples rootPath={cache.rootPath} samples={cache.duplicateNameSamples} onRevealPath={onRevealPath} />
            <ImageHealthDuplicateContentSamples rootPath={cache.rootPath} samples={cache.duplicateContentSamples} onRevealPath={onRevealPath} />
          </div>
        </div>
      ) : null}
    </SoftRow>
  );
}

function ImageHealthStat({ detail, label, value, tone = 'neutral' }: { detail?: string; label: string; value: number | string; tone?: 'neutral' | 'ok' | 'warn' }) {
  const toneClass = tone === 'ok' ? 'text-emerald-200' : tone === 'warn' ? 'text-amber-200' : 'text-slate-200';
  const displayValue = typeof value === 'number' ? new Intl.NumberFormat('zh-CN').format(value) : value;
  return (
    <div className="rounded-md border border-white/10 bg-black/[0.10] px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-sm ${toneClass}`}>{displayValue}</div>
      {detail ? <div className="mt-1 text-[11px] text-slate-600">{detail}</div> : null}
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

function ImageHealthDuplicateContentSamples({ rootPath, samples, onRevealPath }: { rootPath: string; samples: ImageDuplicateContentGroup[]; onRevealPath: (path: string) => void }) {
  const visible = samples.slice(0, 3);
  return (
    <div className="rounded-md border border-white/10 bg-black/[0.10] p-2">
      <div className="text-[11px] font-medium text-slate-400">重复内容</div>
      <div className="mt-1 text-[11px] text-slate-600">内容相同的缓存需要先确认引用，再保留正在使用的一份。</div>
      {visible.length ? (
        <div className="mt-2 space-y-1.5">
          {visible.map((sample) => (
            <div key={sample.contentHash} className="min-w-0">
              <div className="truncate font-mono text-[11px] text-slate-500">{sample.contentHash} · {formatBytes(sample.sizeBytes)} · {sample.count} 个</div>
              <div className="mt-1 space-y-1">
                {sample.samples.slice(0, 5).map((relativePath) => (
                  <div key={`${sample.contentHash}-${relativePath}`} className="flex items-center justify-between gap-2">
                    <div className="min-w-0 truncate text-[11px] text-slate-500">{relativePath}</div>
                    <Button size="sm" variant="ghost" onClick={() => onRevealPath(joinImageCachePath(rootPath, relativePath))}>定位重复</Button>
                  </div>
                ))}
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

function ImageHealthDuplicateSamples({ rootPath, samples, onRevealPath }: { rootPath: string; samples: ImageDuplicateNameGroup[]; onRevealPath: (path: string) => void }) {
  const visible = samples.slice(0, 3);
  return (
    <div className="rounded-md border border-white/10 bg-black/[0.10] p-2">
      <div className="text-[11px] font-medium text-slate-400">重复文件名</div>
      <div className="mt-1 text-[11px] text-slate-600">重复文件名需要人工确认内容是否相同。</div>
      {visible.length ? (
        <div className="mt-2 space-y-1.5">
          {visible.map((sample) => (
            <div key={sample.fileName} className="min-w-0">
              <div className="truncate text-xs text-slate-200">{sample.fileName}</div>
              <div className="mt-1 space-y-1">
                {sample.samples.slice(0, 5).map((relativePath) => (
                  <div key={`${sample.fileName}-${relativePath}`} className="flex items-center justify-between gap-2">
                    <div className="min-w-0 truncate text-[11px] text-slate-500">{relativePath}</div>
                    <Button size="sm" variant="ghost" onClick={() => onRevealPath(joinImageCachePath(rootPath, relativePath))}>定位重复</Button>
                  </div>
                ))}
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

function joinImageCachePath(rootPath: string, relativePath: string) {
  const cleanRoot = rootPath.replace(/[\\/]+$/, '');
  const cleanRelative = relativePath.replace(/^[\\/]+/, '');
  return cleanRoot ? `${cleanRoot}\\${cleanRelative}` : cleanRelative;
}

function formatBytes(value: number) {
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}
