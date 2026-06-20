import { useCallback, useState } from 'react';
import { api } from '@/services/api';
import type { AppDataDiagnostics } from '@/types/archive';
import type { AssetCacheCleanupResult } from '@/types/game';
import { errorMessage } from '@/utils/errorMessage';
import { formatBytes, formatCount } from './MaintenancePageParts';

type TaskMessage = { text: string; taskId?: string | null };

type UseMaintenanceDataActionsOptions = {
  setError: (message: string | null) => void;
  setMessage: (message: TaskMessage | null) => void;
};

export function useMaintenanceDataActions({ setError, setMessage }: UseMaintenanceDataActionsOptions) {
  const [diagnostics, setDiagnostics] = useState<AppDataDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [assetCleanupLoading, setAssetCleanupLoading] = useState(false);
  const [diagnosticExportLoading, setDiagnosticExportLoading] = useState(false);
  const [assetCleanupPreview, setAssetCleanupPreview] = useState<AssetCacheCleanupResult | null>(null);

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

  const previewAssetCacheCleanup = useCallback(async () => {
    setAssetCleanupLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.previewAssetCacheCleanup();
      setAssetCleanupPreview(result);
      setMessage({ text: result.removedFiles > 0 ? `图片缓存预览完成：可清理 ${formatCount(result.removedFiles)} 个文件，预计释放 ${formatBytes(result.removedBytes)}。` : '图片缓存预览完成，没有发现可清理文件。' });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setAssetCleanupLoading(false);
    }
  }, [setError, setMessage]);

  const cleanupAssetCache = useCallback(async () => {
    setError(null);
    setMessage(null);
    let preview = assetCleanupPreview;
    if (!preview) {
      setAssetCleanupLoading(true);
      try {
        preview = await api.previewAssetCacheCleanup();
        setAssetCleanupPreview(preview);
      } catch (reason) {
        setError(errorMessage(reason));
        setAssetCleanupLoading(false);
        return;
      }
      setAssetCleanupLoading(false);
    }

    if (preview.removedFiles === 0) {
      setMessage({ text: '没有需要清理的图片缓存文件。' });
      return;
    }
    if (!window.confirm(`清理 ${formatCount(preview.removedFiles)} 个未引用图片缓存文件，预计释放 ${formatBytes(preview.removedBytes)}？`)) return;

    setAssetCleanupLoading(true);
    try {
      const result = await api.cleanupAssetCache();
      setMessage({ text: result.removedFiles > 0 ? `已清理 ${formatCount(result.removedFiles)} 个图片缓存文件，释放 ${formatBytes(result.removedBytes)}。` : '没有需要清理的图片缓存文件。' });
      setAssetCleanupPreview(await api.previewAssetCacheCleanup());
      await loadDiagnostics();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setAssetCleanupLoading(false);
    }
  }, [assetCleanupPreview, loadDiagnostics, setError, setMessage]);

  const exportDiagnosticPackage = useCallback(async () => {
    setDiagnosticExportLoading(true);
    setError(null);
    setMessage(null);
    try {
      const report = await api.exportDiagnosticPackage();
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
    assetCleanupLoading,
    assetCleanupPreview,
    cleanupAssetCache,
    cleanupDatabaseBackups,
    cleanupLoading,
    copyPath,
    diagnostics,
    diagnosticExportLoading,
    exportDiagnosticPackage,
    loadDiagnostics,
    loading,
    previewAssetCacheCleanup,
    revealPath,
  };
}
