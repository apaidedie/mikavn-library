import { AlertTriangle, Database, Image, ShieldCheck, Wrench } from 'lucide-react';
import { MetricTile, Panel, PanelContent, PanelHeader } from '@/components/ui/page';
import type { AppDataDiagnostics } from '@/types/archive';
import type { LibraryFilterPreset } from '@/types/game';
import { CompactStat, ProgressBlock, formatCount } from './MaintenancePageParts';

export function MaintenanceOverviewPanels({
  database,
  descriptionImages,
  externalIds,
  issueCount,
  metadata,
  metadataCoverage,
  pathStatus,
  providerDescriptionCoverage,
  onOpenLibrary,
}: {
  database?: AppDataDiagnostics['database'];
  descriptionImages?: AppDataDiagnostics['database']['descriptionImages'];
  externalIds?: AppDataDiagnostics['database']['externalIds'];
  issueCount: number;
  metadata?: AppDataDiagnostics['database']['metadataCoverage'];
  metadataCoverage: string;
  pathStatus?: AppDataDiagnostics['database']['pathStatus'];
  providerDescriptionCoverage: string;
  onOpenLibrary?: (preset?: LibraryFilterPreset | null) => void;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          detail={database ? `quick_check: ${database.quickCheck ?? 'unknown'}` : '等待自检'}
          icon={database?.quickCheckOk ? <ShieldCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          label="数据库"
          value={database ? database.quickCheckOk ? '正常' : '异常' : '未载入'}
        />
        <MetricTile
          detail={database ? `${formatCount(issueCount)} 个待关注项` : '等待自检'}
          icon={<Wrench className="h-4 w-4" />}
          label="维护状态"
          value={issueCount === 0 && database ? '干净' : formatCount(issueCount)}
        />
        <MetricTile
          detail={database ? `${formatCount(metadata?.completeGameCount ?? 0)} / ${formatCount(database.gameCount)} 条完整` : '等待自检'}
          icon={<Database className="h-4 w-4" />}
          label="元数据完整度"
          value={metadataCoverage}
        />
        <MetricTile
          detail={descriptionImages ? `${formatCount(descriptionImages.providerGamesWithImagesCount)} / ${formatCount(descriptionImages.providerGamesCount)} 个来源条目` : '等待自检'}
          icon={<Image className="h-4 w-4" />}
          label="简介图片覆盖"
          value={providerDescriptionCoverage}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="媒体与简介" description="封面、横幅、背景和简介图片的当前覆盖情况。" icon={<Image className="h-4 w-4" />} />
          <PanelContent className="space-y-4">
            <ProgressBlock label="DLsite / FANZA 简介图片" value={descriptionImages?.providerGamesWithImagesCount ?? 0} total={descriptionImages?.providerGamesCount ?? 0} />
            <div className="grid gap-2 sm:grid-cols-2">
              <CompactStat actionLabel="在游戏库查看缺简介图片" label="无简介图片" onClick={onOpenLibrary ? () => onOpenLibrary({ metadataStatus: 'missing_description_image' }) : undefined} value={descriptionImages?.providerGamesWithoutImagesCount ?? 0} tone={(descriptionImages?.providerGamesWithoutImagesCount ?? 0) > 0 ? 'warn' : 'ok'} />
              <CompactStat label="空简介" value={descriptionImages?.providerGamesEmptyDescriptionCount ?? 0} tone={(descriptionImages?.providerGamesEmptyDescriptionCount ?? 0) > 0 ? 'warn' : 'ok'} />
              <CompactStat label="简介图片引用" value={descriptionImages?.imageRefsCount ?? 0} />
              <CompactStat label="缺失本地简介图" value={descriptionImages?.missingLocalImageRefsCount ?? 0} tone={(descriptionImages?.missingLocalImageRefsCount ?? 0) > 0 ? 'warn' : 'ok'} />
              <CompactStat actionLabel="在游戏库查看缺封面" label="缺封面" onClick={onOpenLibrary ? () => onOpenLibrary({ metadataStatus: 'missing_cover' }) : undefined} value={metadata?.missingCoverCount ?? 0} tone={(metadata?.missingCoverCount ?? 0) > 0 ? 'warn' : 'ok'} />
              <CompactStat actionLabel="在游戏库查看缺横幅" label="缺横幅" onClick={onOpenLibrary ? () => onOpenLibrary({ metadataStatus: 'missing_banner' }) : undefined} value={metadata?.missingBannerCount ?? 0} tone={(metadata?.missingBannerCount ?? 0) > 0 ? 'warn' : 'ok'} />
              <CompactStat actionLabel="在游戏库查看缺背景" label="缺背景" onClick={onOpenLibrary ? () => onOpenLibrary({ metadataStatus: 'missing_background' }) : undefined} value={metadata?.missingBackgroundCount ?? 0} tone={(metadata?.missingBackgroundCount ?? 0) > 0 ? 'warn' : 'ok'} />
            </div>
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader title="重复与完整度" description="外部 ID、基础元数据和路径状态。" icon={<Database className="h-4 w-4" />} />
          <PanelContent className="space-y-4">
            <ProgressBlock label="基础元数据完整" value={metadata?.completeGameCount ?? 0} total={database?.gameCount ?? 0} />
            <div className="grid gap-2 sm:grid-cols-2">
              <CompactStat actionLabel="在游戏库查看需补元数据" label="需补元数据" onClick={onOpenLibrary ? () => onOpenLibrary({ metadataStatus: 'needs_metadata' }) : undefined} value={metadata?.needsMetadataCount ?? 0} tone={(metadata?.needsMetadataCount ?? 0) > 0 ? 'warn' : 'ok'} />
              <CompactStat actionLabel="在游戏库查看缺外部 ID" label="缺外部 ID" onClick={onOpenLibrary ? () => onOpenLibrary({ metadataStatus: 'missing_external_id' }) : undefined} value={metadata?.missingExternalIdCount ?? 0} tone={(metadata?.missingExternalIdCount ?? 0) > 0 ? 'warn' : 'ok'} />
              <CompactStat label="重复 ID 组" value={externalIds?.duplicateExternalIdGroupsCount ?? 0} tone={(externalIds?.duplicateExternalIdGroupsCount ?? 0) > 0 ? 'warn' : 'ok'} />
              <CompactStat label="重复涉及游戏" value={externalIds?.duplicateExternalIdGamesCount ?? 0} tone={(externalIds?.duplicateExternalIdGamesCount ?? 0) > 0 ? 'warn' : 'ok'} />
              <CompactStat actionLabel="在游戏库查看路径异常" label="路径异常" onClick={onOpenLibrary ? () => onOpenLibrary({ pathStatus: 'broken' }) : undefined} value={pathStatus?.brokenCount ?? 0} tone={(pathStatus?.brokenCount ?? 0) > 0 ? 'warn' : 'ok'} />
              <CompactStat actionLabel="在游戏库查看未检查路径" label="未检查路径" onClick={onOpenLibrary ? () => onOpenLibrary({ pathStatus: 'unknown' }) : undefined} value={pathStatus?.uncheckedCount ?? 0} />
            </div>
          </PanelContent>
        </Panel>
      </div>
    </>
  );
}
