import { CheckCircle2, Combine, Copy, Image, ListChecks, RefreshCw, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { PageFrame, PageHeader, PageShell, Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import { TaskNotice } from '@/components/ui/task-notice';
import { api } from '@/services/api';
import type { AppDataDiagnostics, ImageReferenceAudit } from '@/types/archive';
import type { AssetCacheCleanupResult, LibraryFilterPreset } from '@/types/game';
import type { ArtworkRepairDiagnosis, DuplicateExternalIdGroup, DuplicateGameMergePreview } from '@/types/metadata';
import type { TaskRecord } from '@/types/task';
import { errorMessage } from '@/utils/errorMessage';
import { taskLabel } from '@/utils/taskLabels';
import { Select } from '@/components/ui/select';
import { summarizeArtworkRepairTask, type ArtworkRepairTaskSummary } from './ArtworkRepairResultPanel';
import type { BatchMatchHistorySummary } from './BatchMatchResultPanel';
import { summarizeDescriptionImageRepairTask, type DescriptionImageRepairTaskSummary } from './DescriptionImageRepairResultPanel';
import { summarizeDuplicateAuditTask, type DuplicateAuditTaskSummary } from './DuplicateAuditResultPanel';
import { ImageAuditDetailPanel, matchesImageAuditItem } from './ImageAuditDetailPanel';
import { MaintenanceArtworkDiagnosisPanel } from './MaintenanceArtworkDiagnosisPanel';
import { MaintenanceArtworkHistoryPanel } from './MaintenanceArtworkHistoryPanel';
import { MaintenanceBatchMatchHistoryPanel } from './MaintenanceBatchMatchHistoryPanel';
import { MaintenanceDataLocationPanel } from './MaintenanceDataLocationPanel';
import { MaintenanceDescriptionHistoryPanel } from './MaintenanceDescriptionHistoryPanel';
import { MaintenanceDuplicateAuditHistoryPanel } from './MaintenanceDuplicateAuditHistoryPanel';
import { MaintenanceOverviewPanels } from './MaintenanceOverviewPanels';
import { MaintenanceQueuePanel } from './MaintenanceQueuePanel';
import { MaintenanceTasksPanel } from './MaintenanceTasksPanel';
import { CompactStat, duplicateGroupKey, formatBytes, formatCount, isActiveTask, isMaintenanceTask, matchesMaintenanceTaskFilter, percent, providerLabel, recommendDuplicateMergeTarget, summarizeMaintenanceTasks, type MaintenanceTaskFilter } from './MaintenancePageParts';

type TaskMessage = { text: string; taskId?: string | null };

export function MaintenancePage({ refreshKey, focusSection, focusRequestKey = 0, onOpenGame, onOpenLibrary, onOpenMetadata, onOpenTasks }: { refreshKey: number; focusSection?: string | null; focusRequestKey?: number; onOpenGame?: (gameId: string) => void; onOpenLibrary?: (preset?: LibraryFilterPreset | null) => void; onOpenMetadata?: (preset?: { query?: string; missingProvider?: string } | null) => void; onOpenTasks?: (taskId?: string | null) => void }) {
  const imageAuditRef = useRef<HTMLElement | null>(null);
  const handledFocusKeyRef = useRef<number | null>(null);
  const batchMatchHistoryLoadedRef = useRef(false);
  const artworkHistoryLoadedRef = useRef(false);
  const descriptionHistoryLoadedRef = useRef(false);
  const duplicateAuditHistoryLoadedRef = useRef(false);
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
  const [descriptionHistory, setDescriptionHistory] = useState<DescriptionImageRepairTaskSummary[] | null>(null);
  const [descriptionHistoryLoading, setDescriptionHistoryLoading] = useState(false);
  const [descriptionHistoryQuery, setDescriptionHistoryQuery] = useState('');
  const [descriptionHistoryStatusFilter, setDescriptionHistoryStatusFilter] = useState('all');
  const [descriptionHistoryProviderFilter, setDescriptionHistoryProviderFilter] = useState('all');
  const [batchMatchHistory, setBatchMatchHistory] = useState<BatchMatchHistorySummary[] | null>(null);
  const [batchMatchHistoryLoading, setBatchMatchHistoryLoading] = useState(false);
  const [batchMatchHistoryQuery, setBatchMatchHistoryQuery] = useState('');
  const [batchMatchHistoryStatusFilter, setBatchMatchHistoryStatusFilter] = useState('all');
  const [metadataRepairLoading, setMetadataRepairLoading] = useState(false);
  const [descriptionRepairLoading, setDescriptionRepairLoading] = useState(false);
  const [artworkRepairLoading, setArtworkRepairLoading] = useState(false);
  const [duplicateAuditLoading, setDuplicateAuditLoading] = useState(false);
  const [duplicateAuditHistory, setDuplicateAuditHistory] = useState<DuplicateAuditTaskSummary[] | null>(null);
  const [duplicateAuditHistoryLoading, setDuplicateAuditHistoryLoading] = useState(false);
  const [duplicateAuditHistoryQuery, setDuplicateAuditHistoryQuery] = useState('');
  const [duplicateAuditHistoryProvider, setDuplicateAuditHistoryProvider] = useState('all');
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
  const [maintenanceTaskFilter, setMaintenanceTaskFilter] = useState<MaintenanceTaskFilter>('all');

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
  const maintenanceTaskShortcuts = useMemo(() => [
    { id: 'all', label: '全部', count: maintenanceTasks.length },
    { id: 'active', label: '进行中', count: maintenanceTaskSummary.activeCount },
    { id: 'attention', label: '需处理', count: maintenanceTaskSummary.attentionCount },
    { id: 'completed', label: '已完成', count: maintenanceTaskSummary.completedCount },
  ] as const, [maintenanceTaskSummary, maintenanceTasks.length]);
  const filteredMaintenanceTasks = useMemo(() => maintenanceTasks.filter((task) => matchesMaintenanceTaskFilter(task, maintenanceTaskFilter)), [maintenanceTaskFilter, maintenanceTasks]);
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

  const resetBatchMatchHistoryFilters = () => {
    setBatchMatchHistoryQuery('');
    setBatchMatchHistoryStatusFilter('all');
  };

  const resetDescriptionHistoryFilters = () => {
    setDescriptionHistoryQuery('');
    setDescriptionHistoryStatusFilter('all');
    setDescriptionHistoryProviderFilter('all');
  };

  const resetDuplicateAuditHistoryFilters = () => {
    setDuplicateAuditHistoryQuery('');
    setDuplicateAuditHistoryProvider('all');
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

        <MaintenanceOverviewPanels
          database={database}
          descriptionImages={descriptionImages}
          externalIds={externalIds}
          issueCount={issueCount}
          metadata={metadata}
          metadataCoverage={metadataCoverage}
          pathStatus={pathStatus}
          providerDescriptionCoverage={providerDescriptionCoverage}
          onOpenLibrary={onOpenLibrary}
        />

        <MaintenanceDataLocationPanel
          assetCleanupLoading={assetCleanupLoading}
          assetCleanupPreview={assetCleanupPreview}
          cleanupLoading={cleanupLoading}
          diagnostics={diagnostics}
          onCleanupAssetCache={cleanupAssetCache}
          onCleanupDatabaseBackups={cleanupDatabaseBackups}
          onCopyPath={(label, path) => void copyPath(label, path)}
          onPreviewAssetCacheCleanup={previewAssetCacheCleanup}
          onRevealPath={(path) => void revealPath(path)}
        />

        <MaintenanceArtworkDiagnosisPanel
          diagnosis={artworkDiagnosis}
          loading={artworkDiagnosisLoading}
          missingArtworkFieldCount={missingArtworkFieldCount}
          query={artworkDiagnosisQuery}
          statusFilter={artworkDiagnosisStatusFilter}
          onLoadDiagnosis={loadArtworkDiagnosis}
          onOpenGame={onOpenGame}
          onOpenMetadata={onOpenMetadata}
          onQueryChange={setArtworkDiagnosisQuery}
          onResetFilters={resetArtworkDiagnosisFilters}
          onStatusFilterChange={setArtworkDiagnosisStatusFilter}
        />

        <MaintenanceBatchMatchHistoryPanel
          history={batchMatchHistory}
          loading={batchMatchHistoryLoading}
          query={batchMatchHistoryQuery}
          statusFilter={batchMatchHistoryStatusFilter}
          onLoadHistory={() => loadBatchMatchHistory()}
          onOpenTask={onOpenTasks}
          onQueryChange={setBatchMatchHistoryQuery}
          onResetFilters={resetBatchMatchHistoryFilters}
          onStatusFilterChange={setBatchMatchHistoryStatusFilter}
          providerLabel={providerLabel}
        />

        <MaintenanceArtworkHistoryPanel
          actionBusyTaskId={maintenanceTaskActionId}
          history={artworkHistory}
          loading={artworkHistoryLoading}
          query={artworkHistoryQuery}
          statusFilter={artworkHistoryStatusFilter}
          onLoadHistory={() => loadArtworkHistory()}
          onOpenGame={onOpenGame}
          onOpenTask={onOpenTasks}
          onQueryChange={setArtworkHistoryQuery}
          onResetFilters={resetArtworkHistoryFilters}
          onRetryTask={retryMaintenanceTask}
          onStatusFilterChange={setArtworkHistoryStatusFilter}
        />

        <MaintenanceDescriptionHistoryPanel
          actionBusyTaskId={maintenanceTaskActionId}
          history={descriptionHistory}
          loading={descriptionHistoryLoading}
          providerFilter={descriptionHistoryProviderFilter}
          query={descriptionHistoryQuery}
          statusFilter={descriptionHistoryStatusFilter}
          onLoadHistory={() => loadDescriptionRepairHistory()}
          onOpenGame={onOpenGame}
          onOpenTask={onOpenTasks}
          onProviderFilterChange={setDescriptionHistoryProviderFilter}
          onQueryChange={setDescriptionHistoryQuery}
          onResetFilters={resetDescriptionHistoryFilters}
          onRetryTask={retryMaintenanceTask}
          onStatusFilterChange={setDescriptionHistoryStatusFilter}
        />

        <Panel ref={imageAuditRef}>
          <PanelHeader
            title="图片引用问题"
            description="定位缺失、C 盘残留和 Playnite 残留图片引用。"
            icon={<Image className="h-4 w-4" />}
            actions={<Button disabled={imageAuditLoading || !diagnostics} size="sm" variant="ghost" onClick={loadImageAudit}><ListChecks className="h-4 w-4" />{imageAuditLoading ? '读取中' : '读取明细'}</Button>}
          />
          <PanelContent className="space-y-3">
            {imageAudit ? (
              <ImageAuditDetailPanel
                audit={imageAudit}
                filteredItems={filteredImageAuditItems}
                issueFilter={imageAuditIssueFilter}
                query={imageAuditQuery}
                onIssueFilterChange={setImageAuditIssueFilter}
                onOpenGame={onOpenGame}
                onQueryChange={setImageAuditQuery}
                onRevealPath={(path) => void revealPath(path)}
                onResetFilters={resetImageAuditFilters}
              />
            ) : (
              <SoftRow className="flex items-center justify-between gap-3 px-3 py-3">
                <div className="min-w-0 text-sm text-slate-400">读取后会列出具体游戏、来源字段、原始路径和已解析到的文件路径。</div>
                <Button disabled={imageAuditLoading || !diagnostics} size="sm" variant="secondary" onClick={loadImageAudit}><ListChecks className="h-4 w-4" />读取</Button>
              </SoftRow>
            )}
          </PanelContent>
        </Panel>

        <MaintenanceDuplicateAuditHistoryPanel
          history={duplicateAuditHistory}
          loading={duplicateAuditHistoryLoading}
          providerFilter={duplicateAuditHistoryProvider}
          query={duplicateAuditHistoryQuery}
          onLoadHistory={() => loadDuplicateAuditHistory()}
          onOpenTask={onOpenTasks}
          onProviderFilterChange={setDuplicateAuditHistoryProvider}
          onQueryChange={setDuplicateAuditHistoryQuery}
          onResetFilters={resetDuplicateAuditHistoryFilters}
        />

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
                          <option key={duplicateGroupKey(group)} value={duplicateGroupKey(group)}>{providerLabel(group.provider)} {group.externalId} · {group.gameCount} 条</option>
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
                          <div className="mt-1 flex min-w-0 items-start gap-1">
                            <div className="min-w-0 break-all font-mono text-[11px] text-slate-600">{game.installPath}</div>
                            <Button aria-label="复制重复游戏安装目录" className="h-6 w-6 shrink-0" size="icon" title="复制重复游戏安装目录" variant="ghost" onClick={() => void copyPath('重复游戏安装目录', game.installPath)}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
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

        <MaintenanceTasksPanel
          actionBusyTaskId={maintenanceTaskActionId}
          filteredTasks={filteredMaintenanceTasks}
          filter={maintenanceTaskFilter}
          loading={maintenanceTasksLoading}
          shortcuts={maintenanceTaskShortcuts}
          summary={maintenanceTaskSummary}
          tasks={maintenanceTasks}
          onCancelTask={cancelMaintenanceTask}
          onFilterChange={setMaintenanceTaskFilter}
          onOpenTask={onOpenTasks}
          onRefresh={() => void loadMaintenanceTasks()}
          onRetryTask={retryMaintenanceTask}
        />

        <MaintenanceQueuePanel
          artworkRepairLoading={artworkRepairLoading}
          descriptionImages={descriptionImages}
          descriptionRepairLoading={descriptionRepairLoading}
          duplicateAuditLoading={duplicateAuditLoading}
          externalIds={externalIds}
          metadata={metadata}
          metadataRepairLoading={metadataRepairLoading}
          missingArtworkFieldCount={missingArtworkFieldCount}
          onOpenMetadata={onOpenMetadata}
          onStartArtworkRepair={startArtworkRepair}
          onStartDescriptionImageRepair={startDescriptionImageRepair}
          onStartDuplicateExternalIdAudit={startDuplicateExternalIdAudit}
          onStartMetadataRepair={startMetadataRepair}
        />
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
      if (task.taskType === 'metadata.batch_match') await loadBatchMatchHistory({ quiet: true });
      if (task.taskType === 'metadata.description_image_repair') await loadDescriptionRepairHistory({ quiet: true });
      if (task.taskType === 'metadata.artwork_repair') await loadArtworkHistory({ quiet: true });
      if (task.taskType === 'metadata.duplicate_id_audit') await loadDuplicateAuditHistory({ quiet: true });
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

  async function loadArtworkHistory(options?: { quiet?: boolean }) {
    if (!options?.quiet) setArtworkHistoryLoading(true);
    if (!options?.quiet) setError(null);
    try {
      const tasks = (await api.listTasks(100)).filter((task) => task.taskType === 'metadata.artwork_repair').slice(0, 5);
      const summaries = await Promise.all(tasks.map(async (task) => summarizeArtworkRepairTask(await api.getTaskDetail(task.id))));
      setArtworkHistory(summaries);
      artworkHistoryLoadedRef.current = true;
      if (!options?.quiet) setMessage({ text: summaries.length > 0 ? `已读取 ${formatCount(summaries.length)} 个媒体补全任务结果。` : '还没有媒体图片补全任务记录。' });
    } catch (reason) {
      if (!options?.quiet) setError(errorMessage(reason));
    } finally {
      if (!options?.quiet) setArtworkHistoryLoading(false);
    }
  }

  async function loadBatchMatchHistory(options?: { quiet?: boolean }) {
    if (!options?.quiet) setBatchMatchHistoryLoading(true);
    if (!options?.quiet) setError(null);
    try {
      const tasks = (await api.listTasks(100)).filter((task) => task.taskType === 'metadata.batch_match').slice(0, 5);
      const summaries = await Promise.all(tasks.map(async (task) => {
        const status = await api.getBatchMatchStatus(task.id).catch(() => null);
        return { task, status, results: status?.results ?? [] };
      }));
      setBatchMatchHistory(summaries);
      batchMatchHistoryLoadedRef.current = true;
      if (!options?.quiet) setMessage({ text: summaries.length > 0 ? `已读取 ${formatCount(summaries.length)} 个批量匹配任务结果。` : '还没有批量匹配任务记录。' });
    } catch (reason) {
      if (!options?.quiet) setError(errorMessage(reason));
    } finally {
      if (!options?.quiet) setBatchMatchHistoryLoading(false);
    }
  }

  async function loadDescriptionRepairHistory(options?: { quiet?: boolean }) {
    if (!options?.quiet) setDescriptionHistoryLoading(true);
    if (!options?.quiet) setError(null);
    try {
      const tasks = (await api.listTasks(100)).filter((task) => task.taskType === 'metadata.description_image_repair').slice(0, 5);
      const games = await api.listGames({ sortBy: 'updated_at', sortDirection: 'desc' });
      const summaries = await Promise.all(tasks.map(async (task) => summarizeDescriptionImageRepairTask(await api.getTaskDetail(task.id), games)));
      setDescriptionHistory(summaries);
      descriptionHistoryLoadedRef.current = true;
      if (!options?.quiet) setMessage({ text: summaries.length > 0 ? `已读取 ${formatCount(summaries.length)} 个简介图片修复任务结果。` : '还没有简介图片修复任务记录。' });
    } catch (reason) {
      if (!options?.quiet) setError(errorMessage(reason));
    } finally {
      if (!options?.quiet) setDescriptionHistoryLoading(false);
    }
  }

  async function loadDuplicateAuditHistory(options?: { quiet?: boolean }) {
    if (!options?.quiet) setDuplicateAuditHistoryLoading(true);
    if (!options?.quiet) setError(null);
    try {
      const tasks = (await api.listTasks(100)).filter((task) => task.taskType === 'metadata.duplicate_id_audit').slice(0, 5);
      const summaries = await Promise.all(tasks.map(async (task) => summarizeDuplicateAuditTask(await api.getTaskDetail(task.id))));
      setDuplicateAuditHistory(summaries);
      duplicateAuditHistoryLoadedRef.current = true;
      if (!options?.quiet) setMessage({ text: summaries.length > 0 ? `已读取 ${formatCount(summaries.length)} 个重复 ID 审查任务结果。` : '还没有重复 ID 审查任务记录。' });
    } catch (reason) {
      if (!options?.quiet) setError(errorMessage(reason));
    } finally {
      if (!options?.quiet) setDuplicateAuditHistoryLoading(false);
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
      if (batchMatchHistoryLoadedRef.current) await loadBatchMatchHistory({ quiet: true });
      else if (job.taskId) onOpenTasks?.(job.taskId);
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
      if (descriptionHistoryLoadedRef.current) await loadDescriptionRepairHistory({ quiet: true });
      else onOpenTasks?.(task.id);
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
      if (artworkHistoryLoadedRef.current) await loadArtworkHistory({ quiet: true });
      else onOpenTasks?.(task.id);
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
      if (duplicateAuditHistoryLoadedRef.current) await loadDuplicateAuditHistory({ quiet: true });
      else onOpenTasks?.(task.id);
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

  async function copyPath(label: string, path: string) {
    setError(null);
    try {
      await navigator.clipboard.writeText(path);
      setMessage({ text: `已复制${label}路径。` });
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }
}
