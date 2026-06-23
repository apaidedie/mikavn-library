import { Button } from '@/components/ui/button';
import type { ImageCacheFileIssue, ImageDuplicateContentGroup, ImageDuplicateNameGroup, ImageHealthReport } from '@/types/archive';
import { formatBytes } from './MaintenancePageParts';

export function ImageHealthSamplePanels({
  cache,
  onOpenGame,
  onRevealPath,
}: {
  cache: ImageHealthReport['cache'];
  onOpenGame?: (gameId: string) => void;
  onRevealPath: (path: string) => void;
}) {
  return (
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
