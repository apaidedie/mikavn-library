import { AlertTriangle, CheckCircle2, Combine, Database, FolderOpen, HardDrive, Image, ListChecks, PlayCircle, RefreshCw, ShieldCheck, Trash2, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { MetricTile, PageFrame, PageHeader, PageShell, Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import { TaskNotice } from '@/components/ui/task-notice';
import { api } from '@/services/api';
import type { AppDataDiagnostics, ImageReferenceAudit, ImageReferenceAuditItem } from '@/types/archive';
import type { AssetCacheCleanupResult } from '@/types/game';
import type { ArtworkRepairDiagnosis, ArtworkRepairDiagnosisItem, DuplicateExternalIdGroup, DuplicateGameMergePreview } from '@/types/metadata';
import type { TaskDetail, TaskLogEntry, TaskRecord } from '@/types/task';
import { errorMessage } from '@/utils/errorMessage';
import { taskLabel, taskStatusClass, taskStatusLabel } from '@/utils/taskLabels';
import { formatDateTime } from '@/utils/time';
import { Select } from '@/components/ui/select';

type TaskMessage = { text: string; taskId?: string | null };
type ArtworkRepairLogStatus = 'updated' | 'skipped' | 'failed';
type ArtworkRepairLogSummary = {
  status: ArtworkRepairLogStatus;
  title: string;
  gameId?: string | null;
  message: string;
  fields?: string[];
  provider?: string | null;
  providerId?: string | null;
};
type ArtworkRepairTaskSummary = {
  task: TaskRecord;
  updated: ArtworkRepairLogSummary[];
  skipped: ArtworkRepairLogSummary[];
  failed: ArtworkRepairLogSummary[];
};

export function MaintenancePage({ refreshKey, focusSection, focusRequestKey = 0, onOpenGame, onOpenTasks }: { refreshKey: number; focusSection?: string | null; focusRequestKey?: number; onOpenGame?: (gameId: string) => void; onOpenTasks?: (taskId?: string | null) => void }) {
  const imageAuditRef = useRef<HTMLElement | null>(null);
  const handledFocusKeyRef = useRef<number | null>(null);
  const [diagnostics, setDiagnostics] = useState<AppDataDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [assetCleanupLoading, setAssetCleanupLoading] = useState(false);
  const [assetCleanupPreview, setAssetCleanupPreview] = useState<AssetCacheCleanupResult | null>(null);
  const [imageAudit, setImageAudit] = useState<ImageReferenceAudit | null>(null);
  const [imageAuditLoading, setImageAuditLoading] = useState(false);
  const [imageAuditQuery, setImageAuditQuery] = useState('');
  const [imageAuditIssueFilter, setImageAuditIssueFilter] = useState('all');
  const [artworkDiagnosis, setArtworkDiagnosis] = useState<ArtworkRepairDiagnosis | null>(null);
  const [artworkDiagnosisLoading, setArtworkDiagnosisLoading] = useState(false);
  const [artworkDiagnosisQuery, setArtworkDiagnosisQuery] = useState('');
  const [artworkDiagnosisStatusFilter, setArtworkDiagnosisStatusFilter] = useState('all');
  const [artworkHistory, setArtworkHistory] = useState<ArtworkRepairTaskSummary[] | null>(null);
  const [artworkHistoryLoading, setArtworkHistoryLoading] = useState(false);
  const [artworkHistoryQuery, setArtworkHistoryQuery] = useState('');
  const [artworkHistoryStatusFilter, setArtworkHistoryStatusFilter] = useState('all');
  const [metadataRepairLoading, setMetadataRepairLoading] = useState(false);
  const [descriptionRepairLoading, setDescriptionRepairLoading] = useState(false);
  const [artworkRepairLoading, setArtworkRepairLoading] = useState(false);
  const [duplicateAuditLoading, setDuplicateAuditLoading] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateExternalIdGroup[]>([]);
  const [duplicateGroupsLoading, setDuplicateGroupsLoading] = useState(false);
  const [duplicateGroupQuery, setDuplicateGroupQuery] = useState('');
  const [duplicateGroupProvider, setDuplicateGroupProvider] = useState('all');
  const [selectedDuplicateKey, setSelectedDuplicateKey] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergePreview, setMergePreview] = useState<DuplicateGameMergePreview | null>(null);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [message, setMessage] = useState<TaskMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [maintenanceTasks, setMaintenanceTasks] = useState<TaskRecord[]>([]);
  const [maintenanceTasksLoading, setMaintenanceTasksLoading] = useState(false);
  const [maintenanceTaskActionId, setMaintenanceTaskActionId] = useState<string | null>(null);

  useEffect(() => {
    void loadDiagnostics();
    void loadMaintenanceTasks();
  }, [refreshKey]);

  useEffect(() => {
    if (!maintenanceTasks.some(isActiveTask)) return;
    const timer = window.setInterval(() => void loadMaintenanceTasks({ quiet: true }), 2000);
    return () => window.clearInterval(timer);
  }, [maintenanceTasks]);

  useEffect(() => {
    if (focusSection !== 'image-audit' || handledFocusKeyRef.current === focusRequestKey) return;
    handledFocusKeyRef.current = focusRequestKey;
    window.requestAnimationFrame(() => {
      imageAuditRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    if (!imageAudit && !imageAuditLoading) {
      void loadImageAudit();
    }
  }, [focusRequestKey, focusSection, imageAudit, imageAuditLoading]);

  const database = diagnostics?.database;
  const metadata = database?.metadataCoverage;
  const descriptionImages = database?.descriptionImages;
  const externalIds = database?.externalIds;
  const pathStatus = database?.pathStatus;
  const missingArtworkFieldCount = (metadata?.missingCoverCount ?? 0) + (metadata?.missingBannerCount ?? 0) + (metadata?.missingBackgroundCount ?? 0);
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
  const filteredDuplicateGroups = useMemo(() => duplicateGroups.filter((group) => {
    const query = duplicateGroupQuery.trim().toLowerCase();
    const matchesProvider = duplicateGroupProvider === 'all' || group.provider === duplicateGroupProvider;
    const matchesQuery = !query
      || group.externalId.toLowerCase().includes(query)
      || group.provider.toLowerCase().includes(query)
      || group.games.some((game) => [game.title, game.installPath].some((value) => value.toLowerCase().includes(query)));
    return matchesProvider && matchesQuery;
  }), [duplicateGroupProvider, duplicateGroupQuery, duplicateGroups]);
  const filteredImageAuditItems = useMemo(
    () => imageAudit?.items.filter((item) => matchesImageAuditItem(item, imageAuditQuery, imageAuditIssueFilter)) ?? [],
    [imageAudit, imageAuditIssueFilter, imageAuditQuery]
  );
  const selectedDuplicateGroup = useMemo(() => filteredDuplicateGroups.find((group) => duplicateGroupKey(group) === selectedDuplicateKey) ?? filteredDuplicateGroups[0] ?? null, [filteredDuplicateGroups, selectedDuplicateKey]);
  const recommendedMergeTargetId = useMemo(() => recommendDuplicateMergeTarget(selectedDuplicateGroup), [selectedDuplicateGroup]);
  const mergeSourceIds = useMemo(() => selectedDuplicateGroup?.games.map((game) => game.gameId).filter((id) => id !== mergeTargetId) ?? [], [mergeTargetId, selectedDuplicateGroup]);
  const duplicateGroupFiltersActive = duplicateGroupQuery.trim().length > 0 || duplicateGroupProvider !== 'all';
  const maintenanceTaskSummary = useMemo(() => summarizeMaintenanceTasks(maintenanceTasks), [maintenanceTasks]);
  const filteredArtworkDiagnosisItems = useMemo(() => artworkDiagnosis?.items.filter((item) => matchesArtworkDiagnosisItem(item, artworkDiagnosisQuery, artworkDiagnosisStatusFilter)) ?? [], [artworkDiagnosis, artworkDiagnosisQuery, artworkDiagnosisStatusFilter]);
  const filteredArtworkHistory = useMemo(() => artworkHistory?.map((summary) => filterArtworkRepairSummary(summary, artworkHistoryQuery, artworkHistoryStatusFilter)).filter((summary) => summary.updated.length + summary.skipped.length + summary.failed.length > 0) ?? [], [artworkHistory, artworkHistoryQuery, artworkHistoryStatusFilter]);

  const resetDuplicateGroupFilters = () => {
    setDuplicateGroupQuery('');
    setDuplicateGroupProvider('all');
    setMergePreview(null);
  };

  const resetImageAuditFilters = () => {
    setImageAuditQuery('');
    setImageAuditIssueFilter('all');
  };

  const resetArtworkDiagnosisFilters = () => {
    setArtworkDiagnosisQuery('');
    setArtworkDiagnosisStatusFilter('all');
  };

  const resetArtworkHistoryFilters = () => {
    setArtworkHistoryQuery('');
    setArtworkHistoryStatusFilter('all');
  };

  useEffect(() => {
    if (!selectedDuplicateGroup) {
      setMergeTargetId('');
      setMergePreview(null);
      return;
    }
    if (!selectedDuplicateKey || !filteredDuplicateGroups.some((group) => duplicateGroupKey(group) === selectedDuplicateKey)) setSelectedDuplicateKey(duplicateGroupKey(selectedDuplicateGroup));
    if (!mergeTargetId || !selectedDuplicateGroup.games.some((game) => game.gameId === mergeTargetId)) {
      setMergeTargetId(recommendedMergeTargetId ?? selectedDuplicateGroup.games[0]?.gameId ?? '');
    }
    setMergePreview(null);
  }, [filteredDuplicateGroups, mergeTargetId, recommendedMergeTargetId, selectedDuplicateGroup, selectedDuplicateKey]);

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
            <SoftRow className="grid gap-3 px-3 py-3 xl:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-100">
                  <span>图片缓存清理</span>
                  <Badge>先预览</Badge>
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-500">只清理未被主图、媒体图库或简介本地图引用的 app-data/images 文件。</div>
                {assetCleanupPreview ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    <CompactStat label="扫描文件" value={assetCleanupPreview.scannedFiles} />
                    <CompactStat label="可清理" value={assetCleanupPreview.removedFiles} tone={assetCleanupPreview.removedFiles > 0 ? 'warn' : 'ok'} />
                    <CompactStat label="可释放" value={formatBytes(assetCleanupPreview.removedBytes)} tone={assetCleanupPreview.removedBytes > 0 ? 'warn' : 'ok'} />
                    <CompactStat label="保留文件" value={assetCleanupPreview.keptFiles} />
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-slate-600">预览会扫描图片缓存，不会删除文件。</div>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap items-start gap-2 xl:justify-end">
                <Button disabled={assetCleanupLoading || !diagnostics} size="sm" variant="outline" onClick={previewAssetCacheCleanup}><ShieldCheck className="h-4 w-4" />{assetCleanupLoading ? '检查中' : '预览'}</Button>
                <Button disabled={assetCleanupLoading || !diagnostics || (assetCleanupPreview ? assetCleanupPreview.removedFiles === 0 : false)} size="sm" variant="danger" onClick={cleanupAssetCache}><Trash2 className="h-4 w-4" />{assetCleanupLoading ? '处理中' : '清理'}</Button>
              </div>
            </SoftRow>
          </PanelContent>
        </Panel>

        <div className="grid gap-5 xl:grid-cols-2">
          <Panel>
            <PanelHeader title="媒体与简介" description="封面、横幅、背景和简介图片的当前覆盖情况。" icon={<Image className="h-4 w-4" />} />
            <PanelContent className="space-y-4">
              <ProgressBlock label="DLsite / FANZA 简介图片" value={descriptionImages?.providerGamesWithImagesCount ?? 0} total={descriptionImages?.providerGamesCount ?? 0} />
              <div className="grid gap-2 sm:grid-cols-2">
                <CompactStat label="无简介图片" value={descriptionImages?.providerGamesWithoutImagesCount ?? 0} tone={(descriptionImages?.providerGamesWithoutImagesCount ?? 0) > 0 ? 'warn' : 'ok'} />
                <CompactStat label="空简介" value={descriptionImages?.providerGamesEmptyDescriptionCount ?? 0} tone={(descriptionImages?.providerGamesEmptyDescriptionCount ?? 0) > 0 ? 'warn' : 'ok'} />
                <CompactStat label="简介图片引用" value={descriptionImages?.imageRefsCount ?? 0} />
                <CompactStat label="缺失本地简介图" value={descriptionImages?.missingLocalImageRefsCount ?? 0} tone={(descriptionImages?.missingLocalImageRefsCount ?? 0) > 0 ? 'warn' : 'ok'} />
                <CompactStat label="缺封面" value={metadata?.missingCoverCount ?? 0} tone={(metadata?.missingCoverCount ?? 0) > 0 ? 'warn' : 'ok'} />
                <CompactStat label="缺横幅" value={metadata?.missingBannerCount ?? 0} tone={(metadata?.missingBannerCount ?? 0) > 0 ? 'warn' : 'ok'} />
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
          <PanelHeader
            title="媒体补全诊断"
            description="在创建补图任务前，查看缺图条目为什么能补或补不了。"
            icon={<Image className="h-4 w-4" />}
            actions={<Button disabled={artworkDiagnosisLoading || missingArtworkFieldCount === 0} size="sm" variant="ghost" onClick={loadArtworkDiagnosis}><ListChecks className="h-4 w-4" />{artworkDiagnosisLoading ? '读取中' : '读取诊断'}</Button>}
          />
          <PanelContent className="space-y-3">
            {artworkDiagnosis ? (
              <>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  <CompactStat label="缺图游戏" value={artworkDiagnosis.totalMissingGames} tone={artworkDiagnosis.totalMissingGames > 0 ? 'warn' : 'ok'} />
                  <CompactStat label="缺图字段" value={artworkDiagnosis.totalMissingFields} tone={artworkDiagnosis.totalMissingFields > 0 ? 'warn' : 'ok'} />
                  <CompactStat label="可补全" value={artworkDiagnosis.repairableCount} tone={artworkDiagnosis.repairableCount > 0 ? 'ok' : 'neutral'} />
                  <CompactStat label="缺外部 ID" value={artworkDiagnosis.missingExternalIdCount} tone={artworkDiagnosis.missingExternalIdCount > 0 ? 'warn' : 'ok'} />
                  <CompactStat label="来源异常" value={artworkDiagnosis.noRemoteImageCount + artworkDiagnosis.providerErrorCount} tone={(artworkDiagnosis.noRemoteImageCount + artworkDiagnosis.providerErrorCount) > 0 ? 'warn' : 'ok'} />
                </div>
                <SoftRow className="grid gap-2 px-3 py-3 md:grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)_auto] md:items-end">
                  <label className="min-w-0 text-xs text-slate-500">
                    搜索诊断结果
                    <Input aria-label="媒体补全诊断搜索" className="mt-1 w-full" placeholder="游戏 / ID / 字段 / 来源 / 原因" value={artworkDiagnosisQuery} onChange={(event) => setArtworkDiagnosisQuery(event.target.value)} />
                  </label>
                  <label className="min-w-0 text-xs text-slate-500">
                    诊断状态
                    <Select aria-label="媒体补全诊断状态筛选" className="mt-1 w-full" value={artworkDiagnosisStatusFilter} onChange={(event) => setArtworkDiagnosisStatusFilter(event.target.value)}>
                      <option value="all">全部状态</option>
                      <option value="repairable">可补全</option>
                      <option value="missing_external_id">缺外部 ID</option>
                      <option value="no_remote_image">远程无图</option>
                      <option value="provider_error">来源失败</option>
                    </Select>
                  </label>
                  <Button className="h-9" disabled={!artworkDiagnosisQuery.trim() && artworkDiagnosisStatusFilter === 'all'} size="sm" variant="outline" onClick={resetArtworkDiagnosisFilters}>重置筛选</Button>
                </SoftRow>
                {artworkDiagnosis.items.length > 0 ? (
                  <div className="space-y-2">
                    <div className="px-1 text-xs text-slate-500">当前显示 {formatCount(filteredArtworkDiagnosisItems.length)} / {formatCount(artworkDiagnosis.items.length)} 个诊断条目。</div>
                    {filteredArtworkDiagnosisItems.length > 0 ? filteredArtworkDiagnosisItems.map((item) => <ArtworkDiagnosisRow item={item} key={item.gameId} onOpenGame={onOpenGame} />) : <SoftRow className="px-3 py-3 text-sm text-slate-400">当前筛选没有匹配的媒体补全诊断。</SoftRow>}
                    {artworkDiagnosis.truncated && <div className="px-1 text-xs text-slate-500">结果较多，当前只诊断前 {formatCount(artworkDiagnosis.diagnosedGames)} 个缺图游戏。</div>}
                  </div>
                ) : (
                  <SoftRow className="px-3 py-3 text-sm text-slate-400">没有发现需要诊断的缺图条目。</SoftRow>
                )}
              </>
            ) : (
              <SoftRow className="flex items-center justify-between gap-3 px-3 py-3">
                <div className="min-w-0 text-sm text-slate-400">读取后会检查前 50 个缺图游戏，列出缺字段、外部 ID 和来源图片状态。</div>
                <Button disabled={artworkDiagnosisLoading || missingArtworkFieldCount === 0} size="sm" variant="secondary" onClick={loadArtworkDiagnosis}><ListChecks className="h-4 w-4" />读取</Button>
              </SoftRow>
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader
            title="媒体补全结果"
            description="汇总最近媒体图片补全任务的成功、跳过和失败明细。"
            icon={<ListChecks className="h-4 w-4" />}
            actions={<Button disabled={artworkHistoryLoading} size="sm" variant="ghost" onClick={loadArtworkHistory}><RefreshCw className="h-4 w-4" />{artworkHistoryLoading ? '读取中' : '读取结果'}</Button>}
          />
          <PanelContent className="space-y-3">
            {artworkHistory ? (
              artworkHistory.length > 0 ? (
                <div className="space-y-3">
                  <SoftRow className="grid gap-2 px-3 py-3 md:grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)_auto] md:items-end">
                    <label className="min-w-0 text-xs text-slate-500">
                      搜索补全结果
                      <Input aria-label="媒体补全结果搜索" className="mt-1 w-full" placeholder="游戏 / ID / 字段 / 原因 / 来源" value={artworkHistoryQuery} onChange={(event) => setArtworkHistoryQuery(event.target.value)} />
                    </label>
                    <label className="min-w-0 text-xs text-slate-500">
                      结果状态
                      <Select aria-label="媒体补全结果状态筛选" className="mt-1 w-full" value={artworkHistoryStatusFilter} onChange={(event) => setArtworkHistoryStatusFilter(event.target.value)}>
                        <option value="all">全部结果</option>
                        <option value="updated">已补全</option>
                        <option value="skipped">跳过</option>
                        <option value="failed">失败</option>
                      </Select>
                    </label>
                    <Button className="h-9" disabled={!artworkHistoryQuery.trim() && artworkHistoryStatusFilter === 'all'} size="sm" variant="outline" onClick={resetArtworkHistoryFilters}>重置筛选</Button>
                  </SoftRow>
                  <div className="px-1 text-xs text-slate-500">当前显示 {formatCount(filteredArtworkHistory.reduce((count, summary) => count + summary.updated.length + summary.skipped.length + summary.failed.length, 0))} / {formatCount(artworkHistory.reduce((count, summary) => count + summary.updated.length + summary.skipped.length + summary.failed.length, 0))} 条补图明细。</div>
                  {filteredArtworkHistory.length > 0 ? filteredArtworkHistory.map((summary) => <ArtworkRepairTaskRow key={summary.task.id} onOpenGame={onOpenGame} onOpenTask={onOpenTasks} summary={summary} />) : <SoftRow className="px-3 py-3 text-sm text-slate-400">当前筛选没有匹配的媒体补全结果。</SoftRow>}
                </div>
              ) : (
                <SoftRow className="px-3 py-3 text-sm text-slate-400">还没有媒体图片补全任务记录。</SoftRow>
              )
            ) : (
              <SoftRow className="flex items-center justify-between gap-3 px-3 py-3">
                <div className="min-w-0 text-sm text-slate-400">读取后会解析最近 5 个媒体补全任务日志，展示成功、跳过和失败原因。</div>
                <Button disabled={artworkHistoryLoading} size="sm" variant="secondary" onClick={loadArtworkHistory}><ListChecks className="h-4 w-4" />读取</Button>
              </SoftRow>
            )}
          </PanelContent>
        </Panel>

        <Panel ref={imageAuditRef}>
          <PanelHeader
            title="图片引用问题"
            description="定位缺失、C 盘残留和 Playnite 残留图片引用。"
            icon={<Image className="h-4 w-4" />}
            actions={<Button disabled={imageAuditLoading || !diagnostics} size="sm" variant="ghost" onClick={loadImageAudit}><ListChecks className="h-4 w-4" />{imageAuditLoading ? '读取中' : '读取明细'}</Button>}
          />
          <PanelContent className="space-y-3">
            {imageAudit ? (
              <>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  <CompactStat label="图片引用" value={imageAudit.totalRefs} />
                  <CompactStat label="问题引用" value={imageAudit.issueCount} tone={imageAudit.issueCount > 0 ? 'warn' : 'ok'} />
                  <CompactStat label="缺失本地文件" value={imageAudit.missingCount} tone={imageAudit.missingCount > 0 ? 'warn' : 'ok'} />
                  <CompactStat label="C 盘残留" value={imageAudit.cDriveCount} tone={imageAudit.cDriveCount > 0 ? 'warn' : 'ok'} />
                  <CompactStat label="Playnite 残留" value={imageAudit.playniteCount} tone={imageAudit.playniteCount > 0 ? 'warn' : 'ok'} />
                </div>
                <SoftRow className="grid gap-2 px-3 py-3 md:grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)_auto] md:items-end">
                  <label className="min-w-0 text-xs text-slate-500">
                    搜索图片引用
                    <Input aria-label="图片引用搜索" className="mt-1 w-full" placeholder="游戏 / 字段 / 路径 / 问题" value={imageAuditQuery} onChange={(event) => setImageAuditQuery(event.target.value)} />
                  </label>
                  <label className="min-w-0 text-xs text-slate-500">
                    问题类型
                    <Select aria-label="图片引用问题筛选" className="mt-1 w-full" value={imageAuditIssueFilter} onChange={(event) => setImageAuditIssueFilter(event.target.value)}>
                      <option value="all">全部问题</option>
                      <option value="missing">缺失本地文件</option>
                      <option value="c_drive">C 盘残留</option>
                      <option value="playnite">Playnite 残留</option>
                    </Select>
                  </label>
                  <Button className="h-9" disabled={!imageAuditQuery.trim() && imageAuditIssueFilter === 'all'} size="sm" variant="outline" onClick={resetImageAuditFilters}>重置筛选</Button>
                </SoftRow>
                {imageAudit.items.length > 0 ? (
                  <div className="space-y-2">
                    <div className="px-1 text-xs text-slate-500">当前显示 {formatCount(filteredImageAuditItems.length)} / {formatCount(imageAudit.items.length)} 条引用。</div>
                    {filteredImageAuditItems.length > 0 ? filteredImageAuditItems.map((item, index) => <ImageAuditRow item={item} key={`${item.gameId ?? 'game'}-${item.sourceKind}-${item.fieldName ?? 'field'}-${item.value}-${index}`} />) : <SoftRow className="px-3 py-3 text-sm text-slate-400">当前筛选没有匹配的图片引用。</SoftRow>}
                    {imageAudit.truncated && <div className="px-1 text-xs text-slate-500">结果较多，当前只显示前 80 条问题引用。</div>}
                  </div>
                ) : (
                  <SoftRow className="px-3 py-3 text-sm text-slate-400">没有发现需要处理的图片引用。</SoftRow>
                )}
              </>
            ) : (
              <SoftRow className="flex items-center justify-between gap-3 px-3 py-3">
                <div className="min-w-0 text-sm text-slate-400">读取后会列出具体游戏、来源字段、原始路径和已解析到的文件路径。</div>
                <Button disabled={imageAuditLoading || !diagnostics} size="sm" variant="secondary" onClick={loadImageAudit}><ListChecks className="h-4 w-4" />读取</Button>
              </SoftRow>
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader
            title="重复游戏安全合并"
            description="只允许合并共享外部 ID 的条目，执行前会预览搬迁数据。"
            icon={<Combine className="h-4 w-4" />}
            actions={<Button disabled={duplicateGroupsLoading} size="sm" variant="ghost" onClick={() => loadDuplicateGroups()}><RefreshCw className="h-4 w-4" />{duplicateGroupsLoading ? '读取中' : '读取重复组'}</Button>}
          />
          <PanelContent className="space-y-3">
            {duplicateGroups.length === 0 ? (
              <SoftRow className="flex items-center justify-between gap-3 px-3 py-3">
                <div className="min-w-0 text-sm text-slate-400">还没有载入重复组。先读取重复组，或运行重复 ID 审查后再回来处理。</div>
                <Button disabled={duplicateGroupsLoading || (externalIds?.duplicateExternalIdGroupsCount ?? 0) === 0} size="sm" variant="secondary" onClick={() => loadDuplicateGroups()}><ListChecks className="h-4 w-4" />读取</Button>
              </SoftRow>
            ) : (
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <div className="space-y-2">
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(8rem,12rem)_auto] md:items-end">
                    <label className="min-w-0 text-xs text-slate-500">
                      搜索重复组
                      <Input aria-label="重复组搜索" className="mt-1 w-full" placeholder="标题 / 路径 / 外部 ID" value={duplicateGroupQuery} onChange={(event) => { setDuplicateGroupQuery(event.target.value); setMergePreview(null); }} />
                    </label>
                    <label className="min-w-0 text-xs text-slate-500">
                      来源筛选
                      <Select aria-label="重复组来源筛选" className="mt-1 w-full" value={duplicateGroupProvider} onChange={(event) => { setDuplicateGroupProvider(event.target.value); setMergePreview(null); }}>
                        <option value="all">全部来源</option>
                        <option value="vndb">VNDB</option>
                        <option value="dlsite">DLsite</option>
                        <option value="fanza">FANZA</option>
                        <option value="bangumi">Bangumi</option>
                        <option value="ymgal">YMGal</option>
                      </Select>
                    </label>
                    <Button className="h-9" disabled={!duplicateGroupFiltersActive} size="sm" variant="outline" onClick={resetDuplicateGroupFilters}>重置筛选</Button>
                  </div>
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)]">
                    <label className="min-w-0 text-xs text-slate-500">
                      重复组 · {formatCount(filteredDuplicateGroups.length)} / {formatCount(duplicateGroups.length)}
                      <Select className="mt-1 w-full" disabled={filteredDuplicateGroups.length === 0} value={selectedDuplicateKey} onChange={(event) => { setSelectedDuplicateKey(event.target.value); setMergePreview(null); }}>
                        {filteredDuplicateGroups.map((group) => (
                          <option key={duplicateGroupKey(group)} value={duplicateGroupKey(group)}>{group.provider} {group.externalId} · {group.gameCount} 条</option>
                        ))}
                      </Select>
                    </label>
                    <label className="min-w-0 text-xs text-slate-500">
                      保留为目标
                      <Select className="mt-1 w-full" value={mergeTargetId} onChange={(event) => { setMergeTargetId(event.target.value); setMergePreview(null); }}>
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
                          <div className="mt-1 break-all font-mono text-[11px] text-slate-600">{game.installPath}</div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2 text-right text-[11px] text-slate-500">
                          <span>{game.sources.join(' / ')}</span>
                          {game.gameId !== mergeTargetId && <Button className="h-7 px-2" size="sm" variant="ghost" onClick={() => { setMergeTargetId(game.gameId); setMergePreview(null); }}>设为保留</Button>}
                        </div>
                      </SoftRow>
                    ))}
                  </div>}
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button disabled={mergeLoading || !mergeTargetId || mergeSourceIds.length === 0} size="sm" variant="secondary" onClick={previewDuplicateMerge}><ShieldCheck className="h-4 w-4" />{mergeLoading && !mergePreview ? '预览中' : '预览合并'}</Button>
                    <Button disabled={mergeLoading || !mergePreview || mergeSourceIds.length === 0} size="sm" variant="danger" onClick={mergeDuplicateGroup}><Combine className="h-4 w-4" />{mergeLoading && mergePreview ? '合并中' : '确认合并'}</Button>
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

        <Panel>
          <PanelHeader
            title="最近维护任务"
            description="只汇总批量匹配、简介修复、媒体补图和重复 ID 审查。"
            icon={<ListChecks className="h-4 w-4" />}
            actions={<Button disabled={maintenanceTasksLoading} size="sm" variant="ghost" onClick={() => void loadMaintenanceTasks()}><RefreshCw className="h-4 w-4" />{maintenanceTasksLoading ? '读取中' : '刷新任务'}</Button>}
          />
          <PanelContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <CompactStat label="维护任务" value={maintenanceTasks.length} />
              <CompactStat label="进行中" value={maintenanceTaskSummary.activeCount} tone={maintenanceTaskSummary.activeCount > 0 ? 'warn' : 'ok'} />
              <CompactStat label="需处理" value={maintenanceTaskSummary.attentionCount} tone={maintenanceTaskSummary.attentionCount > 0 ? 'warn' : 'ok'} />
              <CompactStat label="已完成" value={maintenanceTaskSummary.completedCount} tone={maintenanceTaskSummary.completedCount > 0 ? 'ok' : 'neutral'} />
            </div>
            {maintenanceTasks.length > 0 ? (
              <div className="space-y-2">
                {maintenanceTasks.map((task) => (
                  <MaintenanceTaskRow
                    actionBusy={maintenanceTaskActionId === task.id}
                    key={task.id}
                    onCancelTask={cancelMaintenanceTask}
                    onOpenTask={onOpenTasks}
                    onRetryTask={retryMaintenanceTask}
                    task={task}
                  />
                ))}
              </div>
            ) : (
              <SoftRow className="px-3 py-3 text-sm text-slate-400">还没有维护任务记录。创建批量匹配、简介修复、媒体补图或重复 ID 审查后会显示在这里。</SoftRow>
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader title="维护队列" description="已落地的统计基础和下一批整理入口。" icon={<ListChecks className="h-4 w-4" />} />
          <PanelContent className="grid gap-2 xl:grid-cols-4">
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
                <Button disabled={artworkRepairLoading || missingArtworkFieldCount === 0} size="sm" variant="secondary" onClick={startArtworkRepair}>
                  <PlayCircle className="h-4 w-4" />{artworkRepairLoading ? '创建中' : '开始'}
                </Button>
              )}
              detail={`${formatCount(missingArtworkFieldCount)} 个媒体字段待补`}
              label="媒体图片补全"
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

  async function loadMaintenanceTasks(options?: { quiet?: boolean }) {
    if (!options?.quiet) setMaintenanceTasksLoading(true);
    try {
      const tasks = (await api.listTasks(100)).filter(isMaintenanceTask).slice(0, 8);
      setMaintenanceTasks(tasks);
    } catch (reason) {
      if (!options?.quiet) setError(errorMessage(reason));
    } finally {
      if (!options?.quiet) setMaintenanceTasksLoading(false);
    }
  }

  async function retryMaintenanceTask(id: string) {
    setMaintenanceTaskActionId(id);
    setError(null);
    try {
      const task = await api.retryTask(id);
      setMessage({ text: `已重新创建维护任务：${taskLabel(task.taskType)}。`, taskId: task.id });
      await loadMaintenanceTasks({ quiet: true });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setMaintenanceTaskActionId(null);
    }
  }

  async function cancelMaintenanceTask(id: string) {
    setMaintenanceTaskActionId(id);
    setError(null);
    try {
      const task = await api.cancelTask(id);
      setMessage({ text: `已取消维护任务：${taskLabel(task.taskType)}。`, taskId: task.id });
      await loadMaintenanceTasks({ quiet: true });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setMaintenanceTaskActionId(null);
    }
  }

  async function loadImageAudit() {
    setImageAuditLoading(true);
    setError(null);
    try {
      const audit = await api.auditImageReferences({ limit: 80, includeOk: false });
      setImageAudit(audit);
      setMessage({ text: audit.issueCount > 0 ? `图片引用审计完成：发现 ${formatCount(audit.issueCount)} 条问题引用。` : '图片引用审计完成，没有发现问题引用。' });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setImageAuditLoading(false);
    }
  }

  async function loadArtworkDiagnosis() {
    setArtworkDiagnosisLoading(true);
    setError(null);
    try {
      const diagnosis = await api.diagnoseArtworkRepair({ providers: ['all'], fields: ['cover', 'banner', 'background'], limit: 50 });
      setArtworkDiagnosis(diagnosis);
      setMessage({ text: diagnosis.totalMissingGames > 0 ? `媒体补全诊断完成：${formatCount(diagnosis.repairableCount)} 个可补全，${formatCount(diagnosis.missingExternalIdCount)} 个缺外部 ID。` : '媒体补全诊断完成，没有发现缺图条目。' });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setArtworkDiagnosisLoading(false);
    }
  }

  async function loadArtworkHistory() {
    setArtworkHistoryLoading(true);
    setError(null);
    try {
      const tasks = (await api.listTasks(100)).filter((task) => task.taskType === 'metadata.artwork_repair').slice(0, 5);
      const summaries = await Promise.all(tasks.map(async (task) => summarizeArtworkRepairTask(await api.getTaskDetail(task.id))));
      setArtworkHistory(summaries);
      setMessage({ text: summaries.length > 0 ? `已读取 ${formatCount(summaries.length)} 个媒体补全任务结果。` : '还没有媒体图片补全任务记录。' });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setArtworkHistoryLoading(false);
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

  async function previewAssetCacheCleanup() {
    setAssetCleanupLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.previewAssetCacheCleanup();
      setAssetCleanupPreview(result);
      setMessage({ text: result.removedFiles > 0 ? `图片缓存预览完成：可清理 ${formatCount(result.removedFiles)} 个文件，预计释放 ${formatBytes(result.removedBytes)}。` : '图片缓存预览完成，没有发现可清理文件。' });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setAssetCleanupLoading(false);
    }
  }

  async function cleanupAssetCache() {
    setError(null);
    setMessage(null);
    let preview = assetCleanupPreview;
    if (!preview) {
      setAssetCleanupLoading(true);
      try {
        preview = await api.previewAssetCacheCleanup();
        setAssetCleanupPreview(preview);
      } catch (reason) {
        setError(errorMessage(reason));
        setAssetCleanupLoading(false);
        return;
      }
      setAssetCleanupLoading(false);
    }

    if (preview.removedFiles === 0) {
      setMessage({ text: '没有需要清理的图片缓存文件。' });
      return;
    }
    if (!window.confirm(`清理 ${formatCount(preview.removedFiles)} 个未引用图片缓存文件，预计释放 ${formatBytes(preview.removedBytes)}？`)) return;

    setAssetCleanupLoading(true);
    try {
      const result = await api.cleanupAssetCache();
      setMessage({ text: result.removedFiles > 0 ? `已清理 ${formatCount(result.removedFiles)} 个图片缓存文件，释放 ${formatBytes(result.removedBytes)}。` : '没有需要清理的图片缓存文件。' });
      setAssetCleanupPreview(await api.previewAssetCacheCleanup());
      await loadDiagnostics();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setAssetCleanupLoading(false);
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
      await loadMaintenanceTasks({ quiet: true });
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
      await loadMaintenanceTasks({ quiet: true });
      onOpenTasks?.(task.id);
      await loadDiagnostics();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setDescriptionRepairLoading(false);
    }
  }

  async function startArtworkRepair() {
    setArtworkRepairLoading(true);
    setError(null);
    setMessage(null);
    try {
      const options = { providers: ['all'], fields: ['cover', 'banner', 'background'], limit: 20 };
      const preview = await api.previewArtworkRepair(options);
      if (preview.totalCandidates === 0) {
        setMessage({ text: '没有可补全媒体图片的条目。' });
        await loadDiagnostics();
        return;
      }
      const task = await api.repairArtwork(options);
      setMessage({ text: `已创建媒体图片补全任务：本轮 ${formatCount(preview.candidates.length)} 个条目，${formatCount(preview.totalMissingFields)} 个字段。`, taskId: task.id });
      await loadMaintenanceTasks({ quiet: true });
      onOpenTasks?.(task.id);
      await loadDiagnostics();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setArtworkRepairLoading(false);
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
      await loadMaintenanceTasks({ quiet: true });
      onOpenTasks?.(task.id);
      await loadDiagnostics();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setDuplicateAuditLoading(false);
    }
  }

  async function loadDuplicateGroups(announceEmpty = true) {
    setDuplicateGroupsLoading(true);
    setError(null);
    try {
      const preview = await api.previewDuplicateExternalIds({ providers: ['all'], limit: 50 });
      setDuplicateGroups(preview.groups);
      const first = preview.groups[0] ?? null;
      setSelectedDuplicateKey(first ? duplicateGroupKey(first) : '');
      setMergeTargetId(first?.games[0]?.gameId ?? '');
      setMergePreview(null);
      if (announceEmpty && preview.totalGroups === 0) setMessage({ text: '没有发现可合并的重复外部 ID 组。' });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setDuplicateGroupsLoading(false);
    }
  }

  async function previewDuplicateMerge() {
    if (!selectedDuplicateGroup || !mergeTargetId || mergeSourceIds.length === 0) return;
    setMergeLoading(true);
    setError(null);
    setMessage(null);
    try {
      const preview = await api.previewDuplicateGameMerge({ targetGameId: mergeTargetId, sourceGameIds: mergeSourceIds });
      setMergePreview(preview);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setMergeLoading(false);
    }
  }

  async function mergeDuplicateGroup() {
    if (!mergePreview || !selectedDuplicateGroup || !mergeTargetId || mergeSourceIds.length === 0) return;
    const target = selectedDuplicateGroup.games.find((game) => game.gameId === mergeTargetId);
    if (!window.confirm(`把 ${mergeSourceIds.length} 条重复游戏并入「${target?.title ?? mergeTargetId}」？源游戏记录会删除，但关联数据会先迁移。`)) return;
    setMergeLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.mergeDuplicateGames({ targetGameId: mergeTargetId, sourceGameIds: mergeSourceIds });
      const successText = `已合并重复游戏：删除 ${formatCount(result.deletedSourceGameIds.length)} 条源记录，保留「${result.mergedGame.title}」。`;
      setMessage({ text: successText });
      setMergePreview(null);
      await loadDiagnostics();
      await loadDuplicateGroups(false);
      setMessage({ text: successText });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setMergeLoading(false);
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

function ImageAuditRow({ item }: { item: ImageReferenceAuditItem }) {
  const title = item.gameTitle?.trim() || item.gameId || '未知游戏';
  const issues = item.issues.length > 0 ? item.issues : [item.status];
  return (
    <SoftRow className="grid gap-3 px-3 py-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-slate-100" title={title}>{title}</span>
          <Badge>{item.sourceLabel}</Badge>
          {item.fieldName && <Badge>{imageFieldLabel(item.fieldName)}</Badge>}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {issues.map((issue) => <Badge className={imageBadgeClass(issue)} key={issue}>{imageIssueLabel(issue)}</Badge>)}
        </div>
      </div>
      <div className="min-w-0 space-y-1 text-[11px] leading-5">
        <div className="grid gap-1 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
          <span className="text-slate-600">原始值</span>
          <span className="break-all font-mono text-slate-300">{item.value}</span>
        </div>
        {item.resolvedPath && (
          <div className="grid gap-1 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
            <span className="text-slate-600">解析路径</span>
            <span className="break-all font-mono text-slate-500">{item.resolvedPath}</span>
          </div>
        )}
      </div>
    </SoftRow>
  );
}

function matchesImageAuditItem(item: ImageReferenceAuditItem, query: string, issueFilter: string) {
  const issues = item.issues.length > 0 ? item.issues : [item.status];
  const matchesIssue = issueFilter === 'all' || issues.includes(issueFilter);
  const value = query.trim().toLowerCase();
  const searchableValues = [
    item.gameId,
    item.gameTitle,
    item.sourceKind,
    item.sourceLabel,
    item.fieldName,
    item.fieldName ? imageFieldLabel(item.fieldName) : '',
    item.value,
    item.resolvedPath,
    item.status,
    imageIssueLabel(item.status),
    ...issues,
    ...issues.map(imageIssueLabel),
  ];
  const matchesQuery = !value || searchableValues.some((text) => String(text ?? '').toLowerCase().includes(value));
  return matchesIssue && matchesQuery;
}

function ArtworkDiagnosisRow({ item, onOpenGame }: { item: ArtworkRepairDiagnosisItem; onOpenGame?: (gameId: string) => void }) {
  return (
    <SoftRow className="grid gap-3 px-3 py-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-slate-100" title={item.title}>{item.title}</span>
          <Badge className={artworkStatusBadgeClass(item.status)}>{artworkStatusLabel(item.status)}</Badge>
          {onOpenGame && <Button className="h-7 px-2" size="sm" variant="ghost" onClick={() => onOpenGame(item.gameId)}>游戏</Button>}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.missingFields.map((field) => <Badge key={field}>{artworkFieldLabel(field)}</Badge>)}
        </div>
        <div className="mt-2 text-xs leading-5 text-slate-500">{item.reason}</div>
      </div>
      <div className="min-w-0 space-y-2 text-[11px] leading-5">
        {item.providerResults.length > 0 ? item.providerResults.map((result) => (
          <div className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)]" key={`${result.provider}:${result.providerId}`}>
            <span className="text-slate-600">{providerLabel(result.provider)} {result.providerId}</span>
            <span className="min-w-0">
              <Badge className={artworkProviderBadgeClass(result.status)}>{artworkProviderStatusLabel(result.status)}</Badge>
              {result.imageUrl && <span className="ml-2 break-all font-mono text-slate-500">{result.imageUrl}</span>}
              {result.reason && <span className="ml-2 break-all text-slate-500">{result.reason}</span>}
            </span>
          </div>
        )) : (
          <div className="text-xs text-slate-500">没有可用外部 ID。</div>
        )}
      </div>
    </SoftRow>
  );
}

function matchesArtworkDiagnosisItem(item: ArtworkRepairDiagnosisItem, query: string, statusFilter: string) {
  if (statusFilter !== 'all' && item.status !== statusFilter) return false;
  const value = query.trim().toLowerCase();
  if (!value) return true;
  return [
    item.gameId,
    item.title,
    item.status,
    artworkStatusLabel(item.status),
    item.reason,
    ...item.missingFields,
    ...item.missingFields.map(artworkFieldLabel),
    ...item.providers.flatMap((provider) => [provider.provider, providerLabel(provider.provider), provider.providerId]),
    ...item.providerResults.flatMap((result) => [result.provider, providerLabel(result.provider), result.providerId, result.status, artworkProviderStatusLabel(result.status), result.reason, result.imageUrl]),
  ].some((text) => String(text ?? '').toLowerCase().includes(value));
}

function ArtworkRepairTaskRow({ summary, onOpenGame, onOpenTask }: { summary: ArtworkRepairTaskSummary; onOpenGame?: (gameId: string) => void; onOpenTask?: (taskId?: string | null) => void }) {
  const task = summary.task;
  const detailItems = [...summary.failed, ...summary.skipped, ...summary.updated].slice(0, 8);
  const hiddenCount = summary.updated.length + summary.skipped.length + summary.failed.length - detailItems.length;

  return (
    <SoftRow className="space-y-3 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-100">{task.message || '媒体图片补全任务'}</span>
            <Badge className={taskStatusClass(task.status)}>{taskStatusLabel(task.status)}</Badge>
          </div>
          <div className="mt-1 text-xs text-slate-500">更新于 {formatDateTime(task.updatedAt)}</div>
          {task.error && <div className="mt-2 break-all text-xs text-rose-200">{task.error}</div>}
        </div>
        {onOpenTask && <Button size="sm" variant="ghost" onClick={() => onOpenTask(task.id)}>日志</Button>}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <CompactStat label="已补全" value={summary.updated.length} tone={summary.updated.length > 0 ? 'ok' : 'neutral'} />
        <CompactStat label="跳过" value={summary.skipped.length} tone={summary.skipped.length > 0 ? 'warn' : 'ok'} />
        <CompactStat label="失败" value={summary.failed.length} tone={summary.failed.length > 0 ? 'warn' : 'ok'} />
      </div>
      {detailItems.length > 0 ? (
        <div className="space-y-2">
          {detailItems.map((item, index) => <ArtworkRepairLogRow item={item} key={`${item.status}-${item.gameId ?? item.title}-${index}`} onOpenGame={onOpenGame} />)}
          {hiddenCount > 0 && <div className="px-1 text-xs text-slate-500">还有 {formatCount(hiddenCount)} 条明细，可打开日志查看完整记录。</div>}
        </div>
      ) : (
        <div className="text-xs text-slate-500">这条任务没有可解析的补图明细。</div>
      )}
    </SoftRow>
  );
}

function ArtworkRepairLogRow({ item, onOpenGame }: { item: ArtworkRepairLogSummary; onOpenGame?: (gameId: string) => void }) {
  return (
    <div className="grid gap-2 rounded-md border border-white/[0.07] bg-black/[0.10] px-3 py-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={artworkLogBadgeClass(item.status)}>{artworkLogStatusLabel(item.status)}</Badge>
          <span className="truncate text-xs font-medium text-slate-200" title={item.title}>{item.title}</span>
          {item.gameId && onOpenGame && <Button className="h-7 px-2" size="sm" variant="ghost" onClick={() => onOpenGame(item.gameId!)}>游戏</Button>}
        </div>
        {item.gameId && <div className="mt-1 truncate font-mono text-[11px] text-slate-600">{item.gameId}</div>}
      </div>
      <div className="min-w-0 text-xs leading-5 text-slate-500">
        {item.fields && item.fields.length > 0 && (
          <div className="mb-1 flex flex-wrap gap-1.5">
            {item.fields.map((field) => <Badge key={field}>{artworkFieldLabel(field)}</Badge>)}
          </div>
        )}
        <span className="break-words">{item.message}</span>
        {item.provider && (
          <span className="ml-2 whitespace-nowrap text-slate-600">{providerLabel(item.provider)} {item.providerId ?? ''}</span>
        )}
      </div>
    </div>
  );
}

function summarizeArtworkRepairTask(detail: TaskDetail): ArtworkRepairTaskSummary {
  const items = detail.logs
    .map(parseArtworkRepairLog)
    .filter((item): item is ArtworkRepairLogSummary => Boolean(item));

  return {
    task: detail.task,
    updated: items.filter((item) => item.status === 'updated'),
    skipped: items.filter((item) => item.status === 'skipped'),
    failed: items.filter((item) => item.status === 'failed'),
  };
}

function filterArtworkRepairSummary(summary: ArtworkRepairTaskSummary, query: string, statusFilter: string): ArtworkRepairTaskSummary {
  return {
    task: summary.task,
    updated: summary.updated.filter((item) => matchesArtworkRepairLog(item, query, statusFilter)),
    skipped: summary.skipped.filter((item) => matchesArtworkRepairLog(item, query, statusFilter)),
    failed: summary.failed.filter((item) => matchesArtworkRepairLog(item, query, statusFilter)),
  };
}

function matchesArtworkRepairLog(item: ArtworkRepairLogSummary, query: string, statusFilter: string) {
  if (statusFilter !== 'all' && item.status !== statusFilter) return false;
  const value = query.trim().toLowerCase();
  if (!value) return true;
  return [
    item.status,
    artworkLogStatusLabel(item.status),
    item.title,
    item.gameId,
    item.message,
    item.provider,
    item.providerId,
    ...(item.fields ?? []),
    ...(item.fields ?? []).map(artworkFieldLabel),
  ].some((text) => String(text ?? '').toLowerCase().includes(value));
}

function parseArtworkRepairLog(log: TaskLogEntry): ArtworkRepairLogSummary | null {
  const message = log.message.trim();
  const updated = message.match(/^已补全：(.+) \[([^\]]+)\]，字段 (.+?)(?:，来源\s+([^\s。]+)\s+([^。]+))?。?$/);
  if (updated) {
    const [, title, gameId, fieldsText, provider, providerId] = updated;
    return {
      status: 'updated',
      title: title.trim(),
      gameId: gameId.trim(),
      message: '已补全目标媒体字段。',
      fields: splitArtworkFields(fieldsText),
      provider: provider?.trim() ?? null,
      providerId: providerId?.trim() ?? null,
    };
  }

  const skipped = message.match(/^跳过：(.+) \[([^\]]+)\]，(.+?)。?$/);
  if (skipped) {
    const [, title, gameId, reason] = skipped;
    return {
      status: 'skipped',
      title: title.trim(),
      gameId: gameId.trim(),
      message: reason.trim(),
    };
  }

  const failed = message.match(/^失败：(.+) \[([^\]]+)\]，(.+?)。?$/);
  if (failed) {
    const [, title, gameId, reason] = failed;
    return {
      status: 'failed',
      title: title.trim(),
      gameId: gameId.trim(),
      message: reason.trim(),
    };
  }

  return null;
}

