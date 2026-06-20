import { FileArchive, HardDrive, ShieldCheck, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import type { AppDataDiagnostics } from '@/types/archive';
import type { AssetCacheCleanupResult } from '@/types/game';
import { CompactStat, PathRow, StorageStat, dataDirSourceLabel, formatBytes } from './MaintenancePageParts';

export function MaintenanceDataLocationPanel({
  assetCleanupLoading,
  assetCleanupPreview,
  cleanupLoading,
  diagnostics,
  diagnosticExportLoading,
  onCleanupAssetCache,
  onCleanupDatabaseBackups,
  onCopyPath,
  onExportDiagnosticPackage,
  onPreviewAssetCacheCleanup,
  onRevealPath,
}: {
  assetCleanupLoading: boolean;
  assetCleanupPreview: AssetCacheCleanupResult | null;
  cleanupLoading: boolean;
  diagnostics: AppDataDiagnostics | null;
  diagnosticExportLoading: boolean;
  onCleanupAssetCache: () => void;
  onCleanupDatabaseBackups: () => void;
  onCopyPath: (label: string, path: string) => void;
  onExportDiagnosticPackage: () => void;
  onPreviewAssetCacheCleanup: () => void;
  onRevealPath: (path: string) => void;
}) {
  const database = diagnostics?.database;

  return (
    <Panel>
      <PanelHeader
        title="数据位置"
        description={diagnostics ? `来源：${dataDirSourceLabel(diagnostics.dataDirSource)}` : '当前 app-data 路径'}
        icon={<HardDrive className="h-4 w-4" />}
        actions={(
          <div className="flex flex-wrap justify-end gap-2">
            <Button disabled={diagnosticExportLoading || !diagnostics} size="sm" variant="outline" onClick={onExportDiagnosticPackage}><FileArchive className="h-4 w-4" />{diagnosticExportLoading ? '导出中' : '导出诊断包'}</Button>
            <Button disabled={cleanupLoading || !diagnostics?.databaseBackups.fileCount} size="sm" variant="ghost" onClick={onCleanupDatabaseBackups}><Trash2 className="h-4 w-4" />{cleanupLoading ? '清理中' : '清理旧备份'}</Button>
          </div>
        )}
      />
      <PanelContent className="space-y-2">
        <PathRow label="数据目录" value={diagnostics?.appDataDir ?? '等待自检'} onCopy={diagnostics ? () => onCopyPath('数据目录', diagnostics.appDataDir) : undefined} onReveal={diagnostics ? () => onRevealPath(diagnostics.appDataDir) : undefined} />
        <PathRow label="数据库" value={database?.path ?? '等待自检'} onCopy={database ? () => onCopyPath('数据库', database.path) : undefined} onReveal={database ? () => onRevealPath(database.path) : undefined} />
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <StorageStat label="图片缓存" path={diagnostics?.images.path} size={diagnostics?.images.totalBytes ?? 0} count={diagnostics?.images.fileCount ?? 0} onCopy={diagnostics ? () => onCopyPath('图片缓存', diagnostics.images.path) : undefined} onReveal={diagnostics ? () => onRevealPath(diagnostics.images.path) : undefined} />
          <StorageStat label="日志" path={diagnostics?.logs.path} size={diagnostics?.logs.totalBytes ?? 0} count={diagnostics?.logs.fileCount ?? 0} onCopy={diagnostics ? () => onCopyPath('日志', diagnostics.logs.path) : undefined} onReveal={diagnostics ? () => onRevealPath(diagnostics.logs.path) : undefined} />
          <StorageStat label="存档备份" path={diagnostics?.saveBackups.path} size={diagnostics?.saveBackups.totalBytes ?? 0} count={diagnostics?.saveBackups.fileCount ?? 0} onCopy={diagnostics ? () => onCopyPath('存档备份', diagnostics.saveBackups.path) : undefined} onReveal={diagnostics ? () => onRevealPath(diagnostics.saveBackups.path) : undefined} />
          <StorageStat label="数据库备份" path={diagnostics?.databaseBackups.rootPath} size={diagnostics?.databaseBackups.totalBytes ?? 0} count={diagnostics?.databaseBackups.fileCount ?? 0} onCopy={diagnostics ? () => onCopyPath('数据库备份', diagnostics.databaseBackups.rootPath) : undefined} onReveal={diagnostics ? () => onRevealPath(diagnostics.databaseBackups.rootPath) : undefined} />
        </div>
        <SoftRow className="grid gap-3 px-3 py-3 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-100">
              <span>图片缓存清理</span>
              <Badge>先预览</Badge>
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-500">只清理未被主图、媒体图库或简介本地图引用的 app-data/images 文件。</div>
            {assetCleanupPreview ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <CompactStat label="扫描文件" value={assetCleanupPreview.scannedFiles} />
                <CompactStat label="可清理" value={assetCleanupPreview.removedFiles} tone={assetCleanupPreview.removedFiles > 0 ? 'warn' : 'ok'} />
                <CompactStat label="可释放" value={formatBytes(assetCleanupPreview.removedBytes)} tone={assetCleanupPreview.removedBytes > 0 ? 'warn' : 'ok'} />
                <CompactStat label="保留文件" value={assetCleanupPreview.keptFiles} />
              </div>
            ) : (
              <div className="mt-2 text-xs text-slate-600">预览会扫描图片缓存，不会删除文件。</div>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-start gap-2 xl:justify-end">
            <Button disabled={assetCleanupLoading || !diagnostics} size="sm" variant="outline" onClick={onPreviewAssetCacheCleanup}><ShieldCheck className="h-4 w-4" />{assetCleanupLoading ? '检查中' : '预览'}</Button>
            <Button disabled={assetCleanupLoading || !diagnostics || (assetCleanupPreview ? assetCleanupPreview.removedFiles === 0 : false)} size="sm" variant="danger" onClick={onCleanupAssetCache}><Trash2 className="h-4 w-4" />{assetCleanupLoading ? '处理中' : '清理'}</Button>
          </div>
        </SoftRow>
      </PanelContent>
    </Panel>
  );
}
