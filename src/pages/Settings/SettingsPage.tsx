import { Copy, Database, Download, Folder, Palette, RefreshCw, RotateCcw, Save, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfigItem, ConfigSection } from '@/components/ui/config-item';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { PageFrame, PageHeader, PageShell } from '@/components/ui/page';
import { TaskNotice } from '@/components/ui/task-notice';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/services/api';
import { chooseArchiveDirectory, chooseArchivePath, chooseDatabaseBackupPath, chooseDatabaseRestorePath, chooseDirectory } from '@/services/dialog';
import type { AppDataDiagnostics, LibraryArchivePreview, LogRecord, TrayStatus } from '@/types/archive';
import type { LibraryRoot, TagRecord } from '@/types/game';
import type { MetadataSourceRecord } from '@/types/metadata';
import { errorMessage } from '@/utils/errorMessage';
import { AppearanceSettings } from './AppearanceSettings';
import { MetadataAiSettings } from './MetadataAiSettings';
import { SettingFlag } from './SettingFlag';
import { SettingsDiagnosticLogsSection } from './SettingsDiagnosticLogsSection';
import { SettingsLibraryRootsSection } from './SettingsLibraryRootsSection';
import { SettingsTagMaintenanceSection } from './SettingsTagMaintenanceSection';
import { DirectoryLocation, Stat, TrayStatusPanel, dataDirSourceLabel, formatBytes, formatCount, getDirectoryLocations, type DirectoryLocationItem } from './SettingsPageParts';
import type { SettingsForm } from './settingsTypes';

type TaskMessage = { text: string; taskId?: string | null };
export type SettingsTab = 'appearance' | 'sources' | 'local';

const defaults: SettingsForm = {
  provider_vndb_enabled: true,
  provider_bangumi_enabled: true,
  provider_dlsite_enabled: true,
  provider_fanza_enabled: true,
  provider_ymgal_enabled: true,
  ai_base_url: '',
  ai_model: 'gpt-4o-mini',
  ai_api_key: '',
  ui_accent_color: 'vnite',
  ui_theme_mode: 'dark',
  privacy_hide_hidden: false,
  privacy_blur_covers: false,
  privacy_filter_reports: true,
  save_auto_backup_before_launch: false,
  save_auto_backup_after_exit: false,
  tray_enabled: true,
};

