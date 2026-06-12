import { CheckCircle2, Copy, DatabaseZap, FolderPlus, PlayCircle, Search, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState, Notice } from '@/components/ui/notice';
import { MetricTile, PageFrame, PageHeader, PageShell, Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import { TaskNotice } from '@/components/ui/task-notice';
import { api } from '@/services/api';
import { chooseDirectory } from '@/services/dialog';
import type { ImportCandidate, ImportScanReport, ImportScanReportItem, ScanCandidate } from '@/types/game';
import type { BatchMatchStatus } from '@/types/metadata';
import type { ScanTaskStatus } from '@/types/task';
import { errorMessage } from '@/utils/errorMessage';

type ConflictAction = 'skip' | 'merge' | 'replace' | 'duplicate';
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

  const scanning = scanStatus?.task.status === 'pending' || scanStatus?.task.status === 'running';

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
      const payload: ImportCandidate[] = candidates
        .filter((candidate) => selectedIds.includes(candidate.id))
        .map((candidate) => ({
          title: candidate.suggestedTitle,
          installPath: candidate.installPath,
          executablePath: candidate.selectedExecutable ?? candidate.executables[0]?.path,
          aliases: candidate.aliases,
          conflictAction: candidate.conflict ? conflictActions[candidate.id] ?? 'skip' : 'duplicate',
          conflictGameId: candidate.conflict?.gameId ?? null,
          allowDuplicate: candidate.conflict ? conflictActions[candidate.id] === 'duplicate' : false,
        }));
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
      setSelectedIds((current) => current.includes(id) ? current : [...current, id]);
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

  const copyScanPath = async () => {
    const clean = path.trim();
    if (!clean) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(clean);
      setMessage({ text: '已复制扫描目录路径。' });
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  const copyCandidateInstallPath = async (installPath: string) => {
    const clean = installPath.trim();
    if (!clean) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(clean);
      setMessage({ text: '已复制候选安装目录路径。' });
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  const copyCandidateExecutablePath = async (executablePath: string) => {
    const clean = executablePath.trim();
    if (!clean) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(clean);
      setMessage({ text: '已复制候选启动程序路径。' });
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  const copyAuditInstallPath = async (installPath: string) => {
    const clean = installPath.trim();
    if (!clean) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(clean);
      setMessage({ text: '已复制审计安装目录路径。' });
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  return (
    <PageShell>
      <PageFrame>
        <PageHeader title="扫描入库" description="添加目录、扫描子文件夹、识别 exe、确认后写入数据库。" />
        {(message || error) && (
          <div className="space-y-2">
            {message && <TaskNotice message={message.text} taskId={message.taskId} onOpenTask={onOpenTask} />}
            {error && <Notice tone="error">{error}</Notice>}
          </div>
        )}

        <div className="grid min-h-[calc(100vh-9rem)] gap-4 xl:grid-cols-[0.86fr_1.14fr]">
          <div className="space-y-4">
            <Panel>
              <PanelHeader title="扫描目录" description="选择一个游戏库目录，扫描结果会先进入候选列表。" icon={<Search className="h-4 w-4" />} />
              <PanelContent className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                  <label className="space-y-1.5">
                    <Label>扫描目录</Label>
                    <Input placeholder="例如 D:\\Games\\VisualNovel" value={path} onChange={(event) => setPath(event.target.value)} />
                  </label>
                  <div className="flex items-end gap-2">
                    <Button disabled={!path.trim()} variant="ghost" onClick={() => void copyScanPath()}><Copy className="h-4 w-4" />复制扫描目录</Button>
                    <Button variant="secondary" onClick={pickDirectory}><FolderPlus className="h-4 w-4" />选择目录</Button>
                    <Button disabled={!path.trim() || loading || scanning} onClick={scan}><Search className="h-4 w-4" />开始扫描</Button>
                    {scanning && <Button variant="outline" onClick={cancelScan}><XCircle className="h-4 w-4" />取消</Button>}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <Checkbox checked={recursive} onChange={(event) => setRecursive(event.target.checked)} />
                  扫描多级文件夹
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <MetricTile label="候选" value={candidates.length} />
                  <MetricTile label="已选择" value={selectedIds.length} />
                  <MetricTile label="冲突" value={candidates.filter((candidate) => candidate.conflict).length} />
                </div>
                <div className="rounded-lg border border-white/10 bg-black/[0.10] p-3 text-xs leading-6 text-slate-400">
                  冲突候选默认跳过。需要处理时可逐条选择“合并”“替换数据库记录”或“作为副本导入”。这些操作只改数据库记录，不移动或删除真实文件。
                </div>
                {scanStatus && (
                  <div className="rounded-lg border border-white/10 bg-black/[0.10] p-3">
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                      <span>{scanStatus.task.message || '扫描任务'}</span>
                      <Badge>{Math.round(scanStatus.task.progress * 100)}%</Badge>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/20">
                      <div className="h-full rounded-full bg-[rgb(var(--accent-rgb))]" style={{ width: `${Math.round(scanStatus.task.progress * 100)}%` }} />
                    </div>
                  </div>
                )}
              </PanelContent>
            </Panel>

            <Panel>
              <PanelHeader title="扫描后匹配" icon={<DatabaseZap className="h-4 w-4" />} />
              <PanelContent className="space-y-3 text-sm leading-6 text-slate-400">
                <p>导入后，可立即对新条目执行 VNDB / DLsite / FANZA 自动匹配。候选结果会显示置信度、来源和失败原因，再由用户确认写入。</p>
                <Button disabled={importedIds.length === 0 || loading || scanning} variant="secondary" onClick={matchImported}><DatabaseZap className="h-4 w-4" />匹配刚导入的 {importedIds.length} 个条目</Button>
                {matchStatus && (
                  <div className="rounded-lg border border-white/10 bg-black/[0.12] p-3">
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <Badge>状态 {matchStatus.job.status}</Badge>
                      <Badge>{matchStatus.job.completed}/{matchStatus.job.total}</Badge>
                    </div>
                    <div className="mt-2 space-y-1 text-xs">
                      {matchStatus.results.map((result) => (
                        <div className="flex items-center justify-between gap-3" key={result.id}>
                          <span className="truncate text-slate-300">{result.originalTitle}</span>
                          <span className="shrink-0 text-slate-500">{result.selectedProvider ? `${result.selectedProvider} ${result.selectedId}` : result.reason || result.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {importReport && <ImportReportPanel filter={reportActionFilter} onCopyInstallPath={copyAuditInstallPath} onFilterChange={setReportActionFilter} report={importReport} />}
              </PanelContent>
            </Panel>
          </div>

          <Panel className="min-h-0">
            <PanelHeader
              title="候选游戏"
              description="导入只写数据库记录，不移动或删除真实文件。"
              actions={<Button disabled={selectedIds.length === 0 || loading || scanning} onClick={importSelected}><CheckCircle2 className="h-4 w-4" />导入选中</Button>}
            />
            <PanelContent className="min-h-0">
              {candidates.length === 0 ? (
                <EmptyState>
                  <PlayCircle className="mx-auto h-8 w-8 text-slate-600" />
                  <p className="mt-3 text-sm text-slate-500">输入目录并开始扫描后，这里会展示候选标题、安装目录和可选启动程序。</p>
                </EmptyState>
              ) : (
                <div className="max-h-[calc(100vh-13rem)] space-y-2 overflow-auto pr-1">
                  {candidates.map((candidate) => (
                    <label className="block" key={candidate.id}>
                      <SoftRow className="flex gap-3">
                        <Checkbox checked={selectedIds.includes(candidate.id)} className="mt-1" onChange={() => toggle(candidate.id)} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="truncate text-sm font-medium text-slate-100">{candidate.suggestedTitle}</div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              {candidate.conflict && <Badge className="border-amber-300/25 bg-amber-300/12 text-amber-100">冲突</Badge>}
                              <Badge>{candidate.executables.length} exe</Badge>
                            </div>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="min-w-0 break-all font-mono text-xs text-slate-500">{candidate.installPath}</span>
                            <Button
                              aria-label="复制候选安装目录"
                              size="sm"
                              variant="ghost"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void copyCandidateInstallPath(candidate.installPath);
                              }}
                            >
                              <Copy className="h-4 w-4" />复制
                            </Button>
                          </div>
                          {candidate.conflict && <div className="mt-1 text-xs text-amber-100">{candidate.conflict.reason}：{candidate.conflict.title}</div>}
                          {candidate.conflict && (
                            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-200/10 bg-amber-200/[0.04] p-2">
                              <span className="text-xs text-slate-400">处理方式</span>
                              <Select
                                className="h-8 w-40"
                                value={conflictActions[candidate.id] ?? 'skip'}
                                onChange={(event) => updateConflictAction(candidate.id, event.target.value as ConflictAction)}
                              >
                                <option value="skip">跳过</option>
                                <option value="merge">合并到已有记录</option>
                                <option value="replace">替换数据库记录</option>
                                <option value="duplicate">作为副本导入</option>
                              </Select>
                              {conflictActions[candidate.id] === 'merge' && <span className="text-xs text-slate-500">将更新 {candidate.conflict.title} 的路径、启动程序与别名</span>}
                              {conflictActions[candidate.id] === 'replace' && <span className="text-xs text-amber-100">高风险：覆盖已有记录的标题、路径、启动程序与别名</span>}
                              {conflictActions[candidate.id] === 'duplicate' && <span className="text-xs text-slate-500">会新建一条独立记录</span>}
                            </div>
                          )}
                          <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-slate-500">
                            {candidate.executables.map((exe) => (
                              <span className="inline-flex items-center gap-1" key={exe.path}>
                                {exe.name}
                                <Button
                                  aria-label="复制候选启动程序"
                                  size="sm"
                                  variant="ghost"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    void copyCandidateExecutablePath(exe.path);
                                  }}
                                >
                                  <Copy className="h-4 w-4" />复制
                                </Button>
                              </span>
                            ))}
                          </div>
                        </div>
                      </SoftRow>
                    </label>
                  ))}
                </div>
              )}
            </PanelContent>
          </Panel>
        </div>
      </PageFrame>
    </PageShell>
  );
}

function ImportReportPanel({ filter, onCopyInstallPath, onFilterChange, report }: { filter: string; onCopyInstallPath: (installPath: string) => void; onFilterChange: (value: string) => void; report: ImportScanReport }) {
  const [query, setQuery] = useState('');
  const items = report.items.filter((item) => (filter === 'all' || item.action === filter) && matchesImportReportQuery(item, query));
  const resetFilters = () => {
    onFilterChange('all');
    setQuery('');
  };
  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-black/[0.12] p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-100">导入审计</div>
          <div className="mt-1 text-xs text-slate-500">请求 {formatCount(report.requested)} 个，写入 {formatCount(report.importedCount)} 个，当前显示 {formatCount(items.length)} / {formatCount(report.items.length)} 条处理明细。</div>
        </div>
        <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[minmax(12rem,16rem)_9rem_auto]">
          <Input aria-label="导入审计搜索" className="h-8" placeholder="标题 / 路径 / 原因" value={query} onChange={(event) => setQuery(event.target.value)} />
          <Select aria-label="导入审计动作筛选" className="h-8" value={filter} onChange={(event) => onFilterChange(event.target.value)}>
            <option value="all">全部</option>
            <option value="add">新增</option>
            <option value="merge">合并</option>
            <option value="replace">替换</option>
            <option value="duplicate">副本</option>
            <option value="skip">跳过</option>
          </Select>
          <Button className="h-8 px-2" disabled={filter === 'all' && !query.trim()} size="sm" variant="outline" onClick={resetFilters}>重置审计</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-6">
        <MetricTile label="写入" value={report.importedCount} />
        <MetricTile label="新增" value={report.added} />
        <MetricTile label="合并" value={report.merged} />
        <MetricTile label="替换" value={report.replaced} />
        <MetricTile label="副本" value={report.duplicated} />
        <MetricTile label="跳过" value={report.skipped} />
      </div>
      <div className="max-h-80 space-y-1.5 overflow-auto pr-1">
        {items.length === 0 ? (
          <div className="rounded-md border border-white/10 bg-black/[0.10] px-3 py-3 text-xs text-slate-500">当前筛选没有明细。</div>
        ) : items.map((item) => <ImportReportRow item={item} key={`${item.action}-${item.installPath}-${item.candidateTitle}`} onCopyInstallPath={onCopyInstallPath} />)}
      </div>
    </div>
  );
}

function ImportReportRow({ item, onCopyInstallPath }: { item: ImportScanReportItem; onCopyInstallPath: (installPath: string) => void }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/[0.10] px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-medium text-slate-200" title={item.candidateTitle}>{item.candidateTitle}</span>
        <Badge className={importActionClass(item.action)}>{importActionLabel(item.action)}</Badge>
      </div>
      <div className="mt-1 text-slate-500">{item.message}{item.targetTitle ? `：${item.targetTitle}` : ''}</div>
      {item.conflictReason && <div className="mt-1 text-amber-100">冲突原因：{item.conflictReason}</div>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="min-w-0 break-all font-mono text-[11px] text-slate-600">{item.installPath}</span>
        <Button aria-label="复制审计安装目录" size="sm" variant="ghost" onClick={() => onCopyInstallPath(item.installPath)}><Copy className="h-4 w-4" />复制</Button>
      </div>
      {item.gameId && <div className="mt-1 break-all font-mono text-[11px] text-slate-600">记录 ID：{item.gameId}</div>}
    </div>
  );
}

function matchesImportReportQuery(item: ImportScanReportItem, query: string) {
  const value = query.trim().toLocaleLowerCase();
  if (!value) return true;
  return [
    item.action,
    importActionLabel(item.action),
    item.candidateTitle,
    item.installPath,
    item.message,
    item.targetTitle,
    item.conflictReason,
    item.gameId,
  ].some((field) => (field ?? '').toLocaleLowerCase().includes(value));
}

function defaultSelectedIds(candidates: ScanCandidate[]) {
  return candidates.filter((candidate) => !candidate.conflict).map((candidate) => candidate.id);
}

function defaultConflictActions(candidates: ScanCandidate[]) {
  return Object.fromEntries(candidates.filter((candidate) => candidate.conflict).map((candidate) => [candidate.id, 'skip' as ConflictAction]));
}

function scanMessage(candidates: ScanCandidate[]) {
  const conflicts = candidates.filter((candidate) => candidate.conflict).length;
  return conflicts > 0 ? `发现 ${candidates.length} 个候选游戏，其中 ${conflicts} 个可能已存在，冲突项已默认设为跳过。` : `发现 ${candidates.length} 个候选游戏。`;
}

function importReportMessage(report: ImportScanReport) {
  return `导入处理完成：新增 ${report.added}、合并 ${report.merged}、替换 ${report.replaced}、副本 ${report.duplicated}、跳过 ${report.skipped}。可以立即批量匹配元数据。`;
}

function importActionLabel(action: ImportScanReportItem['action']) {
  switch (action) {
    case 'add': return '新增';
    case 'merge': return '合并';
    case 'replace': return '替换';
    case 'duplicate': return '副本';
    case 'skip': return '跳过';
    default: return action;
  }
}

function importActionClass(action: ImportScanReportItem['action']) {
  if (action === 'add' || action === 'duplicate') return 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100';
  if (action === 'merge') return 'border-sky-300/25 bg-sky-300/10 text-sky-100';
  if (action === 'replace') return 'border-amber-300/25 bg-amber-300/10 text-amber-100';
  if (action === 'skip') return 'border-white/10 bg-white/[0.045] text-slate-300';
  return 'border-white/10 bg-white/[0.045] text-slate-300';
}

function formatCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}
