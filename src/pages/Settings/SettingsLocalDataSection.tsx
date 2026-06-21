import { Copy, Download, FileArchive, Folder, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfigItem, ConfigSection } from '@/components/ui/config-item';
import { Input } from '@/components/ui/input';
import type { AppDataDiagnostics, LibraryArchivePreview } from '@/types/archive';
import { databaseBackupCleanupPolicy, formatDatabaseBackupCleanupPolicy } from './settingsBackupCleanupPolicy';
import { SettingFlag } from './SettingFlag';
import { DirectoryLocation, Stat, dataDirSourceLabel, formatBytes, formatCount, type DirectoryLocationItem } from './SettingsPageParts';

type SettingsLocalDataSectionProps = {
  archiveDir: string;
  archivePreview: LibraryArchivePreview | null;
  cleanupLoading: boolean;
  databasePath: string;
  diagnosticExportLoading: boolean;
  diagnostics: AppDataDiagnostics | null;
  diagnosticsLoading: boolean;
  directoryLocations: DirectoryLocationItem[];
  includeImages: boolean;
  includeSaveBackups: boolean;
  onArchiveDirChange: (value: string) => void;
  onBackupDatabase: () => void | Promise<void>;
  onCleanupDatabaseBackups: () => void | Promise<void>;
  onCopyAllDirectoryPaths: (items: DirectoryLocationItem[]) => void | Promise<void>;
  onCopyDirectoryPath: (label: string, path: string) => void | Promise<void>;
  onExportArchive: () => void | Promise<void>;
  onExportArchiveZip: () => void | Promise<void>;
  onExportDiagnosticPackage: () => void | Promise<void>;
  onImportArchive: () => void | Promise<void>;
  onIncludeImagesChange: (value: boolean) => void;
  onIncludeSaveBackupsChange: (value: boolean) => void;
  onLoadDiagnostics: () => void | Promise<void>;
  onPickArchiveDir: () => void | Promise<void>;
  onPickArchivePath: () => void | Promise<void>;
  onPreviewArchive: () => void | Promise<void>;
  onRestoreArchive: () => void | Promise<void>;
  onRestoreDatabase: () => void | Promise<void>;
  onRevealPath: (label: string, path: string) => void | Promise<void>;
};

