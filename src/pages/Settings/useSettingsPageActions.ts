import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import type { LogRecord, TrayStatus } from '@/types/archive';
import type { TagRecord } from '@/types/game';
import type { MetadataSourceRecord } from '@/types/metadata';
import { errorMessage } from '@/utils/errorMessage';
import { DEFAULT_SETTINGS_FORM, settingsFormToAiConnectionRecord, settingsFormToRecord, settingsRecordToForm } from './settingsFormMapping';
import type { SettingsForm, SettingsTab } from './settingsTypes';
import { useSettingsLibraryRoots } from './useSettingsLibraryRoots';
import { useSettingsLocalDataActions } from './useSettingsLocalDataActions';

export type TaskMessage = { text: string; taskId?: string | null };

type UseSettingsPageActionsOptions = {
  tabRequest?: { tab: SettingsTab; key: number } | null;
  onAccentPreview?: (uiAccentColor: string) => void;
  onThemePreview?: (uiThemeMode: string) => void;
  onSaved?: () => void;
};

export function useSettingsPageActions({ tabRequest, onAccentPreview, onThemePreview, onSaved }: UseSettingsPageActionsOptions) {
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
  const libraryRoots = useSettingsLibraryRoots({ onSaved, setError, setMessage });
  const localData = useSettingsLocalDataActions({ onSaved, setError, setMessage });

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
    void localData.loadDiagnostics();
    void libraryRoots.loadLibraryRoots();
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
      if (!window.confirm(`删除标签“${tag.name}”？\n\n将从 ${tag.gameCount} 个游戏中移除此标签。\n只会修改 MikaVN 标签关系，不会删除真实游戏文件或游戏记录。确认继续？`)) return;
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

  return {
    activeTab,
    error,
    form,
    libraryRoots,
    localData,
    logs,
    mergeSourceIds,
    message,
    metadataSources,
    renameTagName,
    savedTrayEnabled,
    selectedTagId,
    tags,
    testingAi,
    trayStatus,
    actions: {
      deleteSelectedTag,
      loadLogs,
      loadTags,
      mergeSelectedTags,
      pruneLogs,
      renameSelectedTag,
      save,
      selectTag,
      setAccentColor,
      setActiveTab,
      setRenameTagName,
      setThemeMode,
      testAiConnection,
      toggleMergeSource,
      updateForm,
    },
  };
}
