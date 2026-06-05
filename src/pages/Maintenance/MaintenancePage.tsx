import { AlertTriangle, CheckCircle2, Database, FolderOpen, HardDrive, Image, ListChecks, PlayCircle, RefreshCw, ShieldCheck, Trash2, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { MetricTile, PageFrame, PageHeader, PageShell, Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import { TaskNotice } from '@/components/ui/task-notice';
import { api } from '@/services/api';
import type { AppDataDiagnostics } from '@/types/archive';
import { errorMessage } from '@/utils/errorMessage';

type TaskMessage = { text: string; taskId?: string | null };

export function MaintenancePage({ refreshKey, onOpenTasks }: { refreshKey: number; onOpenTasks?: (taskId?: string | null) => void }) {
  const [diagnostics, setDiagnostics] = useState<AppDataDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [metadataRepairLoading, setMetadataRepairLoading] = useState(false);
  const [descriptionRepairLoading, setDescriptionRepairLoading] = useState(false);
  const [duplicateAuditLoading, setDuplicateAuditLoading] = useState(false);
  const [message, setMessage] = useState<TaskMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadDiagnostics();
  }, [refreshKey]);

  const database = diagnostics?.database;
  const metadata = database?.metadataCoverage;
  const descriptionImages = database?.descriptionImages;
  const externalIds = database?.externalIds;
  const pathStatus = database?.pathStatus;
  const providerDescriptionCoverage = useMemo(() => percent(descriptionImages?.providerGamesWithImagesCount ?? 0, descriptionImages?.providerGamesCount ?? 0), [descriptionImages]);
  const metadataCoverage = useMemo(() => percent(metadata?.completeGameCount ?? 0, database?.gameCount ?? 0), [database, metadata]);
  const issueCount = useMemo(() => {
    if (!database) return 0;
    return database.foreignKeyIssues
      + database.missingImageRefsCount
      + database.descriptionImages.missingLocalImageRefsCount
      + database.externalIds.duplicateExternalIdGroupsCount
      + database.pathStatus.brokenCount
      + database.cDriveImageRefsCount
      + database.playniteImageRefsCount;
  }, [database]);

  return (
    <PageShell>
      <PageFrame className="max-w-[88rem] gap-5">
        <PageHeader
          title="维护中心"
          description="本机数据健康、媒体覆盖、重复风险和清理动作。"
          actions={(
            <>
              {onOpenTasks && <Button variant="ghost" onClick={() => onOpenTasks()}><ListChecks className="h-4 w-4" />任务</Button>}
              <Button disabled={loading} onClick={loadDiagnostics}><RefreshCw className="h-4 w-4" />{loading ? '刷新中' : '刷新'}</Button>
            </>
          )}
        />

        {(error || message) && (
          <div className="space-y-2">
            {error && <Notice className="py-2" tone="error">{error}</Notice>}
            {message && <TaskNotice message={message.text} taskId={message.taskId} onOpenTask={onOpenTasks} />}
          </div>
        )}

        {diagnostics?.warnings.length ? (
          <Notice tone="warning">
            <div className="flex flex-col gap-1 text-xs leading-5">
              {diagnostics.warnings.slice(0, 6).map((warning) => <span key={warning}>{warning}</span>)}
              {diagnostics.warnings.length > 6 && <span>还有 {diagnostics.warnings.length - 6} 条警告。</span>}
            </div>
          </Notice>
        ) : diagnostics ? (
          <Notice>
            <span className="inline-flex items-center gap-2 text-xs"><CheckCircle2 className="h-4 w-4 text-emerald-200" />当前自检没有发现高优先级警告。</span>
          </Notice>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            detail={database ? `quick_check: ${database.quickCheck ?? 'unknown'}` : '等待自检'}
            icon={database?.quickCheckOk ? <ShieldCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            label="数据库"
            value={database ? database.quickCheckOk ? '正常' : '异常' : '未载入'}
          />
          <MetricTile
            detail={database ? `${formatCount(issueCount)} 个待关注项` : '等待自检'}
            icon={<Wrench className="h-4 w-4" />}
            label="维护状态"
            value={issueCount === 0 && database ? '干净' : formatCount(issueCount)}
          />
          <MetricTile
            detail={database ? `${formatCount(metadata?.completeGameCount ?? 0)} / ${formatCount(database.gameCount)} 条完整` : '等待自检'}
            icon={<Database className="h-4 w-4" />}
            label="元数据完整度"
            value={metadataCoverage}
          />
          <MetricTile
            detail={descriptionImages ? `${formatCount(descriptionImages.providerGamesWithImagesCount)} / ${formatCount(descriptionImages.providerGamesCount)} 个来源条目` : '等待自检'}
            icon={<Image className="h-4 w-4" />}
            label="简介图片覆盖"
            value={providerDescriptionCoverage}
          />
        </div>

        <Panel>
          <PanelHeader
            title="数据位置"
            description={diagnostics ? `来源：${dataDirSourceLabel(diagnostics.dataDirSource)}` : '当前 app-data 路径'}
            icon={<HardDrive className="h-4 w-4" />}
            actions={<Button disabled={cleanupLoading || !diagnostics?.databaseBackups.fileCount} size="sm" variant="ghost" onClick={cleanupDatabaseBackups}><Trash2 className="h-4 w-4" />{cleanupLoading ? '清理中' : '清理旧备份'}</Button>}
          />
          <PanelContent className="space-y-2">
            <PathRow label="数据目录" value={diagnostics?.appDataDir ?? '等待自检'} onReveal={diagnostics ? () => void revealPath(diagnostics.appDataDir) : undefined} />
            <PathRow label="数据库" value={database?.path ?? '等待自检'} onReveal={database ? () => void revealPath(database.path) : undefined} />
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <StorageStat label="图片缓存" path={diagnostics?.images.path} size={diagnostics?.images.totalBytes ?? 0} count={diagnostics?.images.fileCount ?? 0} onReveal={diagnostics ? () => void revealPath(diagnostics.images.path) : undefined} />
              <StorageStat label="日志" path={diagnostics?.logs.path} size={diagnostics?.logs.totalBytes ?? 0} count={diagnostics?.logs.fileCount ?? 0} onReveal={diagnostics ? () => void revealPath(diagnostics.logs.path) : undefined} />
              <StorageStat label="存档备份" path={diagnostics?.saveBackups.path} size={diagnostics?.saveBackups.totalBytes ?? 0} count={diagnostics?.saveBackups.fileCount ?? 0} onReveal={diagnostics ? () => void revealPath(diagnostics.saveBackups.path) : undefined} />
              <StorageStat label="数据库备份" path={diagnostics?.databaseBackups.rootPath} size={diagnostics?.databaseBackups.totalBytes ?? 0} count={diagnostics?.databaseBackups.fileCount ?? 0} onReveal={diagnostics ? () => void revealPath(diagnostics.databaseBackups.rootPath) : undefined} />
            </div>
          </PanelContent>
        </Panel>

        <div className="grid gap-5 xl:grid-cols-2">
          <Panel>
            <PanelHeader title="媒体与简介" description="封面、背景和简介图片的当前覆盖情况。" icon={<Image className="h-4 w-4" />} />
            <PanelContent className="space-y-4">
              <ProgressBlock label="DLsite / FANZA 简介图片" value={descriptionImages?.providerGamesWithImagesCount ?? 0} total={descriptionImages?.providerGamesCount ?? 0} />
              <div className="grid gap-2 sm:grid-cols-2">
                <CompactStat label="无简介图片" value={descriptionImages?.providerGamesWithoutImagesCount ?? 0} tone={(descriptionImages?.providerGamesWithoutImagesCount ?? 0) > 0 ? 'warn' : 'ok'} />
                <CompactStat label="空简介" value={descriptionImages?.providerGamesEmptyDescriptionCount ?? 0} tone={(descriptionImages?.providerGamesEmptyDescriptionCount ?? 0) > 0 ? 'warn' : 'ok'} />
                <CompactStat label="简介图片引用" value={descriptionImages?.imageRefsCount ?? 0} />
                <CompactStat label="缺失本地简介图" value={descriptionImages?.missingLocalImageRefsCount ?? 0} tone={(descriptionImages?.missingLocalImageRefsCount ?? 0) > 0 ? 'warn' : 'ok'} />
                <CompactStat label="缺封面" value={metadata?.missingCoverCount ?? 0} tone={(metadata?.missingCoverCount ?? 0) > 0 ? 'warn' : 'ok'} />
                <CompactStat label="缺背景" value={metadata?.missingBackgroundCount ?? 0} tone={(metadata?.missingBackgroundCount ?? 0) > 0 ? 'warn' : 'ok'} />
              </div>
            </PanelContent>
          </Panel>

          <Panel>
            <PanelHeader title="重复与完整度" description="外部 ID、基础元数据和路径状态。" icon={<Database className="h-4 w-4" />} />
            <PanelContent className="space-y-4">
              <ProgressBlock label="基础元数据完整" value={metadata?.completeGameCount ?? 0} total={database?.gameCount ?? 0} />
              <div className="grid gap-2 sm:grid-cols-2">
                <CompactStat label="需补元数据" value={metadata?.needsMetadataCount ?? 0} tone={(metadata?.needsMetadataCount ?? 0) > 0 ? 'warn' : 'ok'} />
                <CompactStat label="缺外部 ID" value={metadata?.missingExternalIdCount ?? 0} tone={(metadata?.missingExternalIdCount ?? 0) > 0 ? 'warn' : 'ok'} />
                <CompactStat label="重复 ID 组" value={externalIds?.duplicateExternalIdGroupsCount ?? 0} tone={(externalIds?.duplicateExternalIdGroupsCount ?? 0) > 0 ? 'warn' : 'ok'} />
                <CompactStat label="重复涉及游戏" value={externalIds?.duplicateExternalIdGamesCount ?? 0} tone={(externalIds?.duplicateExternalIdGamesCount ?? 0) > 0 ? 'warn' : 'ok'} />
                <CompactStat label="路径异常" value={pathStatus?.brokenCount ?? 0} tone={(pathStatus?.brokenCount ?? 0) > 0 ? 'warn' : 'ok'} />
                <CompactStat label="未检查路径" value={pathStatus?.uncheckedCount ?? 0} />
              </div>
            </PanelContent>
          </Panel>
        </div>

        <Panel>
          <PanelHeader title="维护队列" description="已落地的统计基础和下一批整理入口。" icon={<ListChecks className="h-4 w-4" />} />
          <PanelContent className="grid gap-2 xl:grid-cols-3">
            <MaintenanceAction
              action={(
                <Button disabled={descriptionRepairLoading || ((descriptionImages?.providerGamesWithoutImagesCount ?? 0) + (descriptionImages?.providerGamesEmptyDescriptionCount ?? 0)) === 0} size="sm" variant="secondary" onClick={startDescriptionImageRepair}>
                  <PlayCircle className="h-4 w-4" />{descriptionRepairLoading ? '创建中' : '开始'}
                </Button>
              )}
              detail={`${formatCount((descriptionImages?.providerGamesWithoutImagesCount ?? 0) + (descriptionImages?.providerGamesEmptyDescriptionCount ?? 0))} 个条目待补简介图片`}
              label="简介图片修复"
              status="可创建任务"
            />
            <MaintenanceAction
              action={(
                <Button disabled={duplicateAuditLoading || (externalIds?.duplicateExternalIdGroupsCount ?? 0) === 0} size="sm" variant="secondary" onClick={startDuplicateExternalIdAudit}>
                  <PlayCircle className="h-4 w-4" />{duplicateAuditLoading ? '创建中' : '开始'}
                </Button>
              )}
              detail={`${formatCount(externalIds?.duplicateExternalIdGroupsCount ?? 0)} 组重复外部 ID`}
              label="重复 ID 审查"
              status="可创建任务"
            />
            <MaintenanceAction
              action={(
                <Button disabled={metadataRepairLoading || (metadata?.needsMetadataCount ?? 0) === 0} size="sm" variant="secondary" onClick={startMetadataRepair}>
                  <PlayCircle className="h-4 w-4" />{metadataRepairLoading ? '创建中' : '开始'}
                </Button>
              )}
              detail={`${formatCount(metadata?.needsMetadataCount ?? 0)} 个条目可批量匹配元数据`}
              label="批量元数据匹配"
              status="可创建任务"
            />
          </PanelContent>
        </Panel>
      </PageFrame>
    </PageShell>
  );

  async function loadDiagnostics() {
    setLoading(true);
    setError(null);
    try {
      setDiagnostics(await api.getAppDataDiagnostics());
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }

  async function cleanupDatabaseBackups() {
    if (!window.confirm('按安全规则清理旧数据库备份？会保留最近 10 个和 30 天内备份，不会删除当前 mikavn.db。')) return;
    setCleanupLoading(true);
    setError(null);
    setMessage(null);
    try {
      const report = await api.cleanupOldDatabaseBackups({ retainCount: 10, retainDays: 30 });
      setMessage({ text: report.removedFiles > 0 ? `已清理 ${report.removedFiles} 个旧数据库备份，释放 ${formatBytes(report.removedBytes)}。` : '没有需要清理的旧数据库备份。' });
      await loadDiagnostics();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setCleanupLoading(false);
    }
  }

  async function startMetadataRepair() {
    setMetadataRepairLoading(true);
    setError(null);
    setMessage(null);
    try {
      const candidates = await api.listGames({ metadataStatus: 'needs_metadata', sortBy: 'updated_at', sortDirection: 'desc' });
      const gameIds = candidates.map((game) => game.id);
      if (gameIds.length === 0) {
        setMessage({ text: '没有需要批量匹配元数据的条目。' });
        await loadDiagnostics();
        return;
      }
      const job = await api.batchMatchMetadata(gameIds);
      const text = `已创建批量元数据匹配任务：${formatCount(gameIds.length)} 个条目。`;
      setMessage({ text, taskId: job.taskId ?? null });
      if (job.taskId) onOpenTasks?.(job.taskId);
      await loadDiagnostics();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setMetadataRepairLoading(false);
    }
  }

  async function startDescriptionImageRepair() {
    setDescriptionRepairLoading(true);
    setError(null);
    setMessage(null);
    try {
      const preview = await api.previewDescriptionImageRepair({ provider: 'all', limit: 20, maxImages: 3 });
      if (preview.totalCandidates === 0) {
        setMessage({ text: '没有需要修复简介图片的条目。' });
        await loadDiagnostics();
        return;
      }
      const task = await api.repairDescriptionImages({ provider: 'all', limit: 20, maxImages: 3 });
      setMessage({ text: `已创建简介图片修复任务：本轮 ${formatCount(preview.candidates.length)} 个条目。`, taskId: task.id });
      onOpenTasks?.(task.id);
      await loadDiagnostics();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setDescriptionRepairLoading(false);
    }
  }

  async function startDuplicateExternalIdAudit() {
    setDuplicateAuditLoading(true);
    setError(null);
    setMessage(null);
    try {
      const preview = await api.previewDuplicateExternalIds({ providers: ['all'], limit: 50 });
      if (preview.totalGroups === 0) {
        setMessage({ text: '没有发现重复外部 ID。' });
        await loadDiagnostics();
        return;
      }
      const task = await api.auditDuplicateExternalIds({ providers: ['all'], limit: 50 });
      setMessage({ text: `已创建重复 ID 审查任务：${formatCount(preview.totalGroups)} 组，涉及 ${formatCount(preview.totalGames)} 个游戏。`, taskId: task.id });
      onOpenTasks?.(task.id);
      await loadDiagnostics();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setDuplicateAuditLoading(false);
    }
  }

  async function revealPath(path: string) {
    setError(null);
    try {
      await api.revealPath(path);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }
}

function PathRow({ label, value, onReveal }: { label: string; value: string; onReveal?: () => void }) {
  return (
    <SoftRow className="grid gap-2 px-3 py-2 lg:grid-cols-[5rem_minmax(0,1fr)_auto]">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="min-w-0 break-all font-mono text-xs text-slate-300">{value}</div>
      {onReveal ? <Button aria-label={`打开${label}`} size="icon" title={`打开${label}`} variant="ghost" onClick={onReveal}><FolderOpen className="h-4 w-4" /></Button> : <span />}
    </SoftRow>
  );
}

function StorageStat({ label, count, size, path, onReveal }: { label: string; count: number; size: number; path?: string; onReveal?: () => void }) {
  return (
    <SoftRow className="flex items-start justify-between gap-3 px-3 py-2">
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="mt-1 font-mono text-sm text-slate-200">{formatCount(count)} · {formatBytes(size)}</div>
        {path && <div className="mt-1 truncate font-mono text-[11px] text-slate-600" title={path}>{path}</div>}
      </div>
      {onReveal && <Button aria-label={`打开${label}`} size="icon" title={`打开${label}`} variant="ghost" onClick={onReveal}><FolderOpen className="h-4 w-4" /></Button>}
    </SoftRow>
  );
}

function ProgressBlock({ label, value, total }: { label: string; value: number; total: number }) {
  const ratio = total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono text-slate-200">{formatCount(value)} / {formatCount(total)} · {percent(value, total)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/25">
        <div className="h-full rounded-full bg-[rgb(var(--accent-rgb))]" style={{ width: `${ratio}%` }} />
      </div>
    </div>
  );
}

function CompactStat({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'ok' | 'warn' }) {
  const toneClass = tone === 'ok' ? 'text-emerald-200' : tone === 'warn' ? 'text-amber-200' : 'text-slate-200';
  return (
    <div className="rounded-md border border-white/10 bg-black/[0.10] px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-sm ${toneClass}`}>{formatCount(value)}</div>
    </div>
  );
}

function MaintenanceAction({ action, label, detail, status }: { action?: ReactNode; label: string; detail: string; status: string }) {
  return (
    <SoftRow className="flex items-center justify-between gap-3 px-3 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-100">{label}</div>
        <div className="mt-1 text-xs text-slate-500">{detail}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge>{status}</Badge>
        {action}
      </div>
    </SoftRow>
  );
}

function formatCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? Math.round(size) : size.toFixed(size >= 10 ? 1 : 2)} ${units[unit]}`;
}

function percent(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

function dataDirSourceLabel(value: string) {
  if (value === 'env') return 'MIKAVN_APP_DATA_DIR';
  if (value === 'portable') return '应用旁 app-data';
  if (value === 'mock') return '浏览器预览';
  return '应用默认目录';
}
