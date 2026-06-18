import type { ImportCandidate, ImportScanReport, ImportScanReportItem, ScanCandidate } from '@/types/game';
import type { ScanTaskStatus } from '@/types/task';

export type ConflictAction = 'skip' | 'merge' | 'replace' | 'duplicate';

export type ScannerCandidateSummary = {
  candidateCount: number;
  selectedCount: number;
  conflictCount: number;
};

export function buildImportCandidates(candidates: ScanCandidate[], selectedIds: string[], conflictActions: Record<string, ConflictAction>): ImportCandidate[] {
  return candidates
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
}

export function deriveScannerCandidateSummary(candidates: ScanCandidate[], selectedIds: string[]): ScannerCandidateSummary {
  return {
    candidateCount: candidates.length,
    selectedCount: selectedIds.length,
    conflictCount: candidates.filter((candidate) => candidate.conflict).length,
  };
}

export function isScanningTaskStatus(scanStatus: Pick<ScanTaskStatus, 'task'> | null | undefined) {
  return scanStatus?.task.status === 'pending' || scanStatus?.task.status === 'running';
}

export function selectIdsForConflictAction(selectedIds: string[], id: string, action: ConflictAction) {
  if (action === 'skip' || selectedIds.includes(id)) return selectedIds;
  return [...selectedIds, id];
}

export function filterImportReportItems(report: Pick<ImportScanReport, 'items'>, filters: { actionFilter: string; query: string }) {
  return report.items.filter((item) => (filters.actionFilter === 'all' || item.action === filters.actionFilter) && matchesImportReportQuery(item, filters.query));
}

export function shouldResetImportReportFilters(actionFilter: string, query: string) {
  return actionFilter !== 'all' || Boolean(query.trim());
}

export function matchesImportReportQuery(item: ImportScanReportItem, query: string) {
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

export function defaultSelectedIds(candidates: ScanCandidate[]) {
  return candidates.filter((candidate) => !candidate.conflict).map((candidate) => candidate.id);
}

export function defaultConflictActions(candidates: ScanCandidate[]) {
  return Object.fromEntries(candidates.filter((candidate) => candidate.conflict).map((candidate) => [candidate.id, 'skip' as ConflictAction]));
}

export function scanMessage(candidates: ScanCandidate[]) {
  const conflicts = candidates.filter((candidate) => candidate.conflict).length;
  return conflicts > 0
    ? `发现 ${candidates.length} 个候选游戏，其中 ${conflicts} 个可能已存在，冲突项已默认设为跳过。`
    : `发现 ${candidates.length} 个候选游戏。`;
}

export function importReportMessage(report: ImportScanReport) {
  return `导入处理完成：新增 ${report.added}、合并 ${report.merged}、替换 ${report.replaced}、副本 ${report.duplicated}、跳过 ${report.skipped}。可以立即批量匹配元数据。`;
}

export function importActionLabel(action: ImportScanReportItem['action']) {
  switch (action) {
    case 'add': return '新增';
    case 'merge': return '合并';
    case 'replace': return '替换';
    case 'duplicate': return '副本';
    case 'skip': return '跳过';
    default: return action;
  }
}

export function importActionHint(action: ImportScanReportItem['action']) {
  switch (action) {
    case 'add': return '下一步：建议继续批量匹配元数据，并检查封面与外部 ID。';
    case 'merge': return '下一步：已更新现有记录路径、启动程序与别名，建议打开详情页检查路径健康。';
    case 'replace': return '下一步：已覆盖数据库记录字段，建议核对标题、启动程序和别名是否符合预期。';
    case 'duplicate': return '下一步：已保留为独立记录，建议之后在维护页检查是否需要合并重复项。';
    case 'skip': return '下一步：未写入数据库；如需导入，请重新扫描后选择合并、替换或副本导入。';
    default: return '下一步：查看处理消息和冲突原因，确认是否需要手动修正。';
  }
}

export function importActionClass(action: ImportScanReportItem['action']) {
  if (action === 'add' || action === 'duplicate') return 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100';
  if (action === 'merge') return 'border-sky-300/25 bg-sky-300/10 text-sky-100';
  if (action === 'replace') return 'border-amber-300/25 bg-amber-300/10 text-amber-100';
  if (action === 'skip') return 'border-white/10 bg-white/[0.045] text-slate-300';
  return 'border-white/10 bg-white/[0.045] text-slate-300';
}

export function formatCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}
