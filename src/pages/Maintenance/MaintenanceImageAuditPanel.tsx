import { forwardRef, useMemo } from 'react';
import { Image, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import type { ImageHealthReport, ImageReferenceAudit } from '@/types/archive';
import { ImageHealthSummaryPanel } from './ImageHealthSummaryPanel';
import { ImageAuditDetailPanel } from './ImageAuditDetailPanel';
import { matchesImageAuditItem } from './imageAuditDetailModel';

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
