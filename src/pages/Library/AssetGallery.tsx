import { CheckCircle2, Download, ImagePlus, RefreshCw, Star, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CoverImage } from '@/components/ui/cover';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { api } from '@/services/api';
import { chooseImage } from '@/services/dialog';
import type { Game, GameAsset } from '@/types/game';
import { cn } from '@/utils/cn';
import { errorMessage } from '@/utils/errorMessage';
import { assetTypeLabel, assetTypeOrder, formatBytes } from './gameDetailMediaModel';

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
