import { Image, ListChecks } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import type { ArtworkRepairDiagnosis } from '@/types/metadata';
import { ArtworkDiagnosisRow, CompactStat, formatCount, matchesArtworkDiagnosisItem } from './MaintenancePageParts';

export function MaintenanceArtworkDiagnosisPanel({
  diagnosis,
  loading,
  missingArtworkFieldCount,
  query,
  statusFilter,
  onLoadDiagnosis,
  onOpenGame,
  onOpenMetadata,
  onQueryChange,
  onResetFilters,
  onStatusFilterChange,
}: {
  diagnosis: ArtworkRepairDiagnosis | null;
  loading: boolean;
  missingArtworkFieldCount: number;
  query: string;
  statusFilter: string;
  onLoadDiagnosis: () => void;
  onOpenGame?: (gameId: string) => void;
  onOpenMetadata?: (preset?: { query?: string; missingProvider?: string } | null) => void;
  onQueryChange: (value: string) => void;
  onResetFilters: () => void;
  onStatusFilterChange: (value: string) => void;
}) {
  const filteredItems = useMemo(() => diagnosis?.items.filter((item) => matchesArtworkDiagnosisItem(item, query, statusFilter)) ?? [], [diagnosis, query, statusFilter]);

  return (
    <Panel>
      <PanelHeader
        title="媒体补全诊断"
        description="在创建补图任务前，查看缺图条目为什么能补或补不了。"
        icon={<Image className="h-4 w-4" />}
        actions={<Button disabled={loading || missingArtworkFieldCount === 0} size="sm" variant="ghost" onClick={onLoadDiagnosis}><ListChecks className="h-4 w-4" />{loading ? '读取中' : '读取诊断'}</Button>}
      />
      <PanelContent className="space-y-3">
        {diagnosis ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              <CompactStat label="缺图游戏" value={diagnosis.totalMissingGames} tone={diagnosis.totalMissingGames > 0 ? 'warn' : 'ok'} />
              <CompactStat label="缺图字段" value={diagnosis.totalMissingFields} tone={diagnosis.totalMissingFields > 0 ? 'warn' : 'ok'} />
              <CompactStat label="可补全" value={diagnosis.repairableCount} tone={diagnosis.repairableCount > 0 ? 'ok' : 'neutral'} />
              <CompactStat label="缺外部 ID" value={diagnosis.missingExternalIdCount} tone={diagnosis.missingExternalIdCount > 0 ? 'warn' : 'ok'} />
              <CompactStat label="来源异常" value={diagnosis.noRemoteImageCount + diagnosis.providerErrorCount} tone={(diagnosis.noRemoteImageCount + diagnosis.providerErrorCount) > 0 ? 'warn' : 'ok'} />
            </div>
            <SoftRow className="grid gap-2 px-3 py-3 md:grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)_auto] md:items-end">
              <label className="min-w-0 text-xs text-slate-500">
                搜索诊断结果
                <Input aria-label="媒体补全诊断搜索" className="mt-1 w-full" placeholder="游戏 / ID / 字段 / 来源 / 原因" value={query} onChange={(event) => onQueryChange(event.target.value)} />
              </label>
              <label className="min-w-0 text-xs text-slate-500">
                诊断状态
                <Select aria-label="媒体补全诊断状态筛选" className="mt-1 w-full" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
                  <option value="all">全部状态</option>
                  <option value="repairable">可补全</option>
                  <option value="missing_external_id">缺外部 ID</option>
                  <option value="no_remote_image">远程无图</option>
                  <option value="provider_error">来源失败</option>
                </Select>
              </label>
              <Button className="h-9" disabled={!query.trim() && statusFilter === 'all'} size="sm" variant="outline" onClick={onResetFilters}>重置筛选</Button>
            </SoftRow>
            {diagnosis.items.length > 0 ? (
              <div className="space-y-2">
                <div className="px-1 text-xs text-slate-500">当前显示 {formatCount(filteredItems.length)} / {formatCount(diagnosis.items.length)} 个诊断条目。</div>
                {filteredItems.length > 0 ? filteredItems.map((item) => <ArtworkDiagnosisRow item={item} key={item.gameId} onOpenGame={onOpenGame} onOpenMetadata={onOpenMetadata} />) : <SoftRow className="px-3 py-3 text-sm text-slate-400">当前筛选没有匹配的媒体补全诊断。</SoftRow>}
                {diagnosis.truncated && <div className="px-1 text-xs text-slate-500">结果较多，当前只诊断前 {formatCount(diagnosis.diagnosedGames)} 个缺图游戏。</div>}
              </div>
            ) : (
              <SoftRow className="px-3 py-3 text-sm text-slate-400">没有发现需要诊断的缺图条目。</SoftRow>
            )}
          </>
        ) : (
          <SoftRow className="flex items-center justify-between gap-3 px-3 py-3">
            <div className="min-w-0 text-sm text-slate-400">读取后会检查前 50 个缺图游戏，列出缺字段、外部 ID 和来源图片状态。</div>
            <Button disabled={loading || missingArtworkFieldCount === 0} size="sm" variant="secondary" onClick={onLoadDiagnosis}><ListChecks className="h-4 w-4" />读取</Button>
          </SoftRow>
        )}
      </PanelContent>
    </Panel>
  );
}
