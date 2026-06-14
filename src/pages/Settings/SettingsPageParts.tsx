import { Copy, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AppDataDiagnostics, TrayStatus } from '@/types/archive';
import type { TagRecord } from '@/types/game';

export type DirectoryLocationItem = { detail: string; label: string; path: string };

export function tagLabel(tag: TagRecord) {
  return `${tag.kind === 'genre' ? '类型' : '标签'} · ${tag.name} (${tag.gameCount})`;
}

export function Stat({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'ok' | 'warn' }) {
  const toneClass = tone === 'ok' ? 'text-emerald-200' : tone === 'warn' ? 'text-amber-200' : 'text-slate-200';
  return (
    <div className="rounded-md border border-white/10 bg-black/[0.12] px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`mt-1 truncate font-mono ${toneClass}`} title={value}>{value}</div>
    </div>
  );
}

export function getDirectoryLocations(diagnostics: AppDataDiagnostics): DirectoryLocationItem[] {
  return [
    { label: '数据根目录', path: diagnostics.appDataDir, detail: dataDirSourceLabel(diagnostics.dataDirSource) },
    { label: '数据库', path: diagnostics.database.path, detail: formatBytes(diagnostics.database.sizeBytes) },
    { label: '图片目录', path: diagnostics.images.path, detail: directoryDetail(diagnostics.images.fileCount, diagnostics.images.totalBytes) },
    { label: '缓存目录', path: diagnostics.cache.path, detail: directoryDetail(diagnostics.cache.fileCount, diagnostics.cache.totalBytes) },
    { label: '存档备份', path: diagnostics.saveBackups.path, detail: directoryDetail(diagnostics.saveBackups.fileCount, diagnostics.saveBackups.totalBytes) },
    { label: '日志目录', path: diagnostics.logs.path, detail: directoryDetail(diagnostics.logs.fileCount, diagnostics.logs.totalBytes) },
    { label: '数据库备份', path: diagnostics.databaseBackups.rootPath, detail: directoryDetail(diagnostics.databaseBackups.fileCount, diagnostics.databaseBackups.totalBytes) },
  ];
}

export function DirectoryLocation({ detail, label, onCopy, onReveal, path }: { detail: string; label: string; onCopy: () => void; onReveal: () => void; path: string }) {
  return (
    <div className="grid gap-2 rounded-md border border-white/10 bg-black/[0.12] px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500">{label}</span>
          <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-500">{detail}</span>
        </div>
        <div className="mt-1 break-all font-mono text-xs text-slate-300">{path}</div>
      </div>
      <div className="flex items-start gap-2">
        <Button aria-label={`复制${label}`} className="h-8 w-8" size="icon" title={`复制${label}`} variant="ghost" onClick={onCopy}>
          <Copy className="h-4 w-4" />
        </Button>
        <Button aria-label={`打开${label}`} className="h-8 w-8" size="icon" title={`打开${label}`} variant="ghost" onClick={onReveal}>
          <FolderOpen className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function TrayStatusPanel({ status }: { status: TrayStatus }) {
  const menuLabels = status.menuItems.map((item) => item.label).join(' / ');
  return (
    <div className="grid w-[min(42rem,calc(100vw-3rem))] gap-2 text-left text-xs sm:grid-cols-3">
      <Stat label="托盘状态" value={status.enabled ? '托盘图标已启用' : '托盘图标未启用'} tone={status.enabled ? 'ok' : 'warn'} />
      <Stat label="关闭行为" value={trayCloseBehaviorLabel(status.closeBehavior)} tone={status.closeBehavior === 'hide_to_tray' ? 'ok' : 'neutral'} />
      <Stat label="托盘菜单" value={menuLabels || '无菜单'} />
    </div>
  );
}

export function formatCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function directoryDetail(fileCount: number, totalBytes: number) {
  return `${formatCount(fileCount)} 个 · ${formatBytes(totalBytes)}`;
}

export function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? Math.round(size) : size.toFixed(size >= 10 ? 1 : 2)} ${units[unit]}`;
}

export function dataDirSourceLabel(value: string) {
  if (value === 'env') return 'MIKAVN_APP_DATA_DIR';
  if (value === 'portable') return '应用旁 app-data';
  if (value === 'mock') return '浏览器预览';
  return '应用默认目录';
}

function trayCloseBehaviorLabel(value: string) {
  if (value === 'hide_to_tray') return '关闭主窗口时隐藏到托盘';
  if (value === 'close') return '关闭主窗口时直接退出';
  return value || '未知';
}
