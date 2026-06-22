import { useState } from 'react';
import { api } from '@/services/api';
import { errorMessage } from '@/utils/errorMessage';

export function useDashboardDiagnosticExport() {
  const [diagnosticExportLoading, setDiagnosticExportLoading] = useState(false);
  const [diagnosticExportMessage, setDiagnosticExportMessage] = useState<string | null>(null);
  const [diagnosticExportPath, setDiagnosticExportPath] = useState<string | null>(null);

  const exportDiagnosticPackage = async () => {
    setDiagnosticExportLoading(true);
    setDiagnosticExportMessage(null);
    setDiagnosticExportPath(null);
    try {
      const report = await api.exportDiagnosticPackage();
      setDiagnosticExportPath(report.path);
      setDiagnosticExportMessage(`诊断包已导出：${report.fileName}。不包含完整数据库、图片缓存或存档文件。`);
    } catch (reason) {
      setDiagnosticExportMessage(`诊断包导出失败：${errorMessage(reason)}`);
    } finally {
      setDiagnosticExportLoading(false);
    }
  };

  const revealDiagnosticExportPath = async () => {
    if (!diagnosticExportPath) return;
    try {
      await api.revealPath(diagnosticExportPath);
    } catch (reason) {
      setDiagnosticExportMessage(`打开诊断包位置失败：${errorMessage(reason)}`);
    }
  };

  const copyDashboardDiagnosticExportPath = async () => {
    if (!diagnosticExportPath) return;
    try {
      await navigator.clipboard.writeText(diagnosticExportPath);
      setDiagnosticExportMessage('诊断包路径已复制。');
    } catch (reason) {
      setDiagnosticExportMessage(`复制诊断包路径失败：${errorMessage(reason)}`);
    }
  };

  return {
    copyDashboardDiagnosticExportPath,
    diagnosticExportLoading,
    diagnosticExportMessage,
    diagnosticExportPath,
    exportDiagnosticPackage,
    revealDiagnosticExportPath,
  };
}
