import { useMemo, useState } from 'react';
import { CheckCircle2, Copy, PlayCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/notice';
import { Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import type { ScanCandidate } from '@/types/game';
import {
  formatCount,
  getScannerCandidateRenderWindow,
  scannerCandidateInitialRenderCount,
  scannerCandidateRenderBatchSize,
  type ConflictAction,
} from './scannerPageModel';

type ScannerCandidatePanelProps = {
  candidates: ScanCandidate[];
  conflictActions: Record<string, ConflictAction>;
  loading: boolean;
  scanning: boolean;
  selectedIds: string[];
  onCopyExecutablePath: (executablePath: string) => void;
  onCopyInstallPath: (installPath: string) => void;
  onImportSelected: () => void;
  onToggleCandidate: (id: string) => void;
  onUpdateConflictAction: (id: string, action: ConflictAction) => void;
};

export function ScannerCandidatePanel({ candidates, conflictActions, loading, scanning, selectedIds, onCopyExecutablePath, onCopyInstallPath, onImportSelected, onToggleCandidate, onUpdateConflictAction }: ScannerCandidatePanelProps) {
  const [renderWindowState, setRenderWindowState] = useState({ candidates, visibleCount: scannerCandidateInitialRenderCount });
  const visibleCount = renderWindowState.candidates === candidates ? renderWindowState.visibleCount : scannerCandidateInitialRenderCount;
  const { visibleCandidates, renderedCount, totalCount, hasMore } = useMemo(() => getScannerCandidateRenderWindow(candidates, visibleCount), [candidates, visibleCount]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const loadMoreCandidates = () => {
    setRenderWindowState((current) => {
      const currentVisibleCount = current.candidates === candidates ? current.visibleCount : scannerCandidateInitialRenderCount;
      return {
        candidates,
        visibleCount: Math.min(candidates.length, currentVisibleCount + scannerCandidateRenderBatchSize),
      };
    });
  };

  return (
    <Panel className="min-h-0">
      <PanelHeader
        title="候选游戏"
        description="导入只写数据库记录，不移动或删除真实文件。"
        actions={<Button disabled={selectedIds.length === 0 || loading || scanning} onClick={onImportSelected}><CheckCircle2 className="h-4 w-4" />导入选中</Button>}
      />
      <PanelContent className="min-h-0">
        {candidates.length === 0 ? (
          <EmptyState>
            <PlayCircle className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-3 text-sm text-slate-500">输入目录并开始扫描后，这里会展示候选标题、安装目录和可选启动程序。</p>
          </EmptyState>
        ) : (
          <div className="max-h-[calc(100vh-13rem)] space-y-2 overflow-auto pr-1">
            {visibleCandidates.map((candidate) => (
              <ScannerCandidateRow
                candidate={candidate}
                checked={selectedIdSet.has(candidate.id)}
                conflictAction={conflictActions[candidate.id] ?? 'skip'}
                key={candidate.id}
                onCopyExecutablePath={onCopyExecutablePath}
                onCopyInstallPath={onCopyInstallPath}
                onToggle={() => onToggleCandidate(candidate.id)}
                onUpdateConflictAction={(action) => onUpdateConflictAction(candidate.id, action)}
              />
            ))}
            {hasMore && (
              <Button aria-label="加载更多扫描候选" className="w-full justify-center" size="sm" variant="outline" onClick={loadMoreCandidates}>
                加载更多 {formatCount(renderedCount)} / {formatCount(totalCount)}
              </Button>
            )}
          </div>
        )}
      </PanelContent>
    </Panel>
  );
}

function ScannerCandidateRow({ candidate, checked, conflictAction, onCopyExecutablePath, onCopyInstallPath, onToggle, onUpdateConflictAction }: { candidate: ScanCandidate; checked: boolean; conflictAction: ConflictAction; onCopyExecutablePath: (executablePath: string) => void; onCopyInstallPath: (installPath: string) => void; onToggle: () => void; onUpdateConflictAction: (action: ConflictAction) => void }) {
  return (
    <label className="block">
      <SoftRow className="flex gap-3">
        <Checkbox checked={checked} className="mt-1" onChange={onToggle} />
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
                onCopyInstallPath(candidate.installPath);
              }}
            >
              <Copy className="h-4 w-4" />复制
            </Button>
          </div>
          {candidate.conflict && <div className="mt-1 text-xs text-amber-100">{candidate.conflict.reason}：{candidate.conflict.title}</div>}
          {candidate.conflict && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-200/10 bg-amber-200/[0.04] p-2">
              <span className="text-xs text-slate-400">处理方式</span>
              <Select className="h-8 w-40" value={conflictAction} onChange={(event) => onUpdateConflictAction(event.target.value as ConflictAction)}>
                <option value="skip">跳过</option>
                <option value="merge">合并到已有记录</option>
                <option value="replace">替换数据库记录</option>
                <option value="duplicate">作为副本导入</option>
              </Select>
              {conflictAction === 'merge' && <span className="text-xs text-slate-500">将更新 {candidate.conflict.title} 的路径、启动程序与别名</span>}
              {conflictAction === 'replace' && <span className="text-xs text-amber-100">高风险：覆盖已有记录的标题、路径、启动程序与别名</span>}
              {conflictAction === 'duplicate' && <span className="text-xs text-slate-500">会新建一条独立记录</span>}
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
                    onCopyExecutablePath(exe.path);
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
  );
}
