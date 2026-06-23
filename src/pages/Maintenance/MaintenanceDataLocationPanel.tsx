import { FileArchive, HardDrive, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import type { AppDataDiagnostics } from '@/types/archive';
import { databaseBackupCleanupPolicy, formatDatabaseBackupCleanupPolicy, getDatabaseBackupCleanupSuggestion } from '@/utils/databaseBackupCleanupPolicy';
import { PathRow, StorageStat, dataDirSourceLabel, formatBytes, formatCount } from './MaintenancePageParts';

export function MaintenanceDataLocationPanel({
  cleanupLoading,
  diagnostics,
  diagnosticExportLoading,
  onCleanupDatabaseBackups,
  onCopyPath,
  onExportDiagnosticPackage,
  onOpenImageHealth,
  onRevealPath,
}: {
  cleanupLoading: boolean;
  diagnostics: AppDataDiagnostics | null;
  diagnosticExportLoading: boolean;
  onCleanupDatabaseBackups: () => void;
  onCopyPath: (label: string, path: string) => void;
  onExportDiagnosticPackage: () => void;
  onOpenImageHealth: () => void;
  onRevealPath: (path: string) => void;
}) {
  const database = diagnostics?.database;
  const backupCleanupPolicyText = formatDatabaseBackupCleanupPolicy(databaseBackupCleanupPolicy);
  const backupCleanupSuggestion = getDatabaseBackupCleanupSuggestion(diagnostics?.databaseBackups);

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
        <SoftRow className="px-3 py-2 text-xs leading-5 text-slate-500">
          <div>
            数据库备份清理策略：{backupCleanupPolicyText}；只清理应用管理的旧数据库备份，不会删除当前 mikavn.db。
            {backupCleanupSuggestion && <span className="ml-2 text-amber-200">备份占用偏大：当前 {formatCount(backupCleanupSuggestion.fileCount)} 个 · {formatBytes(backupCleanupSuggestion.totalBytes)}。</span>}
          </div>
        </SoftRow>
        <SoftRow className="grid gap-3 px-3 py-3 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-100">
              <span>图片缓存维护</span>
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-500">图片缓存整理统一走图片健康检查；一键安全整理只移动未被数据库引用的缓存问题到隔离区，不会永久删除文件。</div>
            <div className="mt-2 text-xs text-slate-600">请先到图片健康查看孤儿图片、重复内容、无效图片、过大图片和类型不匹配项，再按隔离区 manifest.json 保留可恢复路径。</div>
          </div>
          <div className="flex shrink-0 flex-wrap items-start gap-2 xl:justify-end">
            <Button disabled={!diagnostics} size="sm" variant="outline" onClick={onOpenImageHealth}><ShieldCheck className="h-4 w-4" />转到图片健康</Button>
          </div>
        </SoftRow>
      </PanelContent>
    </Panel>
  );
}
