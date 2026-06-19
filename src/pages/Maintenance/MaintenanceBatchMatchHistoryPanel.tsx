import { ListChecks, RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import { BatchMatchHistoryTaskRow, filterBatchMatchHistorySummary, type BatchMatchHistorySummary } from './BatchMatchResultPanel';
import { formatCount } from './MaintenancePageParts';

export function MaintenanceBatchMatchHistoryPanel({
  history,
  loading,
  query,
  statusFilter,
  onLoadHistory,
  onOpenTask,
  onQueryChange,
  onResetFilters,
  onStatusFilterChange,
  providerLabel,
}: {
  history: BatchMatchHistorySummary[] | null;
  loading: boolean;
  query: string;
  statusFilter: string;
  onLoadHistory: () => void;
  onOpenTask?: (taskId?: string | null) => void;
  onQueryChange: (value: string) => void;
  onResetFilters: () => void;
  onStatusFilterChange: (value: string) => void;
  providerLabel: (value: string) => string;
}) {
  const filteredHistory = useMemo(() => history?.map((summary) => filterBatchMatchHistorySummary(summary, query, statusFilter, providerLabel)).filter((summary) => summary.results.length > 0) ?? [], [history, providerLabel, query, statusFilter]);

  return (
    <Panel>
      <PanelHeader
        title="批量匹配结果"
        description="汇总最近批量元数据匹配任务的成功、复核、无结果和错误条目。"
        icon={<ListChecks className="h-4 w-4" />}
        actions={<Button disabled={loading} size="sm" variant="ghost" onClick={onLoadHistory}><RefreshCw className="h-4 w-4" />{loading ? '读取中' : '读取结果'}</Button>}
      />
      <PanelContent className="space-y-3">
        {history ? (
          history.length > 0 ? (
            <div className="space-y-3">
              <SoftRow className="grid gap-2 px-3 py-3 md:grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)_auto] md:items-end">
                <label className="min-w-0 text-xs text-slate-500">
                  搜索匹配结果
                  <Input aria-label="批量匹配结果搜索" className="mt-1 w-full" placeholder="标题 / 来源 / ID / 原因" value={query} onChange={(event) => onQueryChange(event.target.value)} />
                </label>
                <label className="min-w-0 text-xs text-slate-500">
                  结果状态
                  <Select aria-label="批量匹配结果状态筛选" className="mt-1 w-full" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
                    <option value="all">全部结果</option>
                    <option value="success">成功</option>
                    <option value="review">待复核</option>
                    <option value="no_result">无结果</option>
                    <option value="error">错误</option>
                  </Select>
                </label>
                <Button className="h-9" disabled={!query.trim() && statusFilter === 'all'} size="sm" variant="outline" onClick={onResetFilters}>重置筛选</Button>
              </SoftRow>
              <div className="px-1 text-xs text-slate-500">当前显示 {formatCount(filteredHistory.reduce((count, summary) => count + summary.results.length, 0))} / {formatCount(history.reduce((count, summary) => count + summary.results.length, 0))} 条匹配结果。</div>
              {filteredHistory.length > 0 ? filteredHistory.map((summary) => <BatchMatchHistoryTaskRow formatCount={formatCount} key={summary.task.id} onOpenTask={onOpenTask} providerLabel={providerLabel} summary={summary} />) : <SoftRow className="px-3 py-3 text-sm text-slate-400">当前筛选没有匹配的批量匹配结果。</SoftRow>}
            </div>
          ) : (
            <SoftRow className="px-3 py-3 text-sm text-slate-400">还没有批量匹配任务记录。</SoftRow>
          )
        ) : (
          <SoftRow className="flex items-center justify-between gap-3 px-3 py-3">
            <div className="min-w-0 text-sm text-slate-400">读取后会解析最近批量匹配结果，展示推荐来源和候选数量。</div>
            <Button disabled={loading} size="sm" variant="secondary" onClick={onLoadHistory}><ListChecks className="h-4 w-4" />读取</Button>
          </SoftRow>
        )}
      </PanelContent>
    </Panel>
  );
}