function splitArtworkFields(value: string) {
  return value
    .split(/[\/、，,]/)
    .map((field) => field.trim())
    .filter(Boolean);
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

function CompactStat({ label, value, tone = 'neutral' }: { label: string; value: number | string; tone?: 'neutral' | 'ok' | 'warn' }) {
  const toneClass = tone === 'ok' ? 'text-emerald-200' : tone === 'warn' ? 'text-amber-200' : 'text-slate-200';
  const displayValue = typeof value === 'number' ? formatCount(value) : value;
  return (
    <div className="rounded-md border border-white/10 bg-black/[0.10] px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-sm ${toneClass}`}>{displayValue}</div>
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

function MaintenanceTaskRow({ actionBusy, task, onCancelTask, onOpenTask, onRetryTask }: { actionBusy?: boolean; task: TaskRecord; onCancelTask?: (taskId: string) => void; onOpenTask?: (taskId?: string | null) => void; onRetryTask?: (taskId: string) => void }) {
  const progress = boundedProgress(task.progress);
  const canRetry = Boolean(task.retryable) && needsAttentionTask(task);
  const canCancel = isActiveTask(task);
  return (
    <SoftRow className="grid gap-3 px-3 py-3 xl:grid-cols-[minmax(0,1fr)_minmax(8rem,12rem)_auto] xl:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-slate-100">{taskLabel(task.taskType)}</span>
          <Badge className={taskStatusClass(task.status)}>{taskStatusLabel(task.status)}</Badge>
          <span className="font-mono text-xs text-slate-500">{Math.round(progress * 100)}%</span>
        </div>
        <div className="mt-1 truncate text-xs text-slate-500">{task.message || task.error || '无消息'}</div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
          <span>更新 {formatDateTime(task.updatedAt)}</span>
          <span>{taskTimingLabel(task)}</span>
        </div>
        {task.error && <div className="mt-2 break-all text-xs text-rose-200">{task.error}</div>}
      </div>
      <div className="min-w-0">
        <div className="mb-1 text-right font-mono text-xs text-slate-400">{Math.round(progress * 100)}%</div>
        <div className="h-1.5 overflow-hidden rounded-full bg-black/25">
          <div className="h-full rounded-full bg-[rgb(var(--accent-rgb))]" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        {onOpenTask && <Button size="sm" variant="ghost" onClick={() => onOpenTask(task.id)}>日志</Button>}
        {onRetryTask && <Button disabled={actionBusy || !canRetry} size="sm" variant="outline" onClick={() => onRetryTask(task.id)}>{actionBusy && canRetry ? '重试中' : '重试'}</Button>}
        {onCancelTask && <Button disabled={actionBusy || !canCancel} size="sm" variant="outline" onClick={() => onCancelTask(task.id)}>{actionBusy && canCancel ? '取消中' : '取消'}</Button>}
      </div>
    </SoftRow>
  );
}

function isMaintenanceTask(task: TaskRecord) {
  return ['metadata.batch_match', 'metadata.description_image_repair', 'metadata.artwork_repair', 'metadata.duplicate_id_audit'].includes(task.taskType);
}

function isActiveTask(task: TaskRecord) {
  return task.status === 'running' || task.status === 'pending';
}

function needsAttentionTask(task: TaskRecord) {
  return task.status === 'failed' || task.status === 'cancelled';
}

function summarizeMaintenanceTasks(tasks: TaskRecord[]) {
  return {
    activeCount: tasks.filter(isActiveTask).length,
    attentionCount: tasks.filter(needsAttentionTask).length,
    completedCount: tasks.filter((task) => task.status === 'completed').length,
  };
}

function boundedProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function taskTimingLabel(task: TaskRecord) {
  const startedAt = new Date(task.createdAt).getTime();
  const updatedAt = new Date(task.updatedAt).getTime();
  const reference = isActiveTask(task) ? Date.now() : updatedAt;
  const elapsedSeconds = Number.isFinite(startedAt) && Number.isFinite(reference) && reference > startedAt ? Math.max(0, Math.round((reference - startedAt) / 1000)) : 0;
  return `${isActiveTask(task) ? '已运行' : '耗时'} ${formatDuration(elapsedSeconds)}`;
}

function formatDuration(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '不足 1 分钟';
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return hours > 0 ? `${days} 天 ${hours} 小时` : `${days} 天`;
  if (hours > 0) return minutes > 0 ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`;
  return `${Math.max(1, minutes)} 分钟`;
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

function duplicateGroupKey(group: DuplicateExternalIdGroup) {
  return `${group.provider}:${group.externalId}`;
}

function recommendDuplicateMergeTarget(group: DuplicateExternalIdGroup | null) {
  if (!group || group.games.length === 0) return '';
  const scored = group.games.map((game, index) => ({ game, score: duplicateMergeTargetScore(game, index) }));
  scored.sort((left, right) => right.score - left.score || left.game.title.localeCompare(right.game.title, 'zh-CN'));
  return scored[0]?.game.gameId ?? '';
}

function duplicateMergeTargetScore(game: DuplicateExternalIdGroup['games'][number], index: number) {
  const title = game.title.toLowerCase();
  const path = game.installPath.toLowerCase();
  let score = Math.max(0, 200 - index);
  score += game.sources.length * 10;
  score += Math.max(0, 80 - game.title.length);
  if (path.includes('duplicate') || path.includes('重复')) score -= 80;
  if (title.includes('duplicate') || title.includes('重复')) score -= 100;
  if (path.includes('backup') || path.includes('old') || path.includes('copy')) score -= 40;
  return score;
}

function imageIssueLabel(value: string) {
  if (value === 'missing') return '缺失';
  if (value === 'c_drive') return 'C 盘';
  if (value === 'playnite') return 'Playnite';
  if (value === 'remote') return '远程';
  if (value === 'ok') return '正常';
  if (value === 'warning') return '警告';
  return value;
}

function imageFieldLabel(value: string) {
  if (value === 'cover_image' || value === 'coverImage') return '封面字段';
  if (value === 'banner_image' || value === 'bannerImage') return '横幅字段';
  if (value === 'background_image' || value === 'backgroundImage') return '背景字段';
  if (value === 'description') return '简介';
  if (value === 'game_assets.uri') return '图库 URI';
  return value;
}

function imageBadgeClass(value: string) {
  if (value === 'missing') return 'border-amber-300/25 bg-amber-300/10 text-amber-100';
  if (value === 'c_drive' || value === 'playnite') return 'border-rose-300/25 bg-rose-300/10 text-rose-100';
  if (value === 'ok' || value === 'remote') return 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100';
  return 'border-white/10 bg-white/[0.045] text-slate-300';
}

function artworkStatusLabel(value: string) {
  if (value === 'repairable') return '可补全';
  if (value === 'missing_external_id') return '缺外部 ID';
  if (value === 'no_remote_image') return '远程无图';
  if (value === 'provider_error') return '来源失败';
  return value;
}

function artworkProviderStatusLabel(value: string) {
  if (value === 'has_image') return '有主图';
  if (value === 'no_image') return '无主图';
  if (value === 'error') return '失败';
  return value;
}

function artworkFieldLabel(value: string) {
  if (value === 'cover') return '封面';
  if (value === 'banner') return '横幅';
  if (value === 'background') return '背景';
  return value;
}

function providerLabel(value: string) {
  if (value === 'vndb') return 'VNDB';
  if (value === 'dlsite') return 'DLsite';
  if (value === 'fanza') return 'FANZA';
  return value;
}

function artworkStatusBadgeClass(value: string) {
  if (value === 'repairable') return 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100';
  if (value === 'missing_external_id' || value === 'no_remote_image') return 'border-amber-300/25 bg-amber-300/10 text-amber-100';
  if (value === 'provider_error') return 'border-rose-300/25 bg-rose-300/10 text-rose-100';
  return 'border-white/10 bg-white/[0.045] text-slate-300';
}

function artworkProviderBadgeClass(value: string) {
  if (value === 'has_image') return 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100';
  if (value === 'no_image') return 'border-amber-300/25 bg-amber-300/10 text-amber-100';
  if (value === 'error') return 'border-rose-300/25 bg-rose-300/10 text-rose-100';
  return 'border-white/10 bg-white/[0.045] text-slate-300';
}

function artworkLogStatusLabel(value: ArtworkRepairLogStatus) {
  if (value === 'updated') return '已补全';
  if (value === 'skipped') return '跳过';
  if (value === 'failed') return '失败';
  return value;
}

function artworkLogBadgeClass(value: ArtworkRepairLogStatus) {
  if (value === 'updated') return 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100';
  if (value === 'skipped') return 'border-amber-300/25 bg-amber-300/10 text-amber-100';
  if (value === 'failed') return 'border-rose-300/25 bg-rose-300/10 text-rose-100';
  return 'border-white/10 bg-white/[0.045] text-slate-300';
}

function dataDirSourceLabel(value: string) {
  if (value === 'env') return 'MIKAVN_APP_DATA_DIR';
  if (value === 'portable') return '应用旁 app-data';
  if (value === 'mock') return '浏览器预览';
  return '应用默认目录';
}
