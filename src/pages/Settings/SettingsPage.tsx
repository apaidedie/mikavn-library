import { Database, Palette, Save, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { PageFrame, PageHeader, PageShell } from '@/components/ui/page';
import { TaskNotice } from '@/components/ui/task-notice';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/services/api';
import { chooseArchiveDirectory, chooseArchivePath, chooseDatabaseBackupPath, chooseDatabaseRestorePath } from '@/services/dialog';
import type { AppDataDiagnostics, LibraryArchivePreview, LogRecord, TrayStatus } from '@/types/archive';
import type { TagRecord } from '@/types/game';
import type { MetadataSourceRecord } from '@/types/metadata';
import { errorMessage } from '@/utils/errorMessage';
import { AppearanceSettings } from './AppearanceSettings';
import { MetadataAiSettings } from './MetadataAiSettings';
import { SettingsDiagnosticLogsSection } from './SettingsDiagnosticLogsSection';
import { SettingsLibraryRootsSection } from './SettingsLibraryRootsSection';
import { SettingsLocalDataSection } from './SettingsLocalDataSection';
import { SettingsLocalPreferencesSection } from './SettingsLocalPreferencesSection';
import { SettingsTagMaintenanceSection } from './SettingsTagMaintenanceSection';
import { SettingsTraySection } from './SettingsTraySection';
import { DEFAULT_SETTINGS_FORM, settingsFormToAiConnectionRecord, settingsFormToRecord, settingsRecordToForm } from './settingsFormMapping';
import { formatBytes, getDirectoryLocations, type DirectoryLocationItem } from './SettingsPageParts';
import type { SettingsForm } from './settingsTypes';
import { useSettingsLibraryRoots } from './useSettingsLibraryRoots';

type TaskMessage = { text: string; taskId?: string | null };
export type SettingsTab = 'appearance' | 'sources' | 'local';

export function SettingsPage({ tabRequest, onAccentPreview, onThemePreview, onSaved, onOpenTask }: { tabRequest?: { tab: SettingsTab; key: number } | null; onAccentPreview?: (uiAccentColor: string) => void; onThemePreview?: (uiThemeMode: string) => void; onSaved?: () => void; onOpenTask?: (taskId: string) => void }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(tabRequest?.tab ?? 'appearance');
  const [form, setForm] = useState<SettingsForm>(DEFAULT_SETTINGS_FORM);
  const [message, setMessage] = useState<TaskMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [archiveDir, setArchiveDir] = useState('');
  const [archivePreview, setArchivePreview] = useState<LibraryArchivePreview | null>(null);
  const [includeImages, setIncludeImages] = useState(true);
  const [includeSaveBackups, setIncludeSaveBackups] = useState(false);
  const [metadataSources, setMetadataSources] = useState<MetadataSourceRecord[]>([]);
  const [diagnostics, setDiagnostics] = useState<AppDataDiagnostics | null>(null);
  const [trayStatus, setTrayStatus] = useState<TrayStatus | null>(null);
  const [savedTrayEnabled, setSavedTrayEnabled] = useState(DEFAULT_SETTINGS_FORM.tray_enabled);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [selectedTagId, setSelectedTagId] = useState('');
  const [renameTagName, setRenameTagName] = useState('');
  const [mergeSourceIds, setMergeSourceIds] = useState<string[]>([]);
  const [testingAi, setTestingAi] = useState(false);
  const {
    addLibraryRoot,
    libraryRootPath,
    libraryRoots,
    loadLibraryRoots,
    pickLibraryRoot,
    removeLibraryRoot,
    rootActionId,
    scanLibraryRoot,
    setLibraryRootPath,
    updateLibraryRoot,
  } = useSettingsLibraryRoots({ onSaved, setError, setMessage });

  useEffect(() => { if (tabRequest) setActiveTab(tabRequest.tab); }, [tabRequest]);

  useEffect(() => {
    api.getAppSettings().then((settings) => {
      const nextForm = settingsRecordToForm(settings);
      setForm(nextForm);
      setSavedTrayEnabled(nextForm.tray_enabled);
      onAccentPreview?.(nextForm.ui_accent_color);
      onThemePreview?.(nextForm.ui_theme_mode);
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
      await api.setAppSettings(settingsFormToRecord(form));
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

            <SettingsLocalDataSection
              archiveDir={archiveDir}
              archivePreview={archivePreview}
              cleanupLoading={cleanupLoading}
              databasePath={databasePath}
              diagnostics={diagnostics}
              diagnosticsLoading={diagnosticsLoading}
              directoryLocations={directoryLocations}
              includeImages={includeImages}
              includeSaveBackups={includeSaveBackups}
              onArchiveDirChange={setArchiveDir}
              onBackupDatabase={backupDatabase}
              onCleanupDatabaseBackups={cleanupDatabaseBackups}
              onCopyAllDirectoryPaths={copyAllDirectoryPaths}
              onCopyDirectoryPath={copyDirectoryPath}
              onExportArchive={exportArchive}
              onExportArchiveZip={exportArchiveZip}
              onImportArchive={importArchive}
              onIncludeImagesChange={setIncludeImages}
              onIncludeSaveBackupsChange={setIncludeSaveBackups}
              onLoadDiagnostics={loadDiagnostics}
              onPickArchiveDir={pickArchiveDir}
              onPickArchivePath={pickArchivePath}
              onPreviewArchive={previewArchive}
              onRestoreArchive={restoreArchive}
              onRestoreDatabase={restoreDatabase}
              onRevealPath={revealPath}
            />

            <SettingsTraySection form={form} savedTrayEnabled={savedTrayEnabled} trayStatus={trayStatus} onFormChange={updateForm} />

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

            <SettingsLocalPreferencesSection form={form} onFormChange={updateForm} />
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
      await api.setAppSettings(settingsFormToAiConnectionRecord(form));
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
