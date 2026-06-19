import { Combine, Copy, ListChecks, RefreshCw, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import type { DuplicateExternalIdGroup, DuplicateGameMergePreview } from '@/types/metadata';
import { CompactStat, duplicateGroupKey, formatCount, providerLabel } from './MaintenancePageParts';

export function MaintenanceDuplicateMergePanel({
  duplicateExternalIdGroupCount,
  duplicateGroupFiltersActive,
  duplicateGroupProvider,
  duplicateGroupQuery,
  duplicateGroups,
  filteredDuplicateGroups,
  loading,
  mergeLoading,
  mergePreview,
  mergeSourceIds,
  mergeTargetId,
  recommendedMergeTargetId,
  selectedDuplicateGroup,
  selectedDuplicateKey,
  onCopyPath,
  onLoadGroups,
  onMergeGroup,
  onMergeTargetChange,
  onPreviewMerge,
  onProviderChange,
  onQueryChange,
  onResetFilters,
  onSelectedDuplicateKeyChange,
}: {
  duplicateExternalIdGroupCount: number;
  duplicateGroupFiltersActive: boolean;
  duplicateGroupProvider: string;
  duplicateGroupQuery: string;
  duplicateGroups: DuplicateExternalIdGroup[];
  filteredDuplicateGroups: DuplicateExternalIdGroup[];
  loading: boolean;
  mergeLoading: boolean;
  mergePreview: DuplicateGameMergePreview | null;
  mergeSourceIds: string[];
  mergeTargetId: string;
  recommendedMergeTargetId: string | null;
  selectedDuplicateGroup: DuplicateExternalIdGroup | null;
  selectedDuplicateKey: string;
  onCopyPath: (label: string, path: string) => void;
  onLoadGroups: () => void;
  onMergeGroup: () => void;
  onMergeTargetChange: (gameId: string) => void;
  onPreviewMerge: () => void;
  onProviderChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onResetFilters: () => void;
  onSelectedDuplicateKeyChange: (value: string) => void;
}) {
  return (
    <Panel>
      <PanelHeader
        title="重复游戏安全合并"
        description="只允许合并共享外部 ID 的条目，执行前会预览搬迁数据。"
        icon={<Combine className="h-4 w-4" />}
        actions={<Button disabled={loading} size="sm" variant="ghost" onClick={onLoadGroups}><RefreshCw className="h-4 w-4" />{loading ? '读取中' : '读取重复组'}</Button>}
      />
      <PanelContent className="space-y-3">
        {duplicateGroups.length === 0 ? (
          <SoftRow className="flex items-center justify-between gap-3 px-3 py-3">
            <div className="min-w-0 text-sm text-slate-400">还没有载入重复组。先读取重复组，或运行重复 ID 审查后再回来处理。</div>
            <Button disabled={loading || duplicateExternalIdGroupCount === 0} size="sm" variant="secondary" onClick={onLoadGroups}><ListChecks className="h-4 w-4" />读取</Button>
          </SoftRow>
        ) : (
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="space-y-2">
              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(8rem,12rem)_auto] md:items-end">
                <label className="min-w-0 text-xs text-slate-500">
                  搜索重复组
                  <Input aria-label="重复组搜索" className="mt-1 w-full" placeholder="标题 / 路径 / 外部 ID" value={duplicateGroupQuery} onChange={(event) => onQueryChange(event.target.value)} />
                </label>
                <label className="min-w-0 text-xs text-slate-500">
                  来源筛选
                  <Select aria-label="重复组来源筛选" className="mt-1 w-full" value={duplicateGroupProvider} onChange={(event) => onProviderChange(event.target.value)}>
                    <option value="all">全部来源</option>
                    <option value="vndb">VNDB</option>
                    <option value="dlsite">DLsite</option>
                    <option value="fanza">FANZA</option>
                    <option value="bangumi">Bangumi</option>
                    <option value="ymgal">YMGal</option>
                  </Select>
                </label>
                <Button className="h-9" disabled={!duplicateGroupFiltersActive} size="sm" variant="outline" onClick={onResetFilters}>重置筛选</Button>
              </div>
              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)]">
                <label className="min-w-0 text-xs text-slate-500">
                  重复组 · {formatCount(filteredDuplicateGroups.length)} / {formatCount(duplicateGroups.length)}
                  <Select className="mt-1 w-full" disabled={filteredDuplicateGroups.length === 0} value={selectedDuplicateKey} onChange={(event) => onSelectedDuplicateKeyChange(event.target.value)}>
                    {filteredDuplicateGroups.map((group) => (
                      <option key={duplicateGroupKey(group)} value={duplicateGroupKey(group)}>{providerLabel(group.provider)} {group.externalId} · {group.gameCount} 条</option>
                    ))}
                  </Select>
                </label>
                <label className="min-w-0 text-xs text-slate-500">
                  保留为目标
                  <Select className="mt-1 w-full" value={mergeTargetId} onChange={(event) => onMergeTargetChange(event.target.value)}>
                    {selectedDuplicateGroup?.games.map((game) => <option key={game.gameId} value={game.gameId}>{game.title}</option>)}
                  </Select>
                </label>
              </div>
              {filteredDuplicateGroups.length === 0 ? (
                <SoftRow className="px-3 py-3 text-sm text-slate-400">当前筛选没有重复组。</SoftRow>
              ) : <div className="space-y-2">
                {selectedDuplicateGroup?.games.map((game) => (
                  <SoftRow className="grid gap-2 px-3 py-2 md:grid-cols-[minmax(0,1fr)_auto]" key={game.gameId}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-slate-100">{game.title}</span>
                        {game.gameId === mergeTargetId ? <Badge>保留</Badge> : <Badge>并入</Badge>}
                        {game.gameId === recommendedMergeTargetId && <Badge className="border-emerald-300/20 bg-emerald-400/10 text-emerald-100">推荐保留</Badge>}
                      </div>
                      <div className="mt-1 flex min-w-0 items-start gap-1">
                        <div className="min-w-0 break-all font-mono text-[11px] text-slate-600">{game.installPath}</div>
                        <Button aria-label="复制重复游戏安装目录" className="h-6 w-6 shrink-0" size="icon" title="复制重复游戏安装目录" variant="ghost" onClick={() => onCopyPath('重复游戏安装目录', game.installPath)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2 text-right text-[11px] text-slate-500">
                      <span>{game.sources.join(' / ')}</span>
                      {game.gameId !== mergeTargetId && <Button className="h-7 px-2" size="sm" variant="ghost" onClick={() => onMergeTargetChange(game.gameId)}>设为保留</Button>}
                    </div>
                  </SoftRow>
                ))}
              </div>}
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button disabled={mergeLoading || !mergeTargetId || mergeSourceIds.length === 0} size="sm" variant="secondary" onClick={onPreviewMerge}><ShieldCheck className="h-4 w-4" />{mergeLoading && !mergePreview ? '预览中' : '预览合并'}</Button>
                <Button disabled={mergeLoading || !mergePreview || mergeSourceIds.length === 0} size="sm" variant="danger" onClick={onMergeGroup}><Combine className="h-4 w-4" />{mergeLoading && mergePreview ? '合并中' : '确认合并'}</Button>
              </div>
              {mergePreview ? (
                <div className="space-y-2">
                  <SoftRow className="px-3 py-2">
                    <div className="text-xs text-slate-500">共享外部 ID</div>
                    <div className="mt-1 text-sm text-slate-200">{mergePreview.sharedExternalIds.map((item) => `${item.provider} ${item.externalId}`).join('，')}</div>
                  </SoftRow>
                  <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                    <CompactStat label="删除源条目" value={mergePreview.movedCounts.sourceGames} tone="warn" />
                    <CompactStat label="搬迁资产" value={mergePreview.movedCounts.assets} />
                    <CompactStat label="收藏关系" value={mergePreview.movedCounts.collectionLinks} />
                    <CompactStat label="启动配置" value={mergePreview.movedCounts.launchProfiles} />
                    <CompactStat label="存档路径" value={mergePreview.movedCounts.savePaths} />
                    <CompactStat label="存档备份" value={mergePreview.movedCounts.saveBackups} />
                    <CompactStat label="游玩记录" value={mergePreview.movedCounts.playSessions} />
                    <CompactStat label="外部 ID" value={mergePreview.movedCounts.externalIds} />
                    <CompactStat label="标签关系" value={mergePreview.movedCounts.tags} />
                    <CompactStat label="字段锁" value={mergePreview.movedCounts.fieldLocks} />
                    <CompactStat label="匹配结果" value={mergePreview.movedCounts.metadataMatchResults} />
                  </div>
                  {mergePreview.warnings.length > 0 && (
                    <Notice className="py-2" tone="warning">
                      <div className="flex flex-col gap-1 text-xs leading-5">
                        {mergePreview.warnings.slice(0, 4).map((warning) => <span key={warning}>{warning}</span>)}
                      </div>
                    </Notice>
                  )}
                </div>
              ) : (
                <SoftRow className="px-3 py-3 text-xs leading-5 text-slate-500">预览后会显示将要移动的收藏、资产、外部 ID、标签、字段锁、启动配置、存档、存档备份、游玩记录和匹配结果数量。</SoftRow>
              )}
            </div>
          </div>
        )}
      </PanelContent>
    </Panel>
  );
}
