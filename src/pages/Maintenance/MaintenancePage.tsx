import { CheckCircle2, ListChecks, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { PageFrame, PageHeader, PageShell } from '@/components/ui/page';
import { TaskNotice } from '@/components/ui/task-notice';
import { api } from '@/services/api';
import type { ImageReferenceAudit } from '@/types/archive';
import type { LibraryFilterPreset } from '@/types/game';
import type { ArtworkRepairDiagnosis, DuplicateExternalIdGroup, DuplicateGameMergePreview } from '@/types/metadata';
import type { TaskRecord } from '@/types/task';
import { errorMessage } from '@/utils/errorMessage';
import { summarizeArtworkRepairTask, type ArtworkRepairTaskSummary } from './ArtworkRepairResultPanel';
import type { BatchMatchHistorySummary } from './BatchMatchResultPanel';
import { summarizeDescriptionImageRepairTask, type DescriptionImageRepairTaskSummary } from './DescriptionImageRepairResultPanel';
import { summarizeDuplicateAuditTask, type DuplicateAuditTaskSummary } from './DuplicateAuditResultPanel';
import { MaintenanceArtworkDiagnosisPanel } from './MaintenanceArtworkDiagnosisPanel';
import { MaintenanceArtworkHistoryPanel } from './MaintenanceArtworkHistoryPanel';
import { MaintenanceBatchMatchHistoryPanel } from './MaintenanceBatchMatchHistoryPanel';
import { MaintenanceDataLocationPanel } from './MaintenanceDataLocationPanel';
import { MaintenanceDescriptionHistoryPanel } from './MaintenanceDescriptionHistoryPanel';
import { MaintenanceDuplicateAuditHistoryPanel } from './MaintenanceDuplicateAuditHistoryPanel';
import { MaintenanceDuplicateMergePanel } from './MaintenanceDuplicateMergePanel';
import { MaintenanceImageAuditPanel } from './MaintenanceImageAuditPanel';
import { MaintenanceOverviewPanels } from './MaintenanceOverviewPanels';
import { MaintenanceQueuePanel } from './MaintenanceQueuePanel';
import { MaintenanceTasksPanel } from './MaintenanceTasksPanel';
import { duplicateGroupKey, formatCount, percent, providerLabel, recommendDuplicateMergeTarget } from './MaintenancePageParts';
import { useMaintenanceDataActions } from './useMaintenanceDataActions';
import { useMaintenanceTasks } from './useMaintenanceTasks';

type TaskMessage = { text: string; taskId?: string | null };

export function MaintenancePage({ refreshKey, focusSection, focusRequestKey = 0, onOpenGame, onOpenLibrary, onOpenMetadata, onOpenTasks }: { refreshKey: number; focusSection?: string | null; focusRequestKey?: number; onOpenGame?: (gameId: string) => void; onOpenLibrary?: (preset?: LibraryFilterPreset | null) => void; onOpenMetadata?: (preset?: { query?: string; missingProvider?: string } | null) => void; onOpenTasks?: (taskId?: string | null) => void }) {
  const imageAuditRef = useRef<HTMLElement | null>(null);
  const handledFocusKeyRef = useRef<number | null>(null);
  const batchMatchHistoryLoadedRef = useRef(false);
  const artworkHistoryLoadedRef = useRef(false);
  const descriptionHistoryLoadedRef = useRef(false);
  const duplicateAuditHistoryLoadedRef = useRef(false);
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
  const {
    assetCleanupLoading,
    assetCleanupPreview,
    cleanupAssetCache,
    cleanupDatabaseBackups,
    cleanupLoading,
    copyPath,
    diagnostics,
    loadDiagnostics,
    loading,
    previewAssetCacheCleanup,
    revealPath,
  } = useMaintenanceDataActions({
    setError,
    setMessage,
  });
  const {
    cancelMaintenanceTask,
    filteredMaintenanceTasks,
    loadMaintenanceTasks,
    maintenanceTaskActionId,
    maintenanceTaskFilter,
    maintenanceTaskShortcuts,
    maintenanceTaskSummary,
    maintenanceTasks,
    maintenanceTasksLoading,
    retryMaintenanceTask,
    setMaintenanceTaskFilter,
  } = useMaintenanceTasks({
    onTaskRetried: refreshRetriedMaintenanceTaskHistory,
    setError,
    setMessage,
  });

  useEffect(() => {
    void loadDiagnostics();
    void loadMaintenanceTasks();
  }, [loadDiagnostics, loadMaintenanceTasks, refreshKey]);

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
  const selectedDuplicateGroup = useMemo(() => filteredDuplicateGroups.find((group) => duplicateGroupKey(group) === selectedDuplicateKey) ?? filteredDuplicateGroups[0] ?? null, [filteredDuplicateGroups, selectedDuplicateKey]);
  const recommendedMergeTargetId = useMemo(() => recommendDuplicateMergeTarget(selectedDuplicateGroup), [selectedDuplicateGroup]);
  const mergeSourceIds = useMemo(() => selectedDuplicateGroup?.games.map((game) => game.gameId).filter((id) => id !== mergeTargetId) ?? [], [mergeTargetId, selectedDuplicateGroup]);
  const duplicateGroupFiltersActive = duplicateGroupQuery.trim().length > 0 || duplicateGroupProvider !== 'all';
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

        <MaintenanceImageAuditPanel
          ref={imageAuditRef}
          audit={imageAudit}
          canLoad={Boolean(diagnostics)}
          issueFilter={imageAuditIssueFilter}
          loading={imageAuditLoading}
          query={imageAuditQuery}
          onIssueFilterChange={setImageAuditIssueFilter}
          onLoadAudit={loadImageAudit}
          onOpenGame={onOpenGame}
          onQueryChange={setImageAuditQuery}
          onResetFilters={resetImageAuditFilters}
          onRevealPath={(path) => void revealPath(path)}
        />

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

        <MaintenanceDuplicateMergePanel
          duplicateExternalIdGroupCount={externalIds?.duplicateExternalIdGroupsCount ?? 0}
          duplicateGroupFiltersActive={duplicateGroupFiltersActive}
          duplicateGroupProvider={duplicateGroupProvider}
          duplicateGroupQuery={duplicateGroupQuery}
          duplicateGroups={duplicateGroups}
          filteredDuplicateGroups={filteredDuplicateGroups}
          loading={duplicateGroupsLoading}
          mergeLoading={mergeLoading}
          mergePreview={mergePreview}
          mergeSourceIds={mergeSourceIds}
          mergeTargetId={mergeTargetId}
          recommendedMergeTargetId={recommendedMergeTargetId}
          selectedDuplicateGroup={selectedDuplicateGroup}
          selectedDuplicateKey={selectedDuplicateKey}
          onCopyPath={(label, path) => void copyPath(label, path)}
          onLoadGroups={() => loadDuplicateGroups()}
          onMergeGroup={mergeDuplicateGroup}
          onMergeTargetChange={(gameId) => { setMergeTargetId(gameId); setMergePreview(null); }}
          onPreviewMerge={previewDuplicateMerge}
          onProviderChange={(value) => { setDuplicateGroupProvider(value); setMergePreview(null); }}
          onQueryChange={(value) => { setDuplicateGroupQuery(value); setMergePreview(null); }}
          onResetFilters={resetDuplicateGroupFilters}
          onSelectedDuplicateKeyChange={(value) => { setSelectedDuplicateKey(value); setMergePreview(null); }}
        />

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

  async function refreshRetriedMaintenanceTaskHistory(task: TaskRecord) {
    if (task.taskType === 'metadata.batch_match') await loadBatchMatchHistory({ quiet: true });
    if (task.taskType === 'metadata.description_image_repair') await loadDescriptionRepairHistory({ quiet: true });
    if (task.taskType === 'metadata.artwork_repair') await loadArtworkHistory({ quiet: true });
    if (task.taskType === 'metadata.duplicate_id_audit') await loadDuplicateAuditHistory({ quiet: true });
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

}
