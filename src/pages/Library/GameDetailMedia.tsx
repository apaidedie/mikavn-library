import { AlertTriangle, CheckCircle2, Download, ImagePlus, RefreshCw, Star, Trash2, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CoverImage } from '@/components/ui/cover';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { api } from '@/services/api';
import { chooseImage } from '@/services/dialog';
import type { ImageReferenceAudit } from '@/types/archive';
import type { Game, GameAsset } from '@/types/game';
import { cn } from '@/utils/cn';
import { errorMessage } from '@/utils/errorMessage';
import { imageSrc } from '@/utils/imageSrc';
import {
  assetTypeLabel,
  assetTypeOrder,
  formatBytes,
  imageAuditBadgeClass,
  imageAuditFieldLabel,
  imageAuditIssueLabel,
  parseDescriptionParts,
  type MediaAuditItem,
  type MediaHealthItem,
} from './gameDetailMediaModel';

export { summarizeMediaHealth } from './gameDetailMediaModel';

export function DescriptionRichText({ value }: { value?: string | null }) {
  const parts = useMemo(() => parseDescriptionParts(value ?? ''), [value]);

  if (parts.length === 0) {
    return <p className="text-sm leading-7 text-slate-500">暂无简介。可通过 VNDB / DLsite / FANZA 元数据补全。</p>;
  }

  return (
    <div className="space-y-4 text-sm leading-7 text-slate-300">
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return <p className="whitespace-pre-wrap break-words" key={`${index}-text`}>{part.value}</p>;
        }

        const src = imageSrc(part.src) ?? part.src;
        return (
          <figure className="overflow-hidden rounded-md border border-white/10 bg-black/[0.16]" key={`${index}-${part.src}`}>
            <img alt={part.alt || '简介图片'} className="mx-auto max-h-[460px] w-auto max-w-full object-contain" loading="lazy" src={src} />
          </figure>
        );
      })}
    </div>
  );
}

