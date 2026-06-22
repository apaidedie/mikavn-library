import { Activity, AlertTriangle, Archive, Clock3, Database, FileArchive, HardDrive, ImageOff, RotateCcw, Search, ShieldCheck } from 'lucide-react';
import { DiagnosticExportPathActions } from '@/components/diagnostics/DiagnosticExportPathActions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/notice';
import { Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import type { SettingsSection, SettingsTab } from '@/pages/Settings/SettingsPage';
import type { AppDataDiagnostics } from '@/types/archive';
import type { LibraryFilterPreset } from '@/types/game';
import type { TaskFilterPreset } from '@/types/task';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/time';
import { deriveDatabaseBackupStatus, type DashboardAttentionItem } from './dashboardPersonal';

type DashboardPanelActions = {
  onOpenLibrary?: (preset?: LibraryFilterPreset | null) => void;
  onOpenMaintenance?: (section?: string | null) => void;
  onOpenMetadata?: (preset?: { query?: string; missingProvider?: string } | null) => void;
  onOpenSaves?: () => void;
  onOpenSettings?: (tab?: SettingsTab, section?: SettingsSection | null) => void;
  onOpenTasks?: (taskId?: string | null, preset?: TaskFilterPreset | null) => void;
};

export function NeedsAttentionPanel({ items, onOpenLibrary, onOpenMaintenance, onOpenMetadata, onOpenSettings, onOpenTasks }: DashboardPanelActions & { items: DashboardAttentionItem[] }) {
  return (
    <Panel>
      <PanelHeader title="需要关注" description={items.length > 0 ? '这些提醒都指向本地修复入口。' : '当前没有需要立刻处理的本地提醒。'} icon={<AlertTriangle className="h-4 w-4" />} />
      <PanelContent className="space-y-2">
        {items.length === 0 ? (
          <EmptyState className="py-8">路径、素材、外部 ID 和近期任务都没有明显问题。</EmptyState>
        ) : items.map((item) => (
          <SoftRow className={cn('grid grid-cols-[auto_1fr_auto] items-center gap-3', item.tone === 'danger' && 'border-rose-300/20 bg-rose-400/[0.055]', item.tone === 'warning' && 'border-amber-300/20 bg-amber-400/[0.055]')} key={item.kind}>
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-black/20', item.tone === 'danger' && 'text-rose-200', item.tone === 'warning' && 'text-amber-200', item.tone === 'info' && 'text-sky-200')}>
              <AttentionIcon kind={item.kind} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-slate-100">{item.title}</span>
                {item.count > 0 && <Badge>{item.count}</Badge>}
              </div>
              <div className="mt-1 text-xs text-slate-500">{item.detail}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => openAttentionItem(item, { onOpenLibrary, onOpenMaintenance, onOpenMetadata, onOpenSettings, onOpenTasks })}>查看</Button>
          </SoftRow>
        ))}
      </PanelContent>
    </Panel>
  );
}

type LocalSafetyPanelProps = Pick<DashboardPanelActions, 'onOpenSaves' | 'onOpenSettings' | 'onOpenTasks'> & {
  diagnosticExportLoading?: boolean;
  diagnosticExportMessage?: string | null;
  diagnosticExportPath?: string | null;
  diagnostics: AppDataDiagnostics | null;
  onCopyDiagnosticExportPath?: () => void;
  onExportDiagnosticPackage?: () => void;
  onRevealDiagnosticExportPath?: () => void;
};

