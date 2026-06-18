import { useEffect, useState } from 'react';
import { PageFrame, PageHeader, PageShell } from '@/components/ui/page';
import { api } from '@/services/api';
import { chooseDirectory } from '@/services/dialog';
import type { ImportScanReport, ScanCandidate } from '@/types/game';
import type { BatchMatchStatus } from '@/types/metadata';
import type { ScanTaskStatus } from '@/types/task';
import { errorMessage } from '@/utils/errorMessage';
import { ScannerCandidatePanel } from './ScannerCandidatePanel';
import { ScannerSetupPanels } from './ScannerSetupPanels';
import { ScannerStatusNotices } from './ScannerStatusNotices';
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

export function ScannerPage({ onOpenTask }: { onOpenTask?: (taskId: string) => void }) {
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
  const candidateSummary = deriveScannerCandidateSummary(candidates, selectedIds);

  useEffect(() => {
    if (!matchStatus || matchStatus.job.status !== 'running') {
      return;
    }
    const timer = window.setInterval(() => {
      api.getBatchMatchStatus(matchStatus.job.id).then(setMatchStatus).catch(() => undefined);
    }, 1200);
    return () => window.clearInterval(timer);
  }, [matchStatus]);

  useEffect(() => {
    if (!scanStatus || !scanning) {
      return;
    }

    const refresh = async () => {
      try {
        const status = await api.getScanTaskStatus(scanStatus.task.id);
        setScanStatus(status);
        if (status.task.status === 'completed') {
          setCandidates(status.candidates);
          setSelectedIds(defaultSelectedIds(status.candidates));
          setConflictActions(defaultConflictActions(status.candidates));
          setMessage({ text: scanMessage(status.candidates), taskId: status.task.id });
        } else if (status.task.status === 'failed') {
          setError(status.task.error || status.task.message || '扫描失败');
        } else if (status.task.status === 'cancelled') {
          setMessage({ text: '扫描已取消。', taskId: status.task.id });
        }
      } catch (reason) {
        setError(errorMessage(reason));
      }
    };

    const timer = window.setInterval(() => void refresh(), 900);
    void refresh();
    return () => window.clearInterval(timer);
  }, [scanStatus?.task.id, scanning]);

  const scan = async () => {
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
        setCandidates(status.candidates);
        setSelectedIds(defaultSelectedIds(status.candidates));
        setConflictActions(defaultConflictActions(status.candidates));
        setMessage({ text: scanMessage(status.candidates), taskId: status.task.id });
      } else {
        setMessage({ text: '扫描任务已启动。', taskId: task.id });
      }
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  };

  const cancelScan = async () => {
    if (!scanStatus) return;
    setError(null);
    try {
      await api.cancelTask(scanStatus.task.id);
      setScanStatus(await api.getScanTaskStatus(scanStatus.task.id));
      setMessage({ text: '正在取消扫描任务。', taskId: scanStatus.task.id });
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  const importSelected = async () => {
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
  };

  const toggle = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const updateConflictAction = (id: string, action: ConflictAction) => {
    setConflictActions((current) => ({ ...current, [id]: action }));
    if (action !== 'skip') {
      setSelectedIds((current) => selectIdsForConflictAction(current, id, action));
    }
  };

  const matchImported = async () => {
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
  };

  const pickDirectory = async () => {
    const selected = await chooseDirectory(path);
    if (selected) {
      setPath(selected);
    }
  };

  const copyText = async (value: string, text: string) => {
    const clean = value.trim();
    if (!clean) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(clean);
      setMessage({ text });
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  const copyScanPath = () => copyText(path, '已复制扫描目录路径。');
  const copyCandidateInstallPath = (installPath: string) => copyText(installPath, '已复制候选安装目录路径。');
  const copyCandidateExecutablePath = (executablePath: string) => copyText(executablePath, '已复制候选启动程序路径。');
  const copyAuditInstallPath = (installPath: string) => copyText(installPath, '已复制审计安装目录路径。');

  return (
    <PageShell>
      <PageFrame>
        <PageHeader title="扫描入库" description="添加目录、扫描子文件夹、识别 exe、确认后写入数据库。" />
        <ScannerStatusNotices error={error} message={message} onOpenTask={onOpenTask} />

        <div className="grid min-h-[calc(100vh-9rem)] gap-4 xl:grid-cols-[0.86fr_1.14fr]">
          <ScannerSetupPanels
            candidateSummary={candidateSummary}
            importedIds={importedIds}
            importReport={importReport}
            loading={loading}
            matchStatus={matchStatus}
            path={path}
            recursive={recursive}
            reportActionFilter={reportActionFilter}
            scanning={scanning}
            scanStatus={scanStatus}
            onCancelScan={cancelScan}
            onCopyAuditInstallPath={copyAuditInstallPath}
            onCopyScanPath={copyScanPath}
            onMatchImported={matchImported}
            onPathChange={setPath}
            onPickDirectory={pickDirectory}
            onRecursiveChange={setRecursive}
            onReportActionFilterChange={setReportActionFilter}
            onScan={scan}
          />

          <ScannerCandidatePanel
            candidates={candidates}
            conflictActions={conflictActions}
            loading={loading}
            scanning={scanning}
            selectedIds={selectedIds}
            onCopyExecutablePath={copyCandidateExecutablePath}
            onCopyInstallPath={copyCandidateInstallPath}
            onImportSelected={importSelected}
            onToggleCandidate={toggle}
            onUpdateConflictAction={updateConflictAction}
          />
        </div>
      </PageFrame>
    </PageShell>
  );
}
