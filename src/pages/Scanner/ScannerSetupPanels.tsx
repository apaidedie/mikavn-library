import { Copy, DatabaseZap, FolderPlus, Search, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MetricTile, Panel, PanelContent, PanelHeader } from '@/components/ui/page';
import type { ImportScanReport } from '@/types/game';
import type { BatchMatchStatus } from '@/types/metadata';
import type { ScanTaskStatus } from '@/types/task';
import { ImportReportPanel } from './ImportReportPanel';
import type { ScannerCandidateSummary } from './scannerPageModel';

type ScannerSetupPanelsProps = {
  candidateSummary: ScannerCandidateSummary;
  importReport: ImportScanReport | null;
  importedIds: string[];
  loading: boolean;
  matchStatus: BatchMatchStatus | null;
  path: string;
  recursive: boolean;
  reportActionFilter: string;
  scanStatus: ScanTaskStatus | null;
  scanning: boolean;
  onCancelScan: () => void;
  onCopyAuditInstallPath: (installPath: string) => void;
  onCopyScanPath: () => void;
  onMatchImported: () => void;
  onPathChange: (value: string) => void;
  onPickDirectory: () => void;
  onRecursiveChange: (value: boolean) => void;
  onReportActionFilterChange: (value: string) => void;
  onScan: () => void;
};

export function ScannerSetupPanels({ candidateSummary, importReport, importedIds, loading, matchStatus, path, recursive, reportActionFilter, scanStatus, scanning, onCancelScan, onCopyAuditInstallPath, onCopyScanPath, onMatchImported, onPathChange, onPickDirectory, onRecursiveChange, onReportActionFilterChange, onScan }: ScannerSetupPanelsProps) {
  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="扫描目录" description="选择一个游戏库目录，扫描结果会先进入候选列表。" icon={<Search className="h-4 w-4" />} />
        <PanelContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <label className="space-y-1.5">
              <Label>扫描目录</Label>
              <Input placeholder="例如 D:\\Games\\VisualNovel" value={path} onChange={(event) => onPathChange(event.target.value)} />
            </label>
            <div className="flex items-end gap-2">
              <Button disabled={!path.trim()} variant="ghost" onClick={() => void onCopyScanPath()}><Copy className="h-4 w-4" />复制扫描目录</Button>
              <Button variant="secondary" onClick={onPickDirectory}><FolderPlus className="h-4 w-4" />选择目录</Button>
              <Button disabled={!path.trim() || loading || scanning} onClick={onScan}><Search className="h-4 w-4" />开始扫描</Button>
              {scanning && <Button variant="outline" onClick={onCancelScan}><XCircle className="h-4 w-4" />取消</Button>}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <Checkbox checked={recursive} onChange={(event) => onRecursiveChange(event.target.checked)} />
            扫描多级文件夹
          </label>
          <div className="grid grid-cols-3 gap-3">
            <MetricTile label="候选" value={candidateSummary.candidateCount} />
            <MetricTile label="已选择" value={candidateSummary.selectedCount} />
            <MetricTile label="冲突" value={candidateSummary.conflictCount} />
          </div>
          <div className="rounded-lg border border-white/10 bg-black/[0.10] p-3 text-xs leading-6 text-slate-400">
            冲突候选默认跳过。需要处理时可逐条选择“合并”“替换数据库记录”或“作为副本导入”。这些操作只改数据库记录，不移动或删除真实文件。
          </div>
          {scanStatus && <ScanProgress status={scanStatus} />}
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader title="扫描后匹配" icon={<DatabaseZap className="h-4 w-4" />} />
        <PanelContent className="space-y-3 text-sm leading-6 text-slate-400">
          <p>导入后，可立即对新条目执行 VNDB / DLsite / FANZA 自动匹配。候选结果会显示置信度、来源和失败原因，再由用户确认写入。</p>
          <Button disabled={importedIds.length === 0 || loading || scanning} variant="secondary" onClick={onMatchImported}><DatabaseZap className="h-4 w-4" />匹配刚导入的 {importedIds.length} 个条目</Button>
          {matchStatus && <MatchStatusSummary status={matchStatus} />}
          {importReport && <ImportReportPanel filter={reportActionFilter} onCopyInstallPath={onCopyAuditInstallPath} onFilterChange={onReportActionFilterChange} report={importReport} />}
        </PanelContent>
      </Panel>
    </div>
  );
}

function ScanProgress({ status }: { status: ScanTaskStatus }) {
  const progress = Math.round(status.task.progress * 100);

  return (
    <div className="rounded-lg border border-white/10 bg-black/[0.10] p-3">
      <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>{status.task.message || '扫描任务'}</span>
        <Badge>{progress}%</Badge>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/20">
        <div className="h-full rounded-full bg-[rgb(var(--accent-rgb))]" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function MatchStatusSummary({ status }: { status: BatchMatchStatus }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/[0.12] p-3">
      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
        <Badge>状态 {status.job.status}</Badge>
        <Badge>{status.job.completed}/{status.job.total}</Badge>
      </div>
      <div className="mt-2 space-y-1 text-xs">
        {status.results.map((result) => (
          <div className="flex items-center justify-between gap-3" key={result.id}>
            <span className="truncate text-slate-300">{result.originalTitle}</span>
            <span className="shrink-0 text-slate-500">{result.selectedProvider ? `${result.selectedProvider} ${result.selectedId}` : result.reason || result.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
