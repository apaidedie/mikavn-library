import { useMemo, useState } from 'react';
import { api } from '@/services/api';
import { chooseArchiveDirectory, chooseArchivePath, chooseDatabaseBackupPath, chooseDatabaseRestorePath } from '@/services/dialog';
import type { AppDataDiagnostics, LibraryArchivePreview } from '@/types/archive';
import { errorMessage } from '@/utils/errorMessage';
import { databaseBackupCleanupPolicy, formatDatabaseBackupCleanupPolicy } from './settingsBackupCleanupPolicy';
import { formatBytes, getDirectoryLocations, type DirectoryLocationItem } from './SettingsPageParts';

type TaskMessage = { text: string; taskId?: string | null };

type UseSettingsLocalDataActionsOptions = {
  onSaved?: () => void;
  setError: (message: string | null) => void;
  setMessage: (message: TaskMessage | null) => void;
};

export function useSettingsLocalDataActions({ onSaved, setError, setMessage }: UseSettingsLocalDataActionsOptions) {
  const [archiveDir, setArchiveDir] = useState('');
  const [archivePreview, setArchivePreview] = useState<LibraryArchivePreview | null>(null);
  const [includeImages, setIncludeImages] = useState(true);
  const [includeSaveBackups, setIncludeSaveBackups] = useState(false);
  const [diagnostics, setDiagnostics] = useState<AppDataDiagnostics | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [diagnosticExportLoading, setDiagnosticExportLoading] = useState(false);
  const [diagnosticExportPath, setDiagnosticExportPath] = useState<string | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);

  const directoryLocations = useMemo(() => diagnostics ? getDirectoryLocations(diagnostics) : [], [diagnostics]);
  const databasePath = diagnostics?.database.path ?? '';

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
    const cleanupPolicyText = formatDatabaseBackupCleanupPolicy(databaseBackupCleanupPolicy);
    const ok = window.confirm(`按安全规则清理旧数据库备份？${cleanupPolicyText}；只清理应用管理的旧数据库备份，不会删除当前 mikavn.db。`);
    if (!ok) return;
    setCleanupLoading(true);
    try {
      const report = await api.cleanupOldDatabaseBackups(databaseBackupCleanupPolicy);
      setMessage({ text: report.removedFiles > 0 ? `已清理 ${report.removedFiles} 个旧数据库备份，释放 ${formatBytes(report.removedBytes)}。` : '没有需要清理的旧数据库备份。' });
      await loadDiagnostics();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setCleanupLoading(false);
    }
  }

  async function exportDiagnosticPackage() {
    setError(null);
    setMessage(null);
    setDiagnosticExportPath(null);
    setDiagnosticExportLoading(true);
    try {
      const report = await api.exportDiagnosticPackage();
      setDiagnosticExportPath(report.path);
      setMessage({ text: `诊断包已导出：${report.fileName}（${formatBytes(report.sizeBytes)}）。包含自检摘要和脱敏日志预览，不包含完整数据库、图片缓存或存档文件。` });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setDiagnosticExportLoading(false);
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

  async function revealDiagnosticExportPath() {
    if (!diagnosticExportPath) return;
    await revealPath('诊断包位置', diagnosticExportPath);
  }

  async function copyDiagnosticExportPath() {
    if (!diagnosticExportPath) return;
    await copyDirectoryPath('诊断包', diagnosticExportPath);
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

  return {
    archiveDir,
    archivePreview,
    backupDatabase,
    cleanupDatabaseBackups,
    cleanupLoading,
    copyAllDirectoryPaths,
    copyDirectoryPath,
    databasePath,
    diagnosticExportLoading,
    diagnosticExportPath,
    diagnostics,
    diagnosticsLoading,
    directoryLocations,
    exportArchive,
    exportArchiveZip,
    exportDiagnosticPackage,
    importArchive,
    includeImages,
    includeSaveBackups,
    loadDiagnostics,
    pickArchiveDir,
    pickArchivePath,
    previewArchive,
    restoreArchive,
    restoreDatabase,
    revealDiagnosticExportPath,
    revealPath,
    copyDiagnosticExportPath,
    setArchiveDir,
    setIncludeImages,
    setIncludeSaveBackups,
  };
}
