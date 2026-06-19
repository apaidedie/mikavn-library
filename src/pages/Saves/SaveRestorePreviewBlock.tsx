import { Badge } from '@/components/ui/badge';
import type { SaveRestoreMode, SaveRestorePreview } from '@/types/saves';

export function SaveRestorePreviewBlock({ preview }: { preview: SaveRestorePreview }) {
  const isMirror = preview.mode === 'mirror';
  return (
    <div className="rounded-md border border-white/[0.08] bg-black/[0.12] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-100">
          <Badge className={isMirror ? 'border-rose-300/25 bg-rose-300/10 text-rose-100' : 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'}>{restoreModeLabel(preview.mode as SaveRestoreMode)}预览</Badge>
          <span>备份 {formatCount(preview.backupFileCount)} 个文件，当前 {formatCount(preview.currentFileCount)} 个文件</span>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <PreviewStat label="新增" value={preview.newFiles} tone={preview.newFiles > 0 ? 'ok' : 'neutral'} />
        <PreviewStat label="覆盖" value={preview.overwrittenFiles} tone={preview.overwrittenFiles > 0 ? 'warn' : 'neutral'} />
        <PreviewStat label={isMirror ? '将清理' : '将保留'} value={isMirror ? preview.removedFiles : preview.keptFiles} tone={(isMirror ? preview.removedFiles : preview.keptFiles) > 0 ? 'warn' : 'neutral'} />
        <PreviewStat label="备份文件" value={preview.backupFileCount} />
      </div>
      <div className="mt-3 grid gap-2 text-[11px] leading-5 lg:grid-cols-2">
        <PreviewSamples label="新增样例" values={preview.sampleNewFiles} />
        <PreviewSamples label="覆盖样例" values={preview.sampleOverwrittenFiles} />
        <PreviewSamples label={isMirror ? '清理样例' : '保留样例'} values={isMirror ? preview.sampleRemovedFiles : preview.sampleKeptFiles} />
      </div>
    </div>
  );
}

function PreviewStat({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'ok' | 'warn' }) {
  const toneClass = tone === 'ok' ? 'text-emerald-200' : tone === 'warn' ? 'text-amber-200' : 'text-slate-200';
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-sm ${toneClass}`}>{formatCount(value)}</div>
    </div>
  );
}

function PreviewSamples({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="min-w-0 rounded-md border border-white/[0.06] bg-black/[0.10] px-2.5 py-2">
      <div className="mb-1 text-slate-600">{label}</div>
      <div className="space-y-0.5">
        {values.map((value) => <div className="truncate font-mono text-slate-400" key={value} title={value}>{value}</div>)}
      </div>
    </div>
  );
}

export function restorePreviewKey(backupId: string, mode: SaveRestoreMode) {
  return `${backupId}:${mode}`;
}

export function restoreModeLabel(mode: SaveRestoreMode | string) {
  return mode === 'mirror' ? '镜像' : '合并';
}

export function restoreConfirmationMessage(mode: SaveRestoreMode, preview: SaveRestorePreview) {
  const summary = `${restoreModeLabel(mode)}恢复预览：新增 ${formatCount(preview.newFiles)} 个，覆盖 ${formatCount(preview.overwrittenFiles)} 个，${mode === 'mirror' ? `清理当前 ${formatCount(preview.removedFiles)} 个` : `保留当前 ${formatCount(preview.keptFiles)} 个`}。`;
  const warning = mode === 'mirror'
    ? '镜像恢复会先创建保护备份，然后清空当前存档目录内容，再复制备份内容。此操作只作用于已登记存档目录。'
    : '合并恢复会先创建保护备份，然后复制备份内容并覆盖同名存档文件，当前目录里的其它文件会保留。';
  return `${summary}\n\n${warning}\n\n确认继续吗？`;
}

export function formatCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}
