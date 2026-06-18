import { Copy } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MetricTile } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import type { ImportScanReport, ImportScanReportItem } from '@/types/game';
import {
  filterImportReportItems,
  formatCount,
  importActionClass,
  importActionHint,
  importActionLabel,
  shouldResetImportReportFilters,
} from './scannerPageModel';

export function ImportReportPanel({ filter, onCopyInstallPath, onFilterChange, report }: { filter: string; onCopyInstallPath: (installPath: string) => void; onFilterChange: (value: string) => void; report: ImportScanReport }) {
  const [query, setQuery] = useState('');
  const items = filterImportReportItems(report, { actionFilter: filter, query });
  const resetFilters = () => {
    onFilterChange('all');
    setQuery('');
  };
  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-black/[0.12] p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-100">导入审计</div>
          <div className="mt-1 text-xs text-slate-500">请求 {formatCount(report.requested)} 个，写入 {formatCount(report.importedCount)} 个，当前显示 {formatCount(items.length)} / {formatCount(report.items.length)} 条处理明细。</div>
        </div>
        <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[minmax(12rem,16rem)_9rem_auto]">
          <Input aria-label="导入审计搜索" className="h-8" placeholder="标题 / 路径 / 原因" value={query} onChange={(event) => setQuery(event.target.value)} />
          <Select aria-label="导入审计动作筛选" className="h-8" value={filter} onChange={(event) => onFilterChange(event.target.value)}>
            <option value="all">全部</option>
            <option value="add">新增</option>
            <option value="merge">合并</option>
            <option value="replace">替换</option>
            <option value="duplicate">副本</option>
            <option value="skip">跳过</option>
          </Select>
          <Button className="h-8 px-2" disabled={!shouldResetImportReportFilters(filter, query)} size="sm" variant="outline" onClick={resetFilters}>重置审计</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-6">
        <MetricTile label="写入" value={report.importedCount} />
        <MetricTile label="新增" value={report.added} />
        <MetricTile label="合并" value={report.merged} />
        <MetricTile label="替换" value={report.replaced} />
        <MetricTile label="副本" value={report.duplicated} />
        <MetricTile label="跳过" value={report.skipped} />
      </div>
      <div className="max-h-80 space-y-1.5 overflow-auto pr-1">
        {items.length === 0 ? (
          <div className="rounded-md border border-white/10 bg-black/[0.10] px-3 py-3 text-xs text-slate-500">当前筛选没有明细。</div>
        ) : items.map((item) => <ImportReportRow item={item} key={`${item.action}-${item.installPath}-${item.candidateTitle}`} onCopyInstallPath={onCopyInstallPath} />)}
      </div>
    </div>
  );
}

function ImportReportRow({ item, onCopyInstallPath }: { item: ImportScanReportItem; onCopyInstallPath: (installPath: string) => void }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/[0.10] px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-medium text-slate-200" title={item.candidateTitle}>{item.candidateTitle}</span>
        <Badge className={importActionClass(item.action)}>{importActionLabel(item.action)}</Badge>
      </div>
      <div className="mt-1 text-slate-500">{item.message}{item.targetTitle ? `：${item.targetTitle}` : ''}</div>
      {item.conflictReason && <div className="mt-1 text-amber-100">冲突原因：{item.conflictReason}</div>}
      <div className="mt-1 text-slate-400">{importActionHint(item.action)}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="min-w-0 break-all font-mono text-[11px] text-slate-600">{item.installPath}</span>
        <Button aria-label="复制审计安装目录" size="sm" variant="ghost" onClick={() => onCopyInstallPath(item.installPath)}><Copy className="h-4 w-4" />复制</Button>
      </div>
      {item.gameId && <div className="mt-1 break-all font-mono text-[11px] text-slate-600">记录 ID：{item.gameId}</div>}
    </div>
  );
}
