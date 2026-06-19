import { ListChecks, RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import { DescriptionImageRepairTaskRow, filterDescriptionImageRepairSummary, type DescriptionImageRepairTaskSummary } from './DescriptionImageRepairResultPanel';
import { formatCount } from './MaintenancePageParts';

export function MaintenanceDescriptionHistoryPanel({
  actionBusyTaskId,
  history,
  loading,
  providerFilter,
  query,
  statusFilter,
  onLoadHistory,
  onOpenGame,
  onOpenTask,
  onProviderFilterChange,
  onQueryChange,
  onResetFilters,
  onRetryTask,
  onStatusFilterChange,
}: {
  actionBusyTaskId: string | null;
  history: DescriptionImageRepairTaskSummary[] | null;
  loading: boolean;
  providerFilter: string;
  query: string;
  statusFilter: string;
  onLoadHistory: () => void;
  onOpenGame?: (gameId: string) => void;
  onOpenTask?: (taskId?: string | null) => void;
  onProviderFilterChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onResetFilters: () => void;
  onRetryTask: (taskId: string) => void;
  onStatusFilterChange: (value: string) => void;
}) {
  const filteredHistory = useMemo(() => history?.map((summary) => filterDescriptionImageRepairSummary(summary, query, statusFilter, providerFilter)).filter((summary) => summary.updated.length + summary.skipped.length + summary.failed.length > 0) ?? [], [history, providerFilter, query, statusFilter]);

  return (
    <Panel>
      <PanelHeader
        title="简介图片修复结果"
        description="汇总最近简介图片修复任务的来源、结果和可重试状态。"
        icon={<ListChecks className="h-4 w-4" />}
        actions={<Button disabled={loading} size="sm" variant="ghost" onClick={onLoadHistory}><RefreshCw className="h-4 w-4" />{loading ? '读取中' : '读取结果'}</Button>}
      />
      <PanelContent className="space-y-3">
        {history ? (
          history.length > 0 ? (
            <div className="space-y-3">
              <SoftRow className="grid gap-2 px-3 py-3 md:grid-cols-[minmax(0,1fr)_minmax(8rem,12rem)_minmax(10rem,14rem)_auto] md:items-end">
                <label className="min-w-0 text-xs text-slate-500">
                  搜索修复结果
                  <Input aria-label="简介图片修复结果搜索" className="mt-1 w-full" placeholder="游戏 / ID / 来源 / 原因" value={query} onChange={(event) => onQueryChange(event.target.value)} />
                </label>
                <label className="min-w-0 text-xs text-slate-500">
                  来源
                  <Select aria-label="简介图片修复结果来源筛选" className="mt-1 w-full" value={providerFilter} onChange={(event) => onProviderFilterChange(event.target.value)}>
                    <option value="all">全部来源</option>
                    <option value="dlsite">DLsite</option>
                    <option value="fanza">FANZA</option>
                  </Select>
                </label>
                <label className="min-w-0 text-xs text-slate-500">
                  结果状态
                  <Select aria-label="简介图片修复结果状态筛选" className="mt-1 w-full" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
                    <option value="all">全部结果</option>
                    <option value="updated">已修复</option>
                    <option value="skipped">跳过</option>
                    <option value="failed">失败</option>
                  </Select>
                </label>
                <Button className="h-9" disabled={!query.trim() && statusFilter === 'all' && providerFilter === 'all'} size="sm" variant="outline" onClick={onResetFilters}>重置筛选</Button>
              </SoftRow>
              <div className="px-1 text-xs text-slate-500">当前显示 {formatCount(filteredHistory.reduce((count, summary) => count + summary.updated.length + summary.skipped.length + summary.failed.length, 0))} / {formatCount(history.reduce((count, summary) => count + summary.updated.length + summary.skipped.length + summary.failed.length, 0))} 条简介图片修复明细。</div>
              {filteredHistory.length > 0 ? filteredHistory.map((summary) => <DescriptionImageRepairTaskRow actionBusy={actionBusyTaskId === summary.task.id} key={summary.task.id} onOpenGame={onOpenGame} onOpenTask={onOpenTask} onRetryTask={onRetryTask} summary={summary} />) : <SoftRow className="px-3 py-3 text-sm text-slate-400">当前筛选没有匹配的简介图片修复结果。</SoftRow>}
            </div>
          ) : (
            <SoftRow className="px-3 py-3 text-sm text-slate-400">还没有简介图片修复任务记录。</SoftRow>
          )
        ) : (
          <SoftRow className="flex items-center justify-between gap-3 px-3 py-3">
            <div className="min-w-0 text-sm text-slate-400">读取后会解析最近 5 个简介图片修复任务日志，展示已修复、跳过和失败来源。</div>
            <Button disabled={loading} size="sm" variant="secondary" onClick={onLoadHistory}><ListChecks className="h-4 w-4" />读取</Button>
          </SoftRow>
        )}
      </PanelContent>
    </Panel>
  );
}
