import { ListChecks, RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import { ArtworkRepairTaskRow, filterArtworkRepairSummary, type ArtworkRepairTaskSummary } from './ArtworkRepairResultPanel';
import { formatCount } from './MaintenancePageParts';

export function MaintenanceArtworkHistoryPanel({
  actionBusyTaskId,
  history,
  loading,
  query,
  statusFilter,
  onLoadHistory,
  onOpenGame,
  onOpenTask,
  onQueryChange,
  onResetFilters,
  onRetryTask,
  onStatusFilterChange,
}: {
  actionBusyTaskId: string | null;
  history: ArtworkRepairTaskSummary[] | null;
  loading: boolean;
  query: string;
  statusFilter: string;
  onLoadHistory: () => void;
  onOpenGame?: (gameId: string) => void;
  onOpenTask?: (taskId?: string | null) => void;
  onQueryChange: (value: string) => void;
  onResetFilters: () => void;
  onRetryTask: (taskId: string) => void;
  onStatusFilterChange: (value: string) => void;
}) {
  const filteredHistory = useMemo(() => history?.map((summary) => filterArtworkRepairSummary(summary, query, statusFilter)).filter((summary) => summary.updated.length + summary.skipped.length + summary.failed.length > 0) ?? [], [history, query, statusFilter]);

  return (
    <Panel>
      <PanelHeader
        title="媒体补全结果"
        description="汇总最近媒体图片补全任务的成功、跳过和失败明细。"
        icon={<ListChecks className="h-4 w-4" />}
        actions={<Button disabled={loading} size="sm" variant="ghost" onClick={onLoadHistory}><RefreshCw className="h-4 w-4" />{loading ? '读取中' : '读取结果'}</Button>}
      />
      <PanelContent className="space-y-3">
        {history ? (
          history.length > 0 ? (
            <div className="space-y-3">
              <SoftRow className="grid gap-2 px-3 py-3 md:grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)_auto] md:items-end">
                <label className="min-w-0 text-xs text-slate-500">
                  搜索补全结果
                  <Input aria-label="媒体补全结果搜索" className="mt-1 w-full" placeholder="游戏 / ID / 字段 / 原因 / 来源" value={query} onChange={(event) => onQueryChange(event.target.value)} />
                </label>
                <label className="min-w-0 text-xs text-slate-500">
                  结果状态
                  <Select aria-label="媒体补全结果状态筛选" className="mt-1 w-full" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
                    <option value="all">全部结果</option>
                    <option value="updated">已补全</option>
                    <option value="skipped">跳过</option>
                    <option value="failed">失败</option>
                  </Select>
                </label>
                <Button className="h-9" disabled={!query.trim() && statusFilter === 'all'} size="sm" variant="outline" onClick={onResetFilters}>重置筛选</Button>
              </SoftRow>
              <div className="px-1 text-xs text-slate-500">当前显示 {formatCount(filteredHistory.reduce((count, summary) => count + summary.updated.length + summary.skipped.length + summary.failed.length, 0))} / {formatCount(history.reduce((count, summary) => count + summary.updated.length + summary.skipped.length + summary.failed.length, 0))} 条补图明细。</div>
              {filteredHistory.length > 0 ? filteredHistory.map((summary) => <ArtworkRepairTaskRow actionBusy={actionBusyTaskId === summary.task.id} key={summary.task.id} onOpenGame={onOpenGame} onOpenTask={onOpenTask} onRetryTask={onRetryTask} summary={summary} />) : <SoftRow className="px-3 py-3 text-sm text-slate-400">当前筛选没有匹配的媒体补全结果。</SoftRow>}
            </div>
          ) : (
            <SoftRow className="px-3 py-3 text-sm text-slate-400">还没有媒体图片补全任务记录。</SoftRow>
          )
        ) : (
          <SoftRow className="flex items-center justify-between gap-3 px-3 py-3">
            <div className="min-w-0 text-sm text-slate-400">读取后会解析最近 5 个媒体补全任务日志，展示成功、跳过和失败原因。</div>
            <Button disabled={loading} size="sm" variant="secondary" onClick={onLoadHistory}><ListChecks className="h-4 w-4" />读取</Button>
          </SoftRow>
        )}
      </PanelContent>
    </Panel>
  );
}
