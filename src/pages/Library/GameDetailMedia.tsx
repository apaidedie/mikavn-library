import { AlertTriangle, CheckCircle2, RefreshCw, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ImageReferenceAudit } from '@/types/archive';
import { cn } from '@/utils/cn';
import { imageSrc } from '@/utils/imageSrc';
import {
  imageAuditBadgeClass,
  imageAuditFieldLabel,
  imageAuditIssueLabel,
  parseDescriptionParts,
  type MediaAuditItem,
  type MediaHealthItem,
} from './gameDetailMediaModel';

export { summarizeMediaHealth } from './gameDetailMediaModel';
export { AssetGallery } from './AssetGallery';

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
            <img alt={part.alt || '简介图片'} className="mx-auto max-h-[460px] w-auto max-w-full object-contain" decoding="async" loading="lazy" src={src} />
          </figure>
        );
      })}
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
