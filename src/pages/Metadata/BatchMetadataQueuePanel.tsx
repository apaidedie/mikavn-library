import { DatabaseZap, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/notice';
import { MetricTile, Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import type { Game } from '@/types/game';
import type { ApplyMetadataFields } from '@/types/metadata';
import {
  batchMetadataQueueInitialRenderCount,
  batchMetadataQueueRenderBatchSize,
  defaultFields,
  fieldOptions,
  getBatchMetadataQueueRenderWindow,
  mediaFields,
  missingProviderOptions,
  normalizeMissingProviderFilter,
  textFields,
  type MissingProviderFilter,
} from './batchMetadataPageModel';

type BatchMetadataQueuePanelProps = {
  fields: ApplyMetadataFields;
  filteredIncompleteGames: Game[];
  incompleteGames: Game[];
  loading: boolean;
  missingProviderFilter: MissingProviderFilter;
  queueGapCounts: Record<MissingProviderFilter, number>;
  queueQuery: string;
  selectedIds: string[];
  onFieldsChange: (fields: ApplyMetadataFields) => void;
  onMissingProviderFilterChange: (filter: MissingProviderFilter) => void;
  onQueueQueryChange: (value: string) => void;
  onResetQueueFilters: () => void;
  onSelectIds: (ids: string[]) => void;
  onStart: () => void;
  onToggleField: (field: ApplyMetadataFields[number]) => void;
  onToggleGame: (id: string) => void;
};

export function BatchMetadataQueuePanel({ fields, filteredIncompleteGames, incompleteGames, loading, missingProviderFilter, onFieldsChange, onMissingProviderFilterChange, onQueueQueryChange, onResetQueueFilters, onSelectIds, onStart, onToggleField, onToggleGame, queueGapCounts, queueQuery, selectedIds }: BatchMetadataQueuePanelProps) {
  const queueFilterKey = `${missingProviderFilter}\n${queueQuery}`;
  const [queueVisibleState, setQueueVisibleState] = useState({ count: batchMetadataQueueInitialRenderCount, filterKey: queueFilterKey });
  const visibleCount = queueVisibleState.filterKey === queueFilterKey ? queueVisibleState.count : batchMetadataQueueInitialRenderCount;
  const { visibleGames, hasMore, renderedCount, totalCount } = useMemo(
    () => getBatchMetadataQueueRenderWindow(filteredIncompleteGames, visibleCount),
    [filteredIncompleteGames, visibleCount],
  );
  const loadMore = () => {
    setQueueVisibleState((current) => ({
      count: (current.filterKey === queueFilterKey ? current.count : batchMetadataQueueInitialRenderCount) + batchMetadataQueueRenderBatchSize,
      filterKey: queueFilterKey,
    }));
  };

  return (
    <Panel>
      <PanelHeader title="匹配队列" icon={<DatabaseZap className="h-4 w-4" />} />
      <PanelContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricTile label="待补全" value={`${incompleteGames.length}`} />
          <MetricTile label="已选择" value={`${selectedIds.length}`} />
          <MetricTile label="当前筛选" value={`${filteredIncompleteGames.length}`} />
        </div>
        <div className="grid gap-2">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Input aria-label="匹配队列搜索" placeholder="搜索标题 / 会社 / 路径" value={queueQuery} onChange={(event) => onQueueQueryChange(event.target.value)} />
            <Button disabled={!queueQuery.trim() && missingProviderFilter === 'all'} size="sm" variant="outline" onClick={onResetQueueFilters}>重置队列</Button>
          </div>
          <Select aria-label="缺失来源筛选" value={missingProviderFilter} onChange={(event) => onMissingProviderFilterChange(normalizeMissingProviderFilter(event.target.value))}>
            {missingProviderOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5" aria-label="缺口快捷筛选">
            {missingProviderOptions.map((option) => {
              const active = missingProviderFilter === option.id;
              return (
                <Button
                  aria-pressed={active}
                  className={active ? 'border-[rgb(var(--accent-rgb)/0.42)] bg-[rgb(var(--accent-rgb)/0.16)] text-slate-100' : 'text-slate-300'}
                  key={option.id}
                  size="sm"
                  variant="outline"
                  onClick={() => onMissingProviderFilterChange(option.id)}
                >
                  <span>{option.shortLabel}</span>
                  <span className="font-mono text-[11px] text-slate-400">{queueGapCounts[option.id]}</span>
                </Button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => onSelectIds(filteredIncompleteGames.map((game) => game.id))}>选择当前筛选</Button>
          <Button size="sm" variant="ghost" onClick={() => onSelectIds([])}>清空</Button>
        </div>
        <div className="max-h-[calc(100vh-25rem)] space-y-1.5 overflow-auto pr-1">
          {filteredIncompleteGames.length === 0 ? (
            <EmptyState className="py-8">当前筛选没有待补全条目。</EmptyState>
          ) : visibleGames.map((game) => (
            <label className="block" key={game.id}>
              <SoftRow className="flex gap-3 bg-black/[0.08] px-2.5 py-2">
                <Checkbox checked={selectedIds.includes(game.id)} className="mt-1" onChange={() => onToggleGame(game.id)} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-100">{game.title}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-slate-500">
                    {!game.vndbId && <span>缺 VNDB</span>}
                    {!game.dlsiteId && <span>缺 DLsite</span>}
                    {!game.fanzaId && <span>缺 FANZA</span>}
                  </div>
                </div>
              </SoftRow>
            </label>
          ))}
        </div>
        {hasMore && (
          <Button className="w-full justify-center" size="sm" variant="outline" onClick={loadMore}>
            加载更多 {renderedCount} / {totalCount}
          </Button>
        )}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-medium text-slate-500">写入字段</div>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => onFieldsChange(defaultFields)}>安全补全</Button>
              <Button size="sm" variant="ghost" onClick={() => onFieldsChange(mediaFields)}>只补媒体</Button>
              <Button size="sm" variant="ghost" onClick={() => onFieldsChange(textFields)}>只补文本</Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {fieldOptions.map((option) => (
              <label className="flex items-center gap-1 rounded-md border border-white/10 bg-black/[0.12] px-2 py-1 text-xs text-slate-400" key={option.id}>
                <Checkbox checked={fields.includes(option.id)} className="h-3.5 w-3.5" onChange={() => onToggleField(option.id)} />
                {option.label}
              </label>
            ))}
          </div>
        </div>
        <Button className="w-full" disabled={loading || selectedIds.length === 0} onClick={onStart}><RefreshCw className="h-4 w-4" />开始匹配 {selectedIds.length} 个条目</Button>
      </PanelContent>
    </Panel>
  );
}
