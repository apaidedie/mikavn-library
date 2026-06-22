import { useCallback, useState } from 'react';
import { api } from '@/services/api';
import type { AppDataDiagnostics } from '@/types/archive';
import { errorMessage } from '@/utils/errorMessage';
import { formatBytes } from './MaintenancePageParts';

type TaskMessage = { text: string; taskId?: string | null };

type UseMaintenanceDataActionsOptions = {
  setError: (message: string | null) => void;
  setMessage: (message: TaskMessage | null) => void;
};

export function useMaintenanceDataActions({ setError, setMessage }: UseMaintenanceDataActionsOptions) {
  const [diagnostics, setDiagnostics] = useState<AppDataDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [diagnosticExportLoading, setDiagnosticExportLoading] = useState(false);
  const [diagnosticExportPath, setDiagnosticExportPath] = useState<string | null>(null);

  const loadDiagnostics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDiagnostics(await api.getAppDataDiagnostics());
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [setError]);

  const cleanupDatabaseBackups = useCallback(async () => {
    if (!window.confirm('按安全规则清理旧数据库备份？会保留最近 10 个和 30 天内备份，不会删除当前 mikavn.db。')) return;
    setCleanupLoading(true);
    setError(null);
    setMessage(null);
    try {
      const report = await api.cleanupOldDatabaseBackups({ retainCount: 10, retainDays: 30 });
      setMessage({ text: report.removedFiles > 0 ? `已清理 ${report.removedFiles} 个旧数据库备份，释放 ${formatBytes(report.removedBytes)}。` : '没有需要清理的旧数据库备份。' });
      await loadDiagnostics();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setCleanupLoading(false);
    }
  }, [loadDiagnostics, setError, setMessage]);

  const exportDiagnosticPackage = useCallback(async () => {
    setDiagnosticExportLoading(true);
    setError(null);
    setMessage(null);
    setDiagnosticExportPath(null);
    try {
      const report = await api.exportDiagnosticPackage();
      setDiagnosticExportPath(report.path);
      setMessage({ text: `诊断包已导出：${report.fileName}（${formatBytes(report.sizeBytes)}）。包含自检摘要和脱敏日志预览，不包含完整数据库、图片缓存或存档文件。` });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setDiagnosticExportLoading(false);
    }
  }, [setError, setMessage]);

  const revealPath = useCallback(async (path: string) => {
    setError(null);
    try {
      await api.revealPath(path);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }, [setError]);

  const revealDiagnosticExportPath = useCallback(async () => {
    if (!diagnosticExportPath) return;
    setError(null);
    try {
      await api.revealPath(diagnosticExportPath);
      setMessage({ text: '已打开诊断包位置。' });
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }, [diagnosticExportPath, setError, setMessage]);

  const copyDiagnosticExportPath = useCallback(async () => {
    if (!diagnosticExportPath) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(diagnosticExportPath);
      setMessage({ text: '已复制诊断包路径。' });
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }, [diagnosticExportPath, setError, setMessage]);

  const copyPath = useCallback(async (label: string, path: string) => {
    setError(null);
    try {
      await navigator.clipboard.writeText(path);
      setMessage({ text: `已复制${label}路径。` });
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }, [setError, setMessage]);

  return {
    cleanupDatabaseBackups,
    cleanupLoading,
    copyPath,
    copyDiagnosticExportPath,
    diagnostics,
    diagnosticExportLoading,
    diagnosticExportPath,
    exportDiagnosticPackage,
    loadDiagnostics,
    loading,
    revealDiagnosticExportPath,
    revealPath,
  };
}
