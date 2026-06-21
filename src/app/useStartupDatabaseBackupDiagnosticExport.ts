import { useCallback, useState } from 'react';
import { api } from '@/services/api';
import { errorMessage } from '@/utils/errorMessage';

export function useStartupDatabaseBackupDiagnosticExport() {
  const [startupDatabaseBackupDiagnosticExportLoading, setStartupDatabaseBackupDiagnosticExportLoading] = useState(false);
  const [startupDatabaseBackupDiagnosticExportMessage, setStartupDatabaseBackupDiagnosticExportMessage] = useState<string | null>(null);
  const [startupDatabaseBackupDiagnosticExportPath, setStartupDatabaseBackupDiagnosticExportPath] = useState<string | null>(null);

  const exportStartupDatabaseBackupDiagnosticPackage = useCallback(async () => {
    setStartupDatabaseBackupDiagnosticExportLoading(true);
    setStartupDatabaseBackupDiagnosticExportMessage(null);
    setStartupDatabaseBackupDiagnosticExportPath(null);
    try {
      const report = await api.exportDiagnosticPackage();
      setStartupDatabaseBackupDiagnosticExportPath(report.path);
      setStartupDatabaseBackupDiagnosticExportMessage(`诊断包已导出：${report.fileName}。不包含完整数据库、图片缓存或存档文件。`);
    } catch (reason) {
      setStartupDatabaseBackupDiagnosticExportMessage(`诊断包导出失败：${errorMessage(reason)}`);
    } finally {
      setStartupDatabaseBackupDiagnosticExportLoading(false);
    }
  }, []);

  const revealStartupDatabaseBackupDiagnosticExportPath = useCallback(async () => {
    if (!startupDatabaseBackupDiagnosticExportPath) return;
    try {
      await api.revealPath(startupDatabaseBackupDiagnosticExportPath);
    } catch (reason) {
      setStartupDatabaseBackupDiagnosticExportMessage(`打开诊断包位置失败：${errorMessage(reason)}`);
    }
  }, [startupDatabaseBackupDiagnosticExportPath]);

  return {
    exportStartupDatabaseBackupDiagnosticPackage,
    revealStartupDatabaseBackupDiagnosticExportPath,
    startupDatabaseBackupDiagnosticExportLoading,
    startupDatabaseBackupDiagnosticExportMessage,
    startupDatabaseBackupDiagnosticExportPath,
  };
}