export function SettingsPage({ tabRequest, onAccentPreview, onThemePreview, onSaved, onOpenTask }: { tabRequest?: { tab: SettingsTab; key: number } | null; onAccentPreview?: (uiAccentColor: string) => void; onThemePreview?: (uiThemeMode: string) => void; onSaved?: () => void; onOpenTask?: (taskId: string) => void }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(tabRequest?.tab ?? 'appearance');
  const [form, setForm] = useState<SettingsForm>(defaults);
  const [message, setMessage] = useState<TaskMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [archiveDir, setArchiveDir] = useState('');
  const [archivePreview, setArchivePreview] = useState<LibraryArchivePreview | null>(null);
  const [includeImages, setIncludeImages] = useState(true);
  const [includeSaveBackups, setIncludeSaveBackups] = useState(false);
  const [metadataSources, setMetadataSources] = useState<MetadataSourceRecord[]>([]);
  const [diagnostics, setDiagnostics] = useState<AppDataDiagnostics | null>(null);
  const [trayStatus, setTrayStatus] = useState<TrayStatus | null>(null);
  const [savedTrayEnabled, setSavedTrayEnabled] = useState(defaults.tray_enabled);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [libraryRoots, setLibraryRoots] = useState<LibraryRoot[]>([]);
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [selectedTagId, setSelectedTagId] = useState('');
  const [renameTagName, setRenameTagName] = useState('');
  const [mergeSourceIds, setMergeSourceIds] = useState<string[]>([]);
  const [libraryRootPath, setLibraryRootPath] = useState('');
  const [rootActionId, setRootActionId] = useState<string | null>(null);
  const [testingAi, setTestingAi] = useState(false);

  useEffect(() => { if (tabRequest) setActiveTab(tabRequest.tab); }, [tabRequest]);

  useEffect(() => {
    api.getAppSettings().then((settings) => {
      const trayEnabled = settings.tray_enabled !== 'false';
      setForm({
        provider_vndb_enabled: settings.provider_vndb_enabled !== 'false',
        provider_bangumi_enabled: settings.provider_bangumi_enabled !== 'false',
        provider_dlsite_enabled: settings.provider_dlsite_enabled !== 'false',
        provider_fanza_enabled: settings.provider_fanza_enabled !== 'false',
        provider_ymgal_enabled: settings.provider_ymgal_enabled !== 'false',
        ai_base_url: settings.ai_base_url ?? '',
        ai_model: settings.ai_model ?? 'gpt-4o-mini',
        ai_api_key: settings.ai_api_key ?? '',
        ui_accent_color: settings.ui_accent_color ?? 'vnite',
        ui_theme_mode: settings.ui_theme_mode ?? 'dark',
        privacy_hide_hidden: settings.privacy_hide_hidden === 'true',
        privacy_blur_covers: settings.privacy_blur_covers === 'true',
        privacy_filter_reports: settings.privacy_filter_reports !== 'false',
        save_auto_backup_before_launch: settings.save_auto_backup_before_launch === 'true',
        save_auto_backup_after_exit: settings.save_auto_backup_after_exit === 'true',
        tray_enabled: trayEnabled,
      });
      setSavedTrayEnabled(trayEnabled);
      onAccentPreview?.(settings.ui_accent_color ?? 'vnite');
      onThemePreview?.(settings.ui_theme_mode ?? 'dark');
    }).catch((reason: unknown) => setError(errorMessage(reason)));
  }, [onAccentPreview, onThemePreview]);

  useEffect(() => {
    api.listMetadataSources().then(setMetadataSources).catch(() => undefined);
    void loadDiagnostics();
    void loadLibraryRoots();
    void loadLogs();
    void loadTags();
    void loadTrayStatus();
  }, []);

  const save = async () => {
    setError(null);
    setMessage(null);
    try {
      await api.setAppSettings({
        provider_vndb_enabled: String(form.provider_vndb_enabled),
        provider_bangumi_enabled: String(form.provider_bangumi_enabled),
        provider_dlsite_enabled: String(form.provider_dlsite_enabled),
        provider_fanza_enabled: String(form.provider_fanza_enabled),
        provider_ymgal_enabled: String(form.provider_ymgal_enabled),
        ai_base_url: form.ai_base_url,
        ai_model: form.ai_model,
        ai_api_key: form.ai_api_key,
        ui_accent_color: form.ui_accent_color,
        ui_theme_mode: form.ui_theme_mode,
        ui_vnite_theme_migrated: 'true',
        privacy_hide_hidden: String(form.privacy_hide_hidden),
        privacy_blur_covers: String(form.privacy_blur_covers),
        privacy_filter_reports: String(form.privacy_filter_reports),
        save_auto_backup_before_launch: String(form.save_auto_backup_before_launch),
        save_auto_backup_after_exit: String(form.save_auto_backup_after_exit),
        tray_enabled: String(form.tray_enabled),
      });
      await loadTrayStatus();
      setSavedTrayEnabled(form.tray_enabled);
      setMessage({ text: form.ai_api_key.trim() ? '设置已保存到本机。API Key 属于本机私有配置，请勿共享数据库或配置文件。' : '设置已保存到本机。' });
      onSaved?.();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  const directoryLocations = diagnostics ? getDirectoryLocations(diagnostics) : [];
  const databasePath = diagnostics?.database.path ?? '';

  return (
    <PageShell>
      <PageFrame className="max-w-[76rem] gap-6">
        <PageHeader
          title="设置"
          description="本机数据源、外观、AI 与隐私配置。"
          actions={<Button onClick={save}><Save className="h-4 w-4" />保存设置</Button>}
        />
        {(error || message) && (
          <div className="space-y-2">
            {error && <Notice className="py-2" tone="error">{error}</Notice>}
            {message && <TaskNotice message={message.text} taskId={message.taskId} onOpenTask={onOpenTask} />}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SettingsTab)}>
          <TabsList className="border-b border-white/10">
            <TabsTrigger value="appearance"><Palette className="mr-2 h-4 w-4" />外观</TabsTrigger>
            <TabsTrigger value="sources"><Search className="mr-2 h-4 w-4" />数据源与 AI</TabsTrigger>
            <TabsTrigger value="local"><Database className="mr-2 h-4 w-4" />本地与隐私</TabsTrigger>
          </TabsList>

          <TabsContent className="space-y-6" value="appearance">
            <AppearanceSettings form={form} onAccentColorChange={setAccentColor} onThemeModeChange={setThemeMode} />
          </TabsContent>

          <TabsContent className="space-y-6" value="sources">
            <MetadataAiSettings form={form} metadataSources={metadataSources} testingAi={testingAi} onFormChange={updateForm} onTestAiConnection={testAiConnection} />
          </TabsContent>

          <TabsContent className="space-y-6" value="local">
            <SettingsLibraryRootsSection
              libraryRootPath={libraryRootPath}
              libraryRoots={libraryRoots}
              rootActionId={rootActionId}
              onAddLibraryRoot={addLibraryRoot}
              onCopyDirectoryPath={copyDirectoryPath}
              onLibraryRootPathChange={setLibraryRootPath}
              onPickLibraryRoot={pickLibraryRoot}
              onRemoveLibraryRoot={removeLibraryRoot}
              onScanLibraryRoot={scanLibraryRoot}
              onUpdateLibraryRoot={updateLibraryRoot}
            />

            <ConfigSection title="本地数据">
              <ConfigItem title="数据目录自检" description="读取当前应用数据目录、数据库完整性、图片引用和备份文件状态。">
                <div className="flex flex-wrap justify-end gap-2">
                  <Button disabled={diagnosticsLoading} variant="outline" onClick={loadDiagnostics}><RefreshCw className="h-4 w-4" />{diagnosticsLoading ? '检查中' : '刷新自检'}</Button>
                  <Button disabled={cleanupLoading || !diagnostics?.databaseBackups.fileCount} variant="ghost" onClick={cleanupDatabaseBackups}><Trash2 className="h-4 w-4" />{cleanupLoading ? '清理中' : '清理旧备份'}</Button>
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
                        <Button size="sm" variant="outline" onClick={() => void copyAllDirectoryPaths(directoryLocations)}><Copy className="h-4 w-4" />复制全部目录路径</Button>
                      </div>
                      <div className="grid gap-2 text-left text-xs lg:grid-cols-2">
                        {directoryLocations.map((item) => (
                          <DirectoryLocation key={item.label} label={item.label} path={item.path} detail={item.detail} onCopy={() => void copyDirectoryPath(item.label, item.path)} onReveal={() => void revealPath(item.label, item.path)} />
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
                  <ConfigItem title="图片与备份" description="统计 app-data 下 images、save-backups 和安全数据库备份。">
                    <div className="grid w-[min(42rem,calc(100vw-3rem))] gap-2 text-left text-xs sm:grid-cols-2 lg:grid-cols-3">
                      <Stat label="图片文件" value={`${formatCount(diagnostics.images.fileCount)} · ${formatBytes(diagnostics.images.totalBytes)}`} />
                      <Stat label="旧数据库备份" value={`${formatCount(diagnostics.databaseBackups.fileCount)} · ${formatBytes(diagnostics.databaseBackups.totalBytes)}`} />
                      <Stat label="存档备份文件" value={`${formatCount(diagnostics.saveBackups.fileCount)} · ${formatBytes(diagnostics.saveBackups.totalBytes)}`} />
                      <Stat label="C 盘图片引用" value={formatCount(diagnostics.database.cDriveImageRefsCount)} tone={diagnostics.database.cDriveImageRefsCount > 0 ? 'warn' : 'ok'} />
                      <Stat label="Playnite 图片引用" value={formatCount(diagnostics.database.playniteImageRefsCount)} tone={diagnostics.database.playniteImageRefsCount > 0 ? 'warn' : 'ok'} />
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
                  <Button aria-label="复制数据库位置" disabled={!databasePath} size="sm" variant="ghost" onClick={() => void copyDirectoryPath('数据库位置', databasePath)}><Copy className="h-4 w-4" />复制</Button>
                </div>
              </ConfigItem>
              <ConfigItem title="手动备份数据库" description="生成 SQLite 一致性备份，备份文件可由你选择保存位置。">
                <Button variant="secondary" onClick={backupDatabase}><Download className="h-4 w-4" />备份</Button>
              </ConfigItem>
              <ConfigItem title="恢复数据库备份" description="复制备份到 pending-restore，下次启动前会先创建保护备份再替换当前数据库。">
                <Button variant="outline" onClick={restoreDatabase}><RotateCcw className="h-4 w-4" />安排恢复</Button>
              </ConfigItem>
              <ConfigItem title="库归档位置" description="导出会在此目录下新建归档文件夹或 ZIP 文件；预览/导入可填写归档文件夹或 .zip 文件。">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Input className="w-72" value={archiveDir} onChange={(event) => setArchiveDir(event.target.value)} placeholder="D:\\MikaVN-Archives" />
                  <Button aria-label="复制库归档位置" disabled={!archiveDir.trim()} variant="ghost" onClick={() => void copyDirectoryPath('库归档位置', archiveDir.trim())}><Copy className="h-4 w-4" />复制</Button>
                  <Button variant="outline" onClick={pickArchiveDir}>选择</Button>
                  <Button variant="ghost" onClick={pickArchivePath}>选择 ZIP</Button>
                </div>
              </ConfigItem>
              <ConfigItem title="导出库归档" description="包含 manifest、一致性数据库备份、可选图片缓存和存档备份副本。支持目录归档与 ZIP 归档。">
                <div className="flex flex-wrap justify-end gap-2">
                  <SettingFlag checked={includeImages} label="图片缓存" onChange={setIncludeImages} />
                  <SettingFlag checked={includeSaveBackups} label="存档备份" onChange={setIncludeSaveBackups} />
                  <Button variant="secondary" onClick={exportArchive}><Download className="h-4 w-4" />导出归档</Button>
                  <Button variant="outline" onClick={exportArchiveZip}><Download className="h-4 w-4" />导出 ZIP</Button>
                </div>
              </ConfigItem>
              <ConfigItem title="预览库归档" description="只读取目录或 ZIP 中的 manifest 和文件计数，不覆盖当前数据库。">
                <Button variant="outline" onClick={previewArchive}>预览</Button>
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
                <Button disabled={!archivePreview?.databasePresent} variant="secondary" onClick={importArchive}><Download className="h-4 w-4" />安全导入</Button>
              </ConfigItem>
              <ConfigItem title="完整恢复归档" description="高风险：安排下次启动用归档数据库替换当前数据库，可镜像恢复图片/存档缓存；会创建保护备份，不会触碰真实游戏安装目录。">
                <Button disabled={!archivePreview?.databasePresent} variant="danger" onClick={restoreArchive}><RotateCcw className="h-4 w-4" />完整恢复</Button>
              </ConfigItem>
              <ConfigItem title="图片缓存" description="应用数据目录 / images">
                <Folder className="h-4 w-4 text-slate-500" />
              </ConfigItem>
            </ConfigSection>

            <ConfigSection title="后台与托盘">
              <ConfigItem title="托盘图标" description="关闭主窗口后应用仍可留在系统托盘，方便长时间任务继续运行。">
                <div className="flex flex-col items-end gap-3">
                  <SettingFlag checked={form.tray_enabled} label="启用" onChange={(value) => setForm((current) => ({ ...current, tray_enabled: value }))} />
                  <div className="text-right text-xs text-slate-500">{form.tray_enabled === savedTrayEnabled ? '当前托盘状态与已保存设置一致。' : '托盘设置有未保存改动，保存后立即应用。'}</div>
                  {trayStatus ? <TrayStatusPanel status={trayStatus} /> : <div className="text-xs text-slate-500">正在读取托盘状态。</div>}
                </div>
              </ConfigItem>
            </ConfigSection>

            <SettingsDiagnosticLogsSection
              logs={logs}
              onCopyLogPath={(path) => void copyDirectoryPath('诊断日志', path)}
              onLoadLogs={loadLogs}
              onPruneLogs={pruneLogs}
              onRevealLogPath={(path) => void revealPath('诊断日志', path)}
            />

            <SettingsTagMaintenanceSection
              mergeSourceIds={mergeSourceIds}
              renameTagName={renameTagName}
              selectedTagId={selectedTagId}
              tags={tags}
              onDeleteSelectedTag={deleteSelectedTag}
              onLoadTags={loadTags}
              onMergeSelectedTags={mergeSelectedTags}
              onRenameSelectedTag={renameSelectedTag}
              onRenameTagNameChange={setRenameTagName}
              onSelectTag={selectTag}
              onToggleMergeSource={toggleMergeSource}
            />

            <ConfigSection title="存档自动备份">
              <ConfigItem title="启动前自动备份" description="启动游戏前复制已登记的存档路径到应用数据目录，并写入任务日志。">
                <SettingFlag checked={form.save_auto_backup_before_launch} label="启用" onChange={(value) => setForm((current) => ({ ...current, save_auto_backup_before_launch: value }))} />
              </ConfigItem>
              <ConfigItem title="退出后自动备份" description="游戏进程退出后再次复制存档路径。失败会进入任务日志，不删除真实存档。">
                <SettingFlag checked={form.save_auto_backup_after_exit} label="启用" onChange={(value) => setForm((current) => ({ ...current, save_auto_backup_after_exit: value }))} />
              </ConfigItem>
            </ConfigSection>

            <ConfigSection title="隐私设置">
              <ConfigItem title="隐藏敏感条目" description="游戏库默认不显示 hidden 条目。">
                <SettingFlag checked={form.privacy_hide_hidden} label="启用" onChange={(value) => setForm((current) => ({ ...current, privacy_hide_hidden: value }))} />
              </ConfigItem>
              <ConfigItem title="模糊封面" description="在列表、海报墙和详情页模糊封面。">
                <SettingFlag checked={form.privacy_blur_covers} label="启用" onChange={(value) => setForm((current) => ({ ...current, privacy_blur_covers: value }))} />
              </ConfigItem>
              <ConfigItem title="报告导出过滤 R18" description="报告页按设置排除隐藏或 R18 条目。">
                <SettingFlag checked={form.privacy_filter_reports} label="启用" onChange={(value) => setForm((current) => ({ ...current, privacy_filter_reports: value }))} />
              </ConfigItem>
            </ConfigSection>
          </TabsContent>
        </Tabs>
      </PageFrame>
    </PageShell>
  );

  function setAccentColor(value: string) {
    setForm((current) => ({ ...current, ui_accent_color: value }));
    onAccentPreview?.(value);
    setMessage(null);
  }

  function setThemeMode(value: string) {
    setForm((current) => ({ ...current, ui_theme_mode: value }));
    onThemePreview?.(value);
    setMessage(null);
  }

  function updateForm(update: Partial<SettingsForm>) {
    setForm((current) => ({ ...current, ...update }));
  }

  async function loadDiagnostics() {
    setDiagnosticsLoading(true);
    setError(null);
    try {
      setDiagnostics(await api.getAppDataDiagnostics());
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setDiagnosticsLoading(false);
    }
  }

  async function cleanupDatabaseBackups() {
    setError(null);
    setMessage(null);
    const ok = window.confirm('按安全规则清理旧数据库备份？会保留最近 10 个和 30 天内备份，不会删除当前 mikavn.db。');
    if (!ok) return;
    setCleanupLoading(true);
    try {
      const report = await api.cleanupOldDatabaseBackups({ retainCount: 10, retainDays: 30 });
      setMessage({ text: report.removedFiles > 0 ? `已清理 ${report.removedFiles} 个旧数据库备份，释放 ${formatBytes(report.removedBytes)}。` : '没有需要清理的旧数据库备份。' });
      await loadDiagnostics();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setCleanupLoading(false);
    }
  }

  async function revealPath(label: string, path: string) {
    setError(null);
    try {
      await api.revealPath(path);
      setMessage({ text: `已打开${label}。` });
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function copyDirectoryPath(label: string, path: string) {
    setError(null);
    try {
      await navigator.clipboard.writeText(path);
      setMessage({ text: `已复制${label}路径。` });
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function copyAllDirectoryPaths(items: DirectoryLocationItem[]) {
    setError(null);
    try {
      await navigator.clipboard.writeText(items.map((item) => `${item.label}\t${item.path}`).join('\n'));
      setMessage({ text: `已复制 ${items.length} 个目录路径。` });
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function backupDatabase() {
    setError(null);
    setMessage(null);
    try {
      const path = await chooseDatabaseBackupPath();
      if (!path) return;
      const task = await api.backupDatabase(path);
      setMessage({ text: `数据库备份任务已创建：${task.id}`, taskId: task.id });
      onSaved?.();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function restoreDatabase() {
    setError(null);
    setMessage(null);
    try {
      const path = await chooseDatabaseRestorePath();
      if (!path) return;
      const ok = window.confirm('恢复会在下次启动前替换当前数据库；应用会先创建保护备份。确认安排恢复吗？');
      if (!ok) return;
      const task = await api.restoreDatabaseBackup(path);
      setMessage({ text: `数据库恢复任务已创建：${task.id}。请重启应用以应用恢复。`, taskId: task.id });
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function loadLogs() {
    try {
      setLogs(await api.listDiagnosticLogs(20));
    } catch {
      setLogs([]);
    }
  }

  async function loadTrayStatus() {
    try {
      setTrayStatus(await api.getTrayStatus());
    } catch {
      setTrayStatus(null);
    }
  }

  async function loadTags() {
    try {
      const nextTags = await api.listTags();
      setTags(nextTags);
      setSelectedTagId((current) => nextTags.some((tag) => tag.id === current) ? current : '');
      setMergeSourceIds((current) => current.filter((id) => nextTags.some((tag) => tag.id === id)));
    } catch {
      setTags([]);
    }
  }

  function selectTag(id: string) {
    setSelectedTagId(id);
    const tag = tags.find((item) => item.id === id);
    setRenameTagName(tag?.name ?? '');
    setMergeSourceIds([]);
  }

  function toggleMergeSource(id: string, checked: boolean) {
    setMergeSourceIds((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id));
  }

  async function renameSelectedTag() {
    setError(null);
    setMessage(null);
    try {
      if (!selectedTagId || !renameTagName.trim()) return;
      const tag = await api.renameTag(selectedTagId, renameTagName.trim());
      setMessage({ text: `标签已重命名为：${tag.name}` });
      await loadTags();
      setSelectedTagId(tag.id);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function mergeSelectedTags() {
    setError(null);
    setMessage(null);
    try {
      if (!selectedTagId || mergeSourceIds.length === 0) return;
      const tag = await api.mergeTags(mergeSourceIds, selectedTagId);
      setMessage({ text: `已合并 ${mergeSourceIds.length} 个标签到：${tag.name}` });
      setMergeSourceIds([]);
      await loadTags();
      onSaved?.();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function deleteSelectedTag() {
    setError(null);
    setMessage(null);
    try {
      const tag = tags.find((item) => item.id === selectedTagId);
      if (!tag) return;
      if (!window.confirm(`从所有游戏移除标签“${tag.name}”？不会删除游戏条目。`)) return;
      await api.deleteTag(tag.id);
      setMessage({ text: `标签已删除：${tag.name}` });
      setSelectedTagId('');
      setRenameTagName('');
      setMergeSourceIds([]);
      await loadTags();
      onSaved?.();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function pruneLogs() {
    setError(null);
    setMessage(null);
    try {
      const policy = await api.getLogRetention();
      const removed = await api.pruneDiagnosticLogs(policy);
      setMessage({ text: removed > 0 ? `已清理 ${removed} 个过期日志。` : '没有需要清理的过期日志。' });
      await loadLogs();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function testAiConnection() {
    setTestingAi(true);
    setError(null);
    setMessage(null);
    try {
      await api.setAppSettings({
        ai_base_url: form.ai_base_url,
        ai_model: form.ai_model,
        ai_api_key: form.ai_api_key,
      });
      const result = await api.testAiConnection();
      setMessage({ text: `AI 连接可用：${result.model} · ${result.baseUrl}` });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setTestingAi(false);
    }
  }

  async function pickArchiveDir() {
    const selected = await chooseArchiveDirectory(archiveDir);
    if (selected) setArchiveDir(selected);
  }

  async function pickArchivePath() {
    const selected = await chooseArchivePath(archiveDir);
    if (selected) setArchiveDir(selected);
  }

  async function loadLibraryRoots() {
    try {
      setLibraryRoots(await api.listLibraryRoots());
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function pickLibraryRoot() {
    const selected = await chooseDirectory(libraryRootPath);
    if (selected) setLibraryRootPath(selected);
  }

  async function addLibraryRoot() {
    setError(null);
    setMessage(null);
    try {
      const path = libraryRootPath.trim() || await chooseDirectory(libraryRootPath);
      if (!path) return;
      await api.addLibraryRoot(path);
      setLibraryRootPath('');
      setMessage({ text: '库目录已添加。扫描会先生成候选，由你确认后才写入数据库。' });
      await loadLibraryRoots();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function updateLibraryRoot(root: LibraryRoot, input: { recursive?: boolean; enabled?: boolean }) {
    setRootActionId(root.id);
    setError(null);
    try {
      await api.updateLibraryRoot(root.id, input);
      await loadLibraryRoots();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setRootActionId(null);
    }
  }

  async function removeLibraryRoot(root: LibraryRoot) {
    if (!window.confirm('移除这个库目录记录？不会删除真实文件，也不会删除已入库游戏。')) return;
    setRootActionId(root.id);
    setError(null);
    try {
      await api.removeLibraryRoot(root.id);
      setMessage({ text: '库目录记录已移除，不影响真实文件和已入库游戏。' });
      await loadLibraryRoots();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setRootActionId(null);
    }
  }

  async function scanLibraryRoot(root: LibraryRoot) {
    setRootActionId(root.id);
    setError(null);
    setMessage(null);
    try {
      const task = await api.startScanTask(root.path, root.recursive);
      setMessage({ text: `已创建库目录扫描任务：${task.id}。请到扫描入库或任务页查看候选与进度。`, taskId: task.id });
      onSaved?.();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setRootActionId(null);
    }
  }

  async function exportArchive() {
    setError(null);
    setMessage(null);
    try {
      const targetDir = archiveDir.trim() || await chooseArchiveDirectory(archiveDir);
      if (!targetDir) return;
      setArchiveDir(targetDir);
      const task = await api.exportLibraryArchive({ targetDir, includeImages, includeSaveBackups });
      setMessage({ text: `库归档导出任务已创建：${task.id}`, taskId: task.id });
      onSaved?.();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function exportArchiveZip() {
    setError(null);
    setMessage(null);
    try {
      const targetDir = archiveDir.trim() || await chooseArchiveDirectory(archiveDir);
      if (!targetDir) return;
      setArchiveDir(targetDir);
      const task = await api.exportLibraryArchiveZip({ targetDir, includeImages, includeSaveBackups });
      setMessage({ text: `ZIP 库归档导出任务已创建：${task.id}`, taskId: task.id });
      onSaved?.();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function previewArchive() {
    setError(null);
    setMessage(null);
    try {
      const targetDir = archiveDir.trim() || await chooseArchiveDirectory(archiveDir);
      if (!targetDir) return;
      setArchiveDir(targetDir);
      const preview = await api.previewLibraryArchive(targetDir);
      setArchivePreview(preview);
      setMessage({ text: '归档预览已读取。安全导入会自动备份当前数据库并跳过冲突条目。' });
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function importArchive() {
    setError(null);
    setMessage(null);
    try {
      const targetDir = archivePreview?.archiveDir || archiveDir.trim() || await chooseArchiveDirectory(archiveDir);
      if (!targetDir) return;
      if (!window.confirm('安全导入会先备份当前数据库，然后只合并不冲突的新记录。继续？')) return;
      setArchiveDir(targetDir);
      const task = await api.importLibraryArchive({ archiveDir: targetDir, includeImages, includeSaveBackups });
      setMessage({ text: `库归档安全导入任务已创建：${task.id}`, taskId: task.id });
      onSaved?.();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function restoreArchive() {
    setError(null);
    setMessage(null);
    try {
      const targetDir = archivePreview?.archiveDir || archiveDir.trim() || await chooseArchiveDirectory(archiveDir);
      if (!targetDir) return;
      if (!archivePreview?.databasePresent) {
        setError('请先预览包含 mikavn.db 的有效库归档。');
        return;
      }
      const ok = window.confirm('完整恢复会在下次启动前用归档数据库替换当前数据库，并按当前勾选项镜像恢复图片/存档缓存。应用会先创建保护备份。确认安排完整恢复吗？');
      if (!ok) return;
      setArchiveDir(targetDir);
      const task = await api.restoreLibraryArchive({ archiveDir: targetDir, restoreImages: includeImages, restoreSaveBackups: includeSaveBackups });
      setMessage({ text: `库归档完整恢复任务已创建：${task.id}。请重启应用以应用数据库恢复。`, taskId: task.id });
      onSaved?.();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }
}