export function SettingsLocalDataSection({
  archiveDir,
  archivePreview,
  cleanupLoading,
  databasePath,
  diagnosticExportLoading,
  diagnostics,
  diagnosticsLoading,
  directoryLocations,
  includeImages,
  includeSaveBackups,
  onArchiveDirChange,
  onBackupDatabase,
  onCleanupDatabaseBackups,
  onCopyAllDirectoryPaths,
  onCopyDirectoryPath,
  onExportArchive,
  onExportArchiveZip,
  onExportDiagnosticPackage,
  onImportArchive,
  onIncludeImagesChange,
  onIncludeSaveBackupsChange,
  onLoadDiagnostics,
  onPickArchiveDir,
  onPickArchivePath,
  onPreviewArchive,
  onRestoreArchive,
  onRestoreDatabase,
  onRevealPath,
}: SettingsLocalDataSectionProps) {
  const latestBackup = diagnostics?.databaseBackups.files[0] ?? null;
  const cleanupPolicyText = formatDatabaseBackupCleanupPolicy(databaseBackupCleanupPolicy);

  return (
    <ConfigSection title="本地数据">
      <ConfigItem title="数据目录自检" description="读取当前应用数据目录、数据库完整性、图片引用和备份文件状态。">
        <div className="flex max-w-[42rem] flex-col items-end gap-2 text-right">
          <div className="flex flex-wrap justify-end gap-2">
            <Button disabled={diagnosticsLoading} variant="outline" onClick={onLoadDiagnostics}><RefreshCw className="h-4 w-4" />{diagnosticsLoading ? '检查中' : '刷新自检'}</Button>
            <Button disabled={diagnosticExportLoading} variant="outline" onClick={onExportDiagnosticPackage}><FileArchive className="h-4 w-4" />{diagnosticExportLoading ? '导出中' : '导出诊断包'}</Button>
            <Button disabled={cleanupLoading || !diagnostics?.databaseBackups.fileCount} variant="ghost" onClick={onCleanupDatabaseBackups}><Trash2 className="h-4 w-4" />{cleanupLoading ? '清理中' : '清理旧备份'}</Button>
          </div>
          <div className="text-xs text-slate-500">
            备份清理策略：{cleanupPolicyText}；只清理应用管理的旧数据库备份，不会删除当前 mikavn.db。
          </div>
        </div>
      </ConfigItem>
      {diagnostics ? (
        <>
          <ConfigItem title="当前数据目录" description={`来源：${dataDirSourceLabel(diagnostics.dataDirSource)} · mikavn.db`}>
            <div className="max-w-[42rem] break-all text-right font-mono text-xs text-slate-300">{diagnostics.appDataDir}</div>
          </ConfigItem>
          <ConfigItem title="目录位置速览" description="所有应用数据、图片、缓存、日志和备份目录都集中在这里，方便后期查找。" className="sm:items-start">
            <div className="grid w-[min(48rem,calc(100vw-3rem))] gap-3">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => void onCopyAllDirectoryPaths(directoryLocations)}><Copy className="h-4 w-4" />复制全部目录路径</Button>
              </div>
              <div className="grid gap-2 text-left text-xs lg:grid-cols-2">
                {directoryLocations.map((item) => (
                  <DirectoryLocation key={item.label} label={item.label} path={item.path} detail={item.detail} onCopy={() => void onCopyDirectoryPath(item.label, item.path)} onReveal={() => void onRevealPath(item.label, item.path)} />
                ))}
              </div>
            </div>
          </ConfigItem>
          <ConfigItem title="数据库健康" description={diagnostics.database.path}>
            <div className="grid w-[min(42rem,calc(100vw-3rem))] gap-2 text-left text-xs sm:grid-cols-2 lg:grid-cols-3">
              <Stat label="quick_check" value={diagnostics.database.quickCheck ?? 'unknown'} tone={diagnostics.database.quickCheckOk ? 'ok' : 'warn'} />
              <Stat label="游戏" value={formatCount(diagnostics.database.gameCount)} />
              <Stat label="图片资产" value={formatCount(diagnostics.database.assetCount)} />
              <Stat label="数据库大小" value={formatBytes(diagnostics.database.sizeBytes)} />
              <Stat label="外键问题" value={formatCount(diagnostics.database.foreignKeyIssues)} tone={diagnostics.database.foreignKeyIssues > 0 ? 'warn' : 'ok'} />
              <Stat label="图片引用缺失" value={formatCount(diagnostics.database.missingImageRefsCount)} tone={diagnostics.database.missingImageRefsCount > 0 ? 'warn' : 'ok'} />
            </div>
          </ConfigItem>
          <ConfigItem title="图片与备份" description="统计 app-data 下 images、save-backups 和安全数据库备份；外部 Playnite 引用不含已迁入 app-data/images 的旧导入缓存。">
            <div className="grid w-[min(42rem,calc(100vw-3rem))] gap-2 text-left text-xs sm:grid-cols-2 lg:grid-cols-3">
              <Stat label="图片文件" value={`${formatCount(diagnostics.images.fileCount)} · ${formatBytes(diagnostics.images.totalBytes)}`} />
              <Stat label="数据库备份" value={`${formatCount(diagnostics.databaseBackups.fileCount)} · ${formatBytes(diagnostics.databaseBackups.totalBytes)}`} />
              <Stat label="存档备份文件" value={`${formatCount(diagnostics.saveBackups.fileCount)} · ${formatBytes(diagnostics.saveBackups.totalBytes)}`} />
              <Stat label="C 盘图片引用" value={formatCount(diagnostics.database.cDriveImageRefsCount)} tone={diagnostics.database.cDriveImageRefsCount > 0 ? 'warn' : 'ok'} />
              <Stat label="外部 Playnite 引用" value={formatCount(diagnostics.database.playniteImageRefsCount)} tone={diagnostics.database.playniteImageRefsCount > 0 ? 'warn' : 'ok'} />
              <Stat label="日志文件" value={`${formatCount(diagnostics.logs.fileCount)} · ${formatBytes(diagnostics.logs.totalBytes)}`} />
            </div>
          </ConfigItem>
          {diagnostics.warnings.length > 0 && (
            <ConfigItem title="自检警告" description="这些项目不会自动修改，刷新或修复后会消失。">
              <div className="max-w-[42rem] space-y-1 text-right text-xs text-amber-200">
                {diagnostics.warnings.map((warning) => <div key={warning}>{warning}</div>)}
              </div>
            </ConfigItem>
          )}
        </>
      ) : (
        <ConfigItem title="当前数据目录" description="点击刷新自检后显示真实 app-data 路径、数据库和图片状态。">
          <Folder className="h-4 w-4 text-slate-500" />
        </ConfigItem>
      )}
      <ConfigItem title="数据库位置" description="应用数据目录 / mikavn.db">
        <div className="flex max-w-[42rem] flex-wrap items-center justify-end gap-2">
          <div className="min-w-0 break-all text-right font-mono text-xs text-slate-400">{databasePath || '等待自检刷新'}</div>
          <Button aria-label="复制数据库位置" disabled={!databasePath} size="sm" variant="ghost" onClick={() => void onCopyDirectoryPath('数据库位置', databasePath)}><Copy className="h-4 w-4" />复制</Button>
        </div>
      </ConfigItem>
      <ConfigItem id="database-restore-section" title="数据库备份与恢复" description="手动备份、打开备份目录，或安排下次启动恢复数据库。恢复前会自动创建保护备份。">
        <div className="flex max-w-[42rem] flex-col items-end gap-2 text-right">
          <div className="text-xs text-slate-400">
            最近备份：{latestBackup ? `${latestBackup.fileName} · ${formatBytes(latestBackup.sizeBytes)}` : '暂无可用数据库备份'}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button disabled={!diagnostics?.databaseBackups.rootPath} variant="ghost" onClick={() => diagnostics && void onRevealPath('数据库备份目录', diagnostics.databaseBackups.rootPath)}><Folder className="h-4 w-4" />打开备份目录</Button>
            <Button variant="secondary" onClick={onBackupDatabase}><Download className="h-4 w-4" />手动备份</Button>
            <Button variant="outline" onClick={onRestoreDatabase}><RotateCcw className="h-4 w-4" />安排恢复</Button>
          </div>
          <div className="text-xs text-slate-500">恢复会复制备份到 pending-restore，下次启动前先创建保护备份再替换当前数据库。</div>
        </div>
      </ConfigItem>
      <ConfigItem title="库归档位置" description="导出会在此目录下新建归档文件夹或 ZIP 文件；预览/导入可填写归档文件夹或 .zip 文件。">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Input className="w-72" value={archiveDir} onChange={(event) => onArchiveDirChange(event.target.value)} placeholder="D:\\MikaVN-Archives" />
          <Button aria-label="复制库归档位置" disabled={!archiveDir.trim()} variant="ghost" onClick={() => void onCopyDirectoryPath('库归档位置', archiveDir.trim())}><Copy className="h-4 w-4" />复制</Button>
          <Button variant="outline" onClick={onPickArchiveDir}>选择</Button>
          <Button variant="ghost" onClick={onPickArchivePath}>选择 ZIP</Button>
        </div>
      </ConfigItem>
      <ConfigItem title="导出库归档" description="包含 manifest、一致性数据库备份、可选图片缓存和存档备份副本。支持目录归档与 ZIP 归档。">
        <div className="flex flex-wrap justify-end gap-2">
          <SettingFlag checked={includeImages} label="图片缓存" onChange={onIncludeImagesChange} />
          <SettingFlag checked={includeSaveBackups} label="存档备份" onChange={onIncludeSaveBackupsChange} />
          <Button variant="secondary" onClick={onExportArchive}><Download className="h-4 w-4" />导出归档</Button>
          <Button variant="outline" onClick={onExportArchiveZip}><Download className="h-4 w-4" />导出 ZIP</Button>
        </div>
      </ConfigItem>
      <ConfigItem title="预览库归档" description="只读取目录或 ZIP 中的 manifest 和文件计数，不覆盖当前数据库。">
        <Button variant="outline" onClick={onPreviewArchive}>预览</Button>
      </ConfigItem>
      {archivePreview && (
        <ConfigItem title="归档预览" description={`${archivePreview.manifest.exportedAt} · 数据库 ${archivePreview.databasePresent ? '存在' : '缺失'}`}>
          <div className="text-right text-xs leading-6 text-slate-400">
            <div>图片 {archivePreview.imagesCount} 个 · 存档备份 {archivePreview.saveBackupsCount} 个</div>
            {archivePreview.warnings.map((warning) => <div className="text-amber-200" key={warning}>{warning}</div>)}
          </div>
        </ConfigItem>
      )}
      <ConfigItem title="安全导入归档" description="支持目录归档与 ZIP 归档。导入前会自动备份当前数据库，只合并不冲突的新游戏记录。">
        <Button disabled={!archivePreview?.databasePresent} variant="secondary" onClick={onImportArchive}><Download className="h-4 w-4" />安全导入</Button>
      </ConfigItem>
      <ConfigItem title="完整恢复归档" description="高风险：安排下次启动用归档数据库替换当前数据库，可镜像恢复图片/存档缓存；会创建保护备份，不会触碰真实游戏安装目录。">
        <Button disabled={!archivePreview?.databasePresent} variant="danger" onClick={onRestoreArchive}><RotateCcw className="h-4 w-4" />完整恢复</Button>
      </ConfigItem>
      <ConfigItem title="图片缓存" description="应用数据目录 / images">
        <Folder className="h-4 w-4 text-slate-500" />
      </ConfigItem>
    </ConfigSection>
  );
}
