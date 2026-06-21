import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/services/api';
import { chooseDirectory } from '@/services/dialog';
import type { ImportScanReport, ScanCandidate } from '@/types/game';
import type { BatchMatchStatus } from '@/types/metadata';
import type { ScanTaskStatus } from '@/types/task';
import { errorMessage } from '@/utils/errorMessage';
import {
  buildImportCandidates,
  defaultConflictActions,
  defaultSelectedIds,
  deriveScannerCandidateSummary,
  importReportMessage,
  isScanningTaskStatus,
  scanMessage,
  selectIdsForConflictAction,
  type ConflictAction,
} from './scannerPageModel';

type TaskMessage = { text: string; taskId?: string | null };

export function useScannerPageActions() {
  const matchStatusRequestRef = useRef(0);
  const scanStatusRequestRef = useRef(0);
  const [path, setPath] = useState('');
  const [recursive, setRecursive] = useState(true);
  const [candidates, setCandidates] = useState<ScanCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<TaskMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importedIds, setImportedIds] = useState<string[]>([]);
  const [matchStatus, setMatchStatus] = useState<BatchMatchStatus | null>(null);
  const [scanStatus, setScanStatus] = useState<ScanTaskStatus | null>(null);
  const [conflictActions, setConflictActions] = useState<Record<string, ConflictAction>>({});
  const [importReport, setImportReport] = useState<ImportScanReport | null>(null);
  const [reportActionFilter, setReportActionFilter] = useState('all');

  const scanning = isScanningTaskStatus(scanStatus);
  const candidateSummary = useMemo(() => deriveScannerCandidateSummary(candidates, selectedIds), [candidates, selectedIds]);

  const applyCompletedScan = useCallback((status: ScanTaskStatus) => {
    setCandidates(status.candidates);
    setSelectedIds(defaultSelectedIds(status.candidates));
    setConflictActions(defaultConflictActions(status.candidates));
    setMessage({ text: scanMessage(status.candidates), taskId: status.task.id });
  }, []);

  useEffect(() => {
    if (!matchStatus || matchStatus.job.status !== 'running') return;
    const refreshMatchStatus = async () => {
      const requestId = ++matchStatusRequestRef.current;
      try {
        const status = await api.getBatchMatchStatus(matchStatus.job.id);
        if (requestId !== matchStatusRequestRef.current) return;
        setMatchStatus(status);
      } catch {
        // Keep polling on transient metadata status failures.
      }
    };
    const timer = window.setInterval(() => {
      void refreshMatchStatus();
    }, 1200);
    return () => {
      matchStatusRequestRef.current += 1;
      window.clearInterval(timer);
    };
  }, [matchStatus?.job.id, matchStatus?.job.status]);

  useEffect(() => {
    if (!scanStatus || !scanning) return;

    const refresh = async () => {
      const requestId = ++scanStatusRequestRef.current;
      try {
        const status = await api.getScanTaskStatus(scanStatus.task.id);
        if (requestId !== scanStatusRequestRef.current) return;
        setScanStatus(status);
        if (status.task.status === 'completed') {
          applyCompletedScan(status);
        } else if (status.task.status === 'failed') {
          setError(status.task.error || status.task.message || '扫描失败');
        } else if (status.task.status === 'cancelled') {
          setMessage({ text: '扫描已取消。', taskId: status.task.id });
        }
      } catch (reason) {
        if (requestId !== scanStatusRequestRef.current) return;
        setError(errorMessage(reason));
      }
    };

    const timer = window.setInterval(() => void refresh(), 900);
    void refresh();
    return () => {
      scanStatusRequestRef.current += 1;
      window.clearInterval(timer);
    };
  }, [applyCompletedScan, scanStatus?.task.id, scanning]);

  const scan = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    setScanStatus(null);
    setCandidates([]);
    setSelectedIds([]);
    setConflictActions({});
    setImportReport(null);
    setReportActionFilter('all');
    try {
      const task = await api.startScanTask(path, recursive);
      const status = await api.getScanTaskStatus(task.id);
      setScanStatus(status);
      if (status.task.status === 'completed') {
        applyCompletedScan(status);
      } else {
        setMessage({ text: '扫描任务已启动。', taskId: task.id });
      }
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [applyCompletedScan, path, recursive]);

  const cancelScan = useCallback(async () => {
    if (!scanStatus) return;
    setError(null);
    try {
      await api.cancelTask(scanStatus.task.id);
      setScanStatus(await api.getScanTaskStatus(scanStatus.task.id));
      setMessage({ text: '正在取消扫描任务。', taskId: scanStatus.task.id });
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }, [scanStatus]);

  const importSelected = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = buildImportCandidates(candidates, selectedIds, conflictActions);
      const report = await api.importScanCandidates(payload);
      setImportReport(report);
      setReportActionFilter('all');
      setImportedIds(report.imported.map((game) => game.id));
      setMatchStatus(null);
      setMessage({ text: importReportMessage(report) });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [candidates, conflictActions, selectedIds]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }, []);

  const updateConflictAction = useCallback((id: string, action: ConflictAction) => {
    setConflictActions((current) => ({ ...current, [id]: action }));
    if (action !== 'skip') {
      setSelectedIds((current) => selectIdsForConflictAction(current, id, action));
    }
  }, []);

  const matchImported = useCallback(async () => {
    if (importedIds.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const job = await api.batchMatchMetadata(importedIds);
      setMatchStatus(await api.getBatchMatchStatus(job.id));
      setMessage({ text: `已启动 ${importedIds.length} 个导入条目的元数据匹配。`, taskId: job.taskId });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [importedIds]);

  const pickDirectory = useCallback(async () => {
    const selected = await chooseDirectory(path);
    if (selected) setPath(selected);
  }, [path]);

  const copyText = useCallback(async (value: string, text: string) => {
    const clean = value.trim();
    if (!clean) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(clean);
      setMessage({ text });
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }, []);

  return {
    candidateSummary,
    candidates,
    cancelScan,
    conflictActions,
    copyAuditInstallPath: (installPath: string) => copyText(installPath, '已复制审计安装目录路径。'),
    copyCandidateExecutablePath: (executablePath: string) => copyText(executablePath, '已复制候选启动程序路径。'),
    copyCandidateInstallPath: (installPath: string) => copyText(installPath, '已复制候选安装目录路径。'),
    copyScanPath: () => copyText(path, '已复制扫描目录路径。'),
    error,
    importedIds,
    importReport,
    importSelected,
    loading,
    matchImported,
    matchStatus,
    message,
    path,
    pickDirectory,
    recursive,
    reportActionFilter,
    scan,
    scanning,
    scanStatus,
    selectedIds,
    setPath,
    setRecursive,
    setReportActionFilter,
    toggle,
    updateConflictAction,
  };
}
