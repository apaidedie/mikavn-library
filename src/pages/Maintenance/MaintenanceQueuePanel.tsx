import { ListChecks, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel, PanelContent, PanelHeader } from '@/components/ui/page';
import type { AppDataDiagnostics } from '@/types/archive';
import { MaintenanceAction, formatCount } from './MaintenancePageParts';

type DescriptionImageHealth = AppDataDiagnostics['database']['descriptionImages'];
type ExternalIdHealth = AppDataDiagnostics['database']['externalIds'];
type MetadataCoverage = AppDataDiagnostics['database']['metadataCoverage'];

export function MaintenanceQueuePanel({
  artworkRepairLoading,
  descriptionImages,
  descriptionRepairLoading,
  duplicateAuditLoading,
  externalIds,
  metadata,
  metadataRepairLoading,
  missingArtworkFieldCount,
  onOpenMetadata,
  onStartArtworkRepair,
  onStartDescriptionImageRepair,
  onStartDuplicateExternalIdAudit,
  onStartMetadataRepair,
}: {
  artworkRepairLoading: boolean;
  descriptionImages?: DescriptionImageHealth;
  descriptionRepairLoading: boolean;
  duplicateAuditLoading: boolean;
  externalIds?: ExternalIdHealth;
  metadata?: MetadataCoverage;
  metadataRepairLoading: boolean;
  missingArtworkFieldCount: number;
  onOpenMetadata?: (preset?: { query?: string; missingProvider?: string } | null) => void;
  onStartArtworkRepair: () => void;
  onStartDescriptionImageRepair: () => void;
  onStartDuplicateExternalIdAudit: () => void;
  onStartMetadataRepair: () => void;
}) {
  const descriptionImageIssueCount = (descriptionImages?.providerGamesWithoutImagesCount ?? 0) + (descriptionImages?.providerGamesEmptyDescriptionCount ?? 0);
  const duplicateExternalIdGroupCount = externalIds?.duplicateExternalIdGroupsCount ?? 0;
  const missingExternalIdCount = metadata?.missingExternalIdCount ?? 0;
  const needsMetadataCount = metadata?.needsMetadataCount ?? 0;

  return (
    <Panel>
      <PanelHeader title="维护队列" description="已落地的统计基础和下一批整理入口。" icon={<ListChecks className="h-4 w-4" />} />
      <PanelContent className="grid gap-2 xl:grid-cols-4">
        <MaintenanceAction
          action={(
            <Button disabled={descriptionRepairLoading || descriptionImageIssueCount === 0} size="sm" variant="secondary" onClick={onStartDescriptionImageRepair}>
              <PlayCircle className="h-4 w-4" />{descriptionRepairLoading ? '创建中' : '开始'}
            </Button>
          )}
          detail={`${formatCount(descriptionImageIssueCount)} 个条目待补简介图片`}
          label="简介图片修复"
          status="可创建任务"
        />
        <MaintenanceAction
          action={(
            <Button disabled={artworkRepairLoading || missingArtworkFieldCount === 0} size="sm" variant="secondary" onClick={onStartArtworkRepair}>
              <PlayCircle className="h-4 w-4" />{artworkRepairLoading ? '创建中' : '开始'}
            </Button>
          )}
          detail={`${formatCount(missingArtworkFieldCount)} 个媒体字段待补`}
          label="媒体图片补全"
          status="可创建任务"
        />
        <MaintenanceAction
          action={(
            <Button disabled={duplicateAuditLoading || duplicateExternalIdGroupCount === 0} size="sm" variant="secondary" onClick={onStartDuplicateExternalIdAudit}>
              <PlayCircle className="h-4 w-4" />{duplicateAuditLoading ? '创建中' : '开始'}
            </Button>
          )}
          detail={`${formatCount(duplicateExternalIdGroupCount)} 组重复外部 ID`}
          label="重复 ID 审查"
          status="可创建任务"
        />
        <MaintenanceAction
          action={(
            <>
              {onOpenMetadata && <Button disabled={missingExternalIdCount === 0} size="sm" variant="outline" onClick={() => onOpenMetadata({ missingProvider: 'external_id' })}>处理缺 ID</Button>}
              <Button disabled={metadataRepairLoading || needsMetadataCount === 0} size="sm" variant="secondary" onClick={onStartMetadataRepair}>
                <PlayCircle className="h-4 w-4" />{metadataRepairLoading ? '创建中' : '开始'}
              </Button>
            </>
          )}
          detail={`${formatCount(needsMetadataCount)} 个条目可批量匹配元数据`}
          label="批量元数据匹配"
          status="可创建任务"
        />
      </PanelContent>
    </Panel>
  );
}
