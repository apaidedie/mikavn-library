import { Database, Palette, Save, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { PageFrame, PageHeader, PageShell } from '@/components/ui/page';
import { TaskNotice } from '@/components/ui/task-notice';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/services/api';
import type { LogRecord, TrayStatus } from '@/types/archive';
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
import type { SettingsForm } from './settingsTypes';
import { useSettingsLibraryRoots } from './useSettingsLibraryRoots';
import { useSettingsLocalDataActions } from './useSettingsLocalDataActions';

type TaskMessage = { text: string; taskId?: string | null };
export type SettingsTab = 'appearance' | 'sources' | 'local';

export function SettingsPage({ tabRequest, onAccentPreview, onThemePreview, onSaved, onOpenTask }: { tabRequest?: { tab: SettingsTab; key: number } | null; onAccentPreview?: (uiAccentColor: string) => void; onThemePreview?: (uiThemeMode: string) => void; onSaved?: () => void; onOpenTask?: (taskId: string) => void }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(tabRequest?.tab ?? 'appearance');
  const [form, setForm] = useState<SettingsForm>(DEFAULT_SETTINGS_FORM);
  const [message, setMessage] = useState<TaskMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metadataSources, setMetadataSources] = useState<MetadataSourceRecord[]>([]);
  const [trayStatus, setTrayStatus] = useState<TrayStatus | null>(null);
  const [savedTrayEnabled, setSavedTrayEnabled] = useState(DEFAULT_SETTINGS_FORM.tray_enabled);
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
  const {
    archiveDir,
    archivePreview,
    backupDatabase,
    cleanupDatabaseBackups,
    cleanupLoading,
    copyAllDirectoryPaths,
    copyDirectoryPath,
    databasePath,
    diagnostics,
    diagnosticsLoading,
    directoryLocations,
    exportArchive,
    exportArchiveZip,
    importArchive,
    includeImages,
    includeSaveBackups,
    loadDiagnostics,
    pickArchiveDir,
    pickArchivePath,
    previewArchive,
    restoreArchive,
    restoreDatabase,
    revealPath,
    setArchiveDir,
    setIncludeImages,
    setIncludeSaveBackups,
  } = useSettingsLocalDataActions({ onSaved, setError, setMessage });

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

}
