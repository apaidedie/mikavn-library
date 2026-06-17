import { ListChecks, RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import { DuplicateAuditTaskRow, filterDuplicateAuditSummary, type DuplicateAuditTaskSummary } from './DuplicateAuditResultPanel';
import { formatCount } from './MaintenancePageParts';

export function MaintenanceDuplicateAuditHistoryPanel({
  history,
  loading,
  providerFilter,
  query,
  onLoadHistory,
  onOpenTask,
  onProviderFilterChange,
  onQueryChange,
  onResetFilters,
}: {
  history: DuplicateAuditTaskSummary[] | null;
  loading: boolean;
  providerFilter: string;
  query: string;
  onLoadHistory: () => void;
  onOpenTask?: (taskId?: string | null) => void;
  onProviderFilterChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onResetFilters: () => void;
}) {
  const filteredHistory = useMemo(() => history?.map((summary) => filterDuplicateAuditSummary(summary, query, providerFilter)).filter((summary) => summary.groups.length > 0) ?? [], [history, providerFilter, query]);

  return (
    <Panel>
      <PanelHeader
        title="重复 ID 审查结果"
        description="汇总最近重复 ID 审查任务发现的来源、外部 ID 和涉及游戏。"
        icon={<ListChecks className="h-4 w-4" />}
        actions={<Button disabled={loading} size="sm" variant="ghost" onClick={onLoadHistory}><RefreshCw className="h-4 w-4" />{loading ? '读取中' : '读取结果'}</Button>}
      />
      <PanelContent className="space-y-3">
        {history ? (
          history.length > 0 ? (
            <div className="space-y-3">
              <SoftRow className="grid gap-2 px-3 py-3 md:grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)_auto] md:items-end">
                <label className="min-w-0 text-xs text-slate-500">
                  搜索审查结果
                  <Input aria-label="重复 ID 审查结果搜索" className="mt-1 w-full" placeholder="来源 / 外部 ID / 游戏" value={query} onChange={(event) => onQueryChange(event.target.value)} />
                </label>
                <label className="min-w-0 text-xs text-slate-500">
                  来源筛选
                  <Select aria-label="重复 ID 审查结果来源筛选" className="mt-1 w-full" value={providerFilter} onChange={(event) => onProviderFilterChange(event.target.value)}>
                    <option value="all">全部来源</option>
                    <option value="vndb">VNDB</option>
                    <option value="dlsite">DLsite</option>
                    <option value="fanza">FANZA</option>
                    <option value="bangumi">Bangumi</option>
                    <option value="ymgal">YMGal</option>
                  </Select>
                </label>
                <Button className="h-9" disabled={!query.trim() && providerFilter === 'all'} size="sm" variant="outline" onClick={onResetFilters}>重置筛选</Button>
              </SoftRow>
              <div className="px-1 text-xs text-slate-500">当前显示 {formatCount(filteredHistory.reduce((count, summary) => count + summary.groups.length, 0))} / {formatCount(history.reduce((count, summary) => count + summary.groups.length, 0))} 个重复组。</div>
              {filteredHistory.length > 0 ? filteredHistory.map((summary) => <DuplicateAuditTaskRow key={summary.task.id} onOpenTask={onOpenTask} summary={summary} />) : <SoftRow className="px-3 py-3 text-sm text-slate-400">当前筛选没有匹配的重复 ID 审查结果。</SoftRow>}
            </div>
          ) : (
            <SoftRow className="px-3 py-3 text-sm text-slate-400">还没有重复 ID 审查任务记录。</SoftRow>
          )
        ) : (
          <SoftRow className="flex items-center justify-between gap-3 px-3 py-3">
            <div className="min-w-0 text-sm text-slate-400">读取后会解析最近 5 个重复 ID 审查任务日志，展示重复来源和涉及游戏。</div>
            <Button disabled={loading} size="sm" variant="secondary" onClick={onLoadHistory}><ListChecks className="h-4 w-4" />读取</Button>
          </SoftRow>
        )}
      </PanelContent>
    </Panel>
  );
}
