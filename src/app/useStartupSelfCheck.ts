import { useCallback, useEffect, useState } from 'react';
import { api } from '@/services/api';
import { errorMessage } from '@/utils/errorMessage';
import { getStartupAppDataDiagnostics } from './startupDiagnostics';

export function useStartupSelfCheck() {
  const [startupSelfCheckWarnings, setStartupSelfCheckWarnings] = useState<string[]>([]);
  const [startupSelfCheckError, setStartupSelfCheckError] = useState<string | null>(null);
  const [startupSelfCheckDismissed, setStartupSelfCheckDismissed] = useState(false);
  const [startupSelfCheckDiagnosticExportLoading, setStartupSelfCheckDiagnosticExportLoading] = useState(false);
  const [startupSelfCheckDiagnosticExportMessage, setStartupSelfCheckDiagnosticExportMessage] = useState<string | null>(null);
  const [startupSelfCheckDiagnosticExportPath, setStartupSelfCheckDiagnosticExportPath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getStartupAppDataDiagnostics()
      .then((diagnostics) => {
        if (cancelled) return;
        const warnings = [...diagnostics.warnings];
        if (!diagnostics.database.quickCheckOk) {
          warnings.unshift(`数据库 quick_check 异常：${diagnostics.database.quickCheck || 'unknown'}`);
        }
        setStartupSelfCheckWarnings([...new Set(warnings)]);
        setStartupSelfCheckError(null);
      })
      .catch((reason) => {
        if (cancelled) return;
        setStartupSelfCheckError(`启动自检失败：${errorMessage(reason)}`);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const exportStartupSelfCheckDiagnosticPackage = useCallback(async () => {
    setStartupSelfCheckDiagnosticExportLoading(true);
    setStartupSelfCheckDiagnosticExportMessage(null);
    setStartupSelfCheckDiagnosticExportPath(null);
    try {
      const report = await api.exportDiagnosticPackage();
      setStartupSelfCheckDiagnosticExportPath(report.path);
      setStartupSelfCheckDiagnosticExportMessage(`诊断包已导出：${report.fileName}。不包含完整数据库、图片缓存或存档文件。`);
    } catch (reason) {
      setStartupSelfCheckDiagnosticExportMessage(`诊断包导出失败：${errorMessage(reason)}`);
    } finally {
      setStartupSelfCheckDiagnosticExportLoading(false);
    }
  }, []);

  const revealStartupSelfCheckDiagnosticExportPath = useCallback(async () => {
    if (!startupSelfCheckDiagnosticExportPath) return;
    try {
      await api.revealPath(startupSelfCheckDiagnosticExportPath);
    } catch (reason) {
      setStartupSelfCheckDiagnosticExportMessage(`打开诊断包位置失败：${errorMessage(reason)}`);
    }
  }, [startupSelfCheckDiagnosticExportPath]);

  return {
    dismissStartupSelfCheck: () => setStartupSelfCheckDismissed(true),
    exportStartupSelfCheckDiagnosticPackage,
    revealStartupSelfCheckDiagnosticExportPath,
    startupSelfCheckDiagnosticExportLoading,
    startupSelfCheckDiagnosticExportMessage,
    startupSelfCheckDiagnosticExportPath,
    startupSelfCheckDismissed,
    startupSelfCheckError,
    startupSelfCheckWarnings,
  };
}
