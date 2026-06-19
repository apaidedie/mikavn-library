import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import type { ImageReferenceAudit } from '@/types/archive';
import type { Game, GamePathHealth } from '@/types/game';
import { GameCollectionsPanel } from './GameCollectionsPanel';
import { DetailSurface, InfoLine, InfoStack } from './GameDetailParts';
import { AssetGallery, DescriptionRichText, MediaHealthStack, summarizeMediaHealth } from './GameDetailMedia';
import { pathStatusLabel } from './GamePathPanel';
import type { TaskMessage } from './useGameDetailActions';

type GameDetailOverviewProps = {
  blurCover: boolean;
  externalIds: ReactNode;
  game: Game;
  imageAudit: ImageReferenceAudit | null;
  imageAuditLoading: boolean;
  pathHealth: GamePathHealth | null;
  onChanged?: (game: Game) => void;
  onEdit: (game: Game) => void;
  onImageAudit: () => void;
  onMessage: (message: TaskMessage | null) => void;
  onOpenMaintenance?: (section?: string | null) => void;
};

export function GameDetailOverview({ blurCover, externalIds, game, imageAudit, imageAuditLoading, onChanged, onEdit, onImageAudit, onMessage, onOpenMaintenance, pathHealth }: GameDetailOverviewProps) {
  const mediaHealth = summarizeMediaHealth(game);

  return (
    <div className="grid gap-5 lg:grid-cols-4">
      <div className="col-span-1 min-w-0 space-y-5 lg:col-span-3">
        <DetailSurface title="简介">
          <DescriptionRichText value={game.description} />
        </DetailSurface>

        <DetailSurface title="标签">
          <div className="flex flex-wrap gap-2">
            {[...game.tags, ...game.genres].length === 0 ? <span className="text-sm text-slate-500">暂无标签</span> : [...game.tags, ...game.genres].map((tag) => <Badge key={tag}>{tag}</Badge>)}
          </div>
        </DetailSurface>

        <DetailSurface title="合集">
          <GameCollectionsPanel game={game} onEdit={() => onEdit(game)} />
        </DetailSurface>

        <DetailSurface title="媒体图库">
          <AssetGallery game={game} blurCover={blurCover} onChanged={onChanged} onMessage={(value) => onMessage(value ? { text: value } : null)} />
        </DetailSurface>
      </div>

      <aside className="col-span-1 space-y-5 pt-0.5">
        <MediaHealthStack audit={imageAudit} auditLoading={imageAuditLoading} items={mediaHealth.items} missingCount={mediaHealth.missingCount} onAudit={onImageAudit} onOpenMaintenance={onOpenMaintenance ? () => onOpenMaintenance('image-audit') : undefined} />

        <InfoStack title="信息">
          <InfoLine label="原名" value={game.originalTitle || '暂无'} />
          <InfoLine label="会社" value={game.developer || game.brand || '暂无'} />
          <InfoLine label="发行商" value={game.publisher || '暂无'} />
          <InfoLine label="发售日" value={game.releaseDate || '暂无'} />
          <InfoLine label="年龄" value={game.ageRating || '暂无'} />
          <InfoLine label="路径" value={pathStatusLabel(pathHealth?.status ?? game.pathStatus)} />
        </InfoStack>

        <InfoStack title="外部 ID">
          {externalIds}
        </InfoStack>
      </aside>
    </div>
  );
}