export function AssetGallery({ game, blurCover, onChanged, onMessage }: { game: Game; blurCover: boolean; onChanged?: (game: Game) => void; onMessage: (message: string | null) => void }) {
  const [assets, setAssets] = useState<GameAsset[]>([]);
  const [assetType, setAssetType] = useState('cover');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void refreshAssets();
  }, [game.id, game.coverImage, game.bannerImage, game.backgroundImage]);

  const grouped = useMemo(() => assets.reduce<Record<string, GameAsset[]>>((result, asset) => {
    const key = asset.assetType || 'other';
    result[key] = [...(result[key] ?? []), asset];
    return result;
  }, {}), [assets]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select className="h-8 w-32 text-xs" value={assetType} onChange={(event) => setAssetType(event.target.value)}>
            <option value="cover">封面</option>
            <option value="banner">横幅</option>
            <option value="background">背景</option>
            <option value="screenshot">截图</option>
          </Select>
          <Button disabled={Boolean(busy)} size="sm" variant="outline" onClick={() => void importFromPath()}><ImagePlus className="h-4 w-4" />导入图片</Button>
          <Button disabled={Boolean(busy)} size="sm" variant="ghost" onClick={() => void cleanupCache()}><RefreshCw className="h-4 w-4" />清理缓存</Button>
        </div>
        <div className="flex min-w-[18rem] flex-1 justify-end gap-2">
          <Input className="max-w-[26rem]" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/cover.jpg" />
          <Button disabled={Boolean(busy) || !url.trim()} size="sm" variant="secondary" onClick={() => void downloadFromUrl()}><Download className="h-4 w-4" />下载</Button>
        </div>
      </div>

      {assets.length === 0 ? (
        <div className="rounded-md border border-dashed border-white/10 bg-black/[0.08] px-3 py-4 text-sm text-slate-500">暂无媒体资产。导入本地图片或填写图片 URL 后可设为封面、横幅或背景。</div>
      ) : (
        <div className="space-y-4">
          {assetTypeOrder.filter((type) => grouped[type]?.length).map((type) => (
            <div key={type}>
              <div className="mb-2 text-xs font-medium text-slate-400">{assetTypeLabel(type)}</div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {grouped[type].map((asset) => <AssetCard asset={asset} blurCover={blurCover} busy={busy === asset.id} key={asset.id} onPrimary={() => void setPrimary(asset)} onRemove={() => void removeAsset(asset)} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  async function refreshAssets() {
    try {
      setAssets(await api.listGameAssets(game.id));
    } catch (reason) {
      onMessage(errorMessage(reason));
    }
  }

  async function importFromPath() {
    const selected = await chooseImage('');
    if (!selected) return;
    setBusy('import');
    onMessage(null);
    try {
      await api.importGameAssetFromPath(game.id, { assetType, sourcePath: selected, isPrimary: true });
      const updated = await api.getGame(game.id);
      onChanged?.(updated);
      await refreshAssets();
      onMessage('图片已导入资产图库并设为主图。');
    } catch (reason) {
      onMessage(errorMessage(reason));
    } finally {
      setBusy(null);
    }
  }

  async function downloadFromUrl() {
    const cleanUrl = url.trim();
    if (!cleanUrl) return;
    setBusy('download');
    onMessage(null);
    try {
      await api.downloadGameAsset(game.id, { assetType, url: cleanUrl, isPrimary: true });
      setUrl('');
      const updated = await api.getGame(game.id);
      onChanged?.(updated);
      await refreshAssets();
      onMessage('图片已下载到本地缓存并设为主图。');
    } catch (reason) {
      onMessage(errorMessage(reason));
    } finally {
      setBusy(null);
    }
  }

  async function setPrimary(asset: GameAsset) {
    setBusy(asset.id);
    onMessage(null);
    try {
      const updated = await api.setPrimaryAsset(asset.id);
      onChanged?.(updated);
      await refreshAssets();
      onMessage(`${assetTypeLabel(asset.assetType)}主图已更新。`);
    } catch (reason) {
      onMessage(errorMessage(reason));
    } finally {
      setBusy(null);
    }
  }

  async function removeAsset(asset: GameAsset) {
    if (!window.confirm('移除这个资产记录？只移除图库引用，不删除真实游戏文件。')) return;
    setBusy(asset.id);
    onMessage(null);
    try {
      const updated = await api.removeGameAsset(asset.id);
      onChanged?.(updated);
      await refreshAssets();
      onMessage('资产记录已移除。');
    } catch (reason) {
      onMessage(errorMessage(reason));
    } finally {
      setBusy(null);
    }
  }

  async function cleanupCache() {
    setBusy('cleanup');
    onMessage(null);
    try {
      const result = await api.cleanupAssetCache();
      await refreshAssets();
      onMessage(`缓存清理完成：扫描 ${result.scannedFiles} 个，删除 ${result.removedFiles} 个，保留 ${result.keptFiles} 个，释放 ${formatBytes(result.removedBytes)}。`);
    } catch (reason) {
      onMessage(errorMessage(reason));
    } finally {
      setBusy(null);
    }
  }
}

function AssetCard({ asset, blurCover, busy, onPrimary, onRemove }: { asset: GameAsset; blurCover: boolean; busy: boolean; onPrimary: () => void; onRemove: () => void }) {
  const aspect = asset.assetType === 'cover' ? 'aspect-[2/3]' : 'aspect-video';
  return (
    <div className="rounded-lg border border-white/10 bg-black/[0.10] p-2">
      <CoverImage alt={assetTypeLabel(asset.assetType)} blur={blurCover} className={cn('rounded-md border border-white/10', aspect)} src={asset.uri} />
      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge>{assetTypeLabel(asset.assetType)}</Badge>
            {asset.isPrimary && <Badge><CheckCircle2 className="mr-1 h-3 w-3" />主图</Badge>}
            {asset.source && <Badge>{asset.source}</Badge>}
          </div>
          <div className="mt-1 line-clamp-2 break-all font-mono text-[11px] text-slate-500">{asset.uri}</div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button aria-label="设为主图" disabled={busy || asset.isPrimary} size="icon" title="设为主图" variant="ghost" onClick={onPrimary}><Star className="h-4 w-4" /></Button>
          <Button aria-label="移除资产" disabled={busy} size="icon" title="移除资产" variant="ghost" onClick={onRemove}><Trash2 className="h-4 w-4 text-rose-200" /></Button>
        </div>
      </div>
    </div>
  );
}

export function MediaHealthStack({ audit, auditLoading, items, missingCount, onAudit, onOpenMaintenance }: { audit: ImageReferenceAudit | null; auditLoading: boolean; items: MediaHealthItem[]; missingCount: number; onAudit: () => void; onOpenMaintenance?: () => void }) {
  const auditItems = audit?.items ?? [];
  return (
    <MediaInfoStack title="媒体健康">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge className={missingCount > 0 ? 'border-amber-300/25 bg-amber-300/10 text-amber-100' : 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'}>
          {missingCount > 0 ? `缺 ${missingCount} 项` : '媒体完整'}
        </Badge>
        {audit && <Badge className={audit.issueCount > 0 ? 'border-rose-300/25 bg-rose-300/10 text-rose-100' : 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'}>{audit.issueCount > 0 ? `问题引用 ${audit.issueCount}` : '引用正常'}</Badge>}
        <Button className="h-7 px-2" disabled={auditLoading} size="sm" variant="ghost" onClick={onAudit}><RefreshCw className={cn('h-3.5 w-3.5', auditLoading && 'animate-spin')} />检查引用</Button>
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 py-1 text-xs" key={item.id}>
            <span className="text-slate-500">{item.label}</span>
            <span className={cn('inline-flex min-w-0 items-center gap-1.5 break-words', item.status === 'ok' ? 'text-emerald-100' : 'text-amber-100')}>
              {item.status === 'ok' ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
              {item.detail}
            </span>
          </div>
        ))}
      </div>
      {audit && (
        <div className="mt-3 space-y-2 border-t border-dashed border-white/10 pt-3">
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <MediaAuditStat label="引用" value={audit.totalRefs} />
            <MediaAuditStat label="缺失" value={audit.missingCount} tone={audit.missingCount > 0 ? 'warn' : 'ok'} />
            <MediaAuditStat label="C 盘" value={audit.cDriveCount} tone={audit.cDriveCount > 0 ? 'danger' : 'ok'} />
            <MediaAuditStat label="Playnite" value={audit.playniteCount} tone={audit.playniteCount > 0 ? 'danger' : 'ok'} />
          </div>
          {auditItems.length === 0 ? (
            <div className="rounded-md border border-white/10 bg-black/10 px-2 py-2 text-xs text-slate-500">没有发现图片引用问题。</div>
          ) : (
            <div className="space-y-1.5">
              {onOpenMaintenance && (
                <Button className="h-8 w-full justify-center" size="sm" variant="outline" onClick={onOpenMaintenance}><Wrench className="h-4 w-4" />到维护中心处理</Button>
              )}
              {auditItems.map((item, index) => <MediaAuditIssue item={item} key={`${item.sourceKind}-${item.fieldName ?? 'field'}-${item.value}-${index}`} />)}
              {audit.truncated && <div className="text-[11px] text-slate-500">结果较多，当前只显示前 80 条。</div>}
            </div>
          )}
        </div>
      )}
    </MediaInfoStack>
  );
}

function MediaInfoStack({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="detail-info-stack bg-transparent">
      <div className="mb-3 border-b border-dashed border-white/15 pb-2 text-sm font-semibold text-slate-100">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function MediaAuditStat({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'ok' | 'warn' | 'danger' }) {
  const toneClass = tone === 'danger' ? 'text-rose-100' : tone === 'warn' ? 'text-amber-100' : tone === 'ok' ? 'text-emerald-100' : 'text-slate-300';
  return (
    <div className="rounded-md border border-white/10 bg-black/10 px-2 py-1.5">
      <div className="text-slate-500">{label}</div>
      <div className={cn('mt-0.5 font-mono', toneClass)}>{value}</div>
    </div>
  );
}

function MediaAuditIssue({ item }: { item: MediaAuditItem }) {
  const issues = item.issues.length > 0 ? item.issues : [item.status];
  return (
    <div className="rounded-md border border-white/10 bg-black/10 px-2 py-2 text-[11px] leading-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge>{imageAuditFieldLabel(item.fieldName ?? item.sourceLabel)}</Badge>
        {issues.map((issue) => <Badge className={imageAuditBadgeClass(issue)} key={issue}>{imageAuditIssueLabel(issue)}</Badge>)}
      </div>
      <div className="mt-1 break-all font-mono text-slate-400">{item.value}</div>
      {item.resolvedPath && <div className="mt-1 break-all font-mono text-slate-600">{item.resolvedPath}</div>}
    </div>
  );
}