export function LocalSafetyPanel({
  diagnosticExportLoading = false,
  diagnosticExportMessage,
  diagnosticExportPath,
  diagnostics,
  onCopyDiagnosticExportPath,
  onExportDiagnosticPackage,
  onOpenSaves,
  onOpenSettings,
  onOpenTasks,
  onRevealDiagnosticExportPath,
}: LocalSafetyPanelProps) {
  const backupStatus = deriveDatabaseBackupStatus(diagnostics?.databaseBackups);
  const databaseSummary = diagnostics ? `${diagnostics.database.gameCount} 个游戏 · ${backupStatus.summary}` : '读取本地自检后显示数据库和备份状态。';
  const backupDetail = diagnostics ? `${backupStatus.detail}${backupStatus.latestBackupAt ? ` 最近：${formatDateTime(backupStatus.latestBackupAt)}` : ''}` : '数据库备份会保存在本机 app-data 中。';
  const imageSummary = diagnostics ? `${diagnostics.images.fileCount} 个图片缓存 · ${diagnostics.logs.fileCount} 个日志文件` : '图片、日志和缓存都保存在本机 app-data。';

  return (
    <Panel>
      <PanelHeader title="本地安全" description="自用版优先保证数据位置清楚、备份入口明显、恢复前可复核。" icon={<ShieldCheck className="h-4 w-4" />} />
      <PanelContent>
        <div className="grid gap-3 lg:grid-cols-3">
          <SoftRow className={cn('flex flex-col justify-between gap-3', backupStatus.actionNeeded && 'border-amber-300/20 bg-amber-400/[0.055]')}>
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-100"><Database className="h-4 w-4 text-[rgb(var(--accent-rgb))]" />数据库与自检</div>
              <div className="mt-1 text-xs text-slate-500">{databaseSummary}</div>
              <div className={cn('mt-1 text-xs', backupStatus.actionNeeded ? 'text-amber-200' : 'text-slate-500')}>{backupDetail}</div>
              <div className="mt-1 text-xs text-slate-600">恢复前自动保护备份，恢复会安排到下次启动应用。</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => onOpenSettings?.('local', 'database-restore')}>备份与恢复</Button>
              <Button size="sm" variant="secondary" onClick={() => onOpenSettings?.('local', 'database-restore')}><RotateCcw className="h-4 w-4" />恢复数据库</Button>
            </div>
          </SoftRow>
          <SoftRow className="flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-100"><Archive className="h-4 w-4 text-[rgb(var(--accent-rgb))]" />存档备份</div>
              <div className="mt-1 text-xs text-slate-500">管理游戏存档路径、手动备份和恢复前保护备份。</div>
            </div>
            <Button size="sm" variant="outline" onClick={onOpenSaves}>打开存档</Button>
          </SoftRow>
          <SoftRow className="flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-100"><HardDrive className="h-4 w-4 text-[rgb(var(--accent-rgb))]" />本地文件</div>
              <div className="mt-1 text-xs text-slate-500">{imageSummary}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => onOpenSettings?.('local')}>数据目录</Button>
              {onOpenTasks && <Button size="sm" variant="ghost" onClick={() => onOpenTasks(null, { statusFilter: 'attention' })}>任务日志</Button>}
              {onExportDiagnosticPackage && <Button disabled={diagnosticExportLoading} size="sm" variant="ghost" onClick={onExportDiagnosticPackage}><FileArchive className="h-4 w-4" />{diagnosticExportLoading ? '导出中' : '导出诊断包'}</Button>}
              {diagnosticExportPath && onCopyDiagnosticExportPath && onRevealDiagnosticExportPath && (
                <DiagnosticExportPathActions buttonSize="sm" buttonVariant="ghost" path={diagnosticExportPath} onCopy={onCopyDiagnosticExportPath} onReveal={onRevealDiagnosticExportPath} />
              )}
            </div>
            {diagnosticExportMessage && <div className="break-all text-xs text-slate-500" role="status">{diagnosticExportMessage}</div>}
          </SoftRow>
        </div>
      </PanelContent>
    </Panel>
  );
}

function AttentionIcon({ kind }: { kind: DashboardAttentionItem['kind'] }) {
  switch (kind) {
    case 'failed_tasks':
      return <Activity className="h-4 w-4" />;
    case 'running_tasks':
      return <Clock3 className="h-4 w-4" />;
    case 'path_health':
      return <HardDrive className="h-4 w-4" />;
    case 'missing_artwork':
      return <ImageOff className="h-4 w-4" />;
    case 'missing_external_ids':
      return <Search className="h-4 w-4" />;
    case 'database_backup':
      return <Database className="h-4 w-4" />;
  }
}

function openAttentionItem(item: DashboardAttentionItem, actions: DashboardPanelActions) {
  switch (item.action) {
    case 'tasks_attention':
      actions.onOpenTasks?.(null, { statusFilter: 'attention' });
      break;
    case 'tasks_active':
      actions.onOpenTasks?.(null, { statusFilter: 'active' });
      break;
    case 'library_paths':
      actions.onOpenLibrary?.({ pathStatus: 'broken' });
      break;
    case 'maintenance_artwork':
      actions.onOpenMaintenance?.('artwork');
      break;
    case 'metadata_missing_ids':
      actions.onOpenMetadata?.({ missingProvider: 'all' });
      break;
    case 'settings_local':
      actions.onOpenSettings?.('local', item.kind === 'database_backup' ? 'database-restore' : null);
      break;
  }
}
