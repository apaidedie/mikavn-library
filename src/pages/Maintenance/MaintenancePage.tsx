import { CheckCircle2, ListChecks, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { PageFrame, PageHeader, PageShell } from '@/components/ui/page';
import { TaskNotice } from '@/components/ui/task-notice';
import type { LibraryFilterPreset } from '@/types/game';
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
import { percent, providerLabel } from './MaintenancePageParts';
import { useMaintenanceDataActions } from './useMaintenanceDataActions';
import { useMaintenanceDuplicateMergeActions } from './useMaintenanceDuplicateMergeActions';
import { useMaintenanceHistoryActions } from './useMaintenanceHistoryActions';
import { useMaintenanceInspectionActions } from './useMaintenanceInspectionActions';
import { useMaintenanceQueueActions } from './useMaintenanceQueueActions';
import { useMaintenanceTasks } from './useMaintenanceTasks';

type TaskMessage = { text: string; taskId?: string | null };

export function MaintenancePage({ refreshKey, focusSection, focusRequestKey = 0, onOpenGame, onOpenLibrary, onOpenMetadata, onOpenTasks }: { refreshKey: number; focusSection?: string | null; focusRequestKey?: number; onOpenGame?: (gameId: string) => void; onOpenLibrary?: (preset?: LibraryFilterPreset | null) => void; onOpenMetadata?: (preset?: { query?: string; missingProvider?: string } | null) => void; onOpenTasks?: (taskId?: string | null) => void }) {
  const imageAuditRef = useRef<HTMLElement | null>(null);
  const handledFocusKeyRef = useRef<number | null>(null);
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
    artworkDiagnosis,
    artworkDiagnosisLoading,
    artworkDiagnosisQuery,
    artworkDiagnosisStatusFilter,
    imageAudit,
    imageAuditIssueFilter,
    imageAuditLoading,
    imageAuditQuery,
    loadArtworkDiagnosis,
    loadImageAudit,
    resetArtworkDiagnosisFilters,
    resetImageAuditFilters,
    setArtworkDiagnosisQuery,
    setArtworkDiagnosisStatusFilter,
    setImageAuditIssueFilter,
    setImageAuditQuery,
  } = useMaintenanceInspectionActions({
    setError,
    setMessage,
  });
  const {
    duplicateGroupFiltersActive,
    duplicateGroupProvider,
    duplicateGroupQuery,
    duplicateGroups,
    duplicateGroupsLoading,
    filteredDuplicateGroups,
    loadDuplicateGroups,
    mergeDuplicateGroup,
    mergeLoading,
    mergePreview,
    mergeSourceIds,
    mergeTargetId,
    previewDuplicateMerge,
    recommendedMergeTargetId,
    resetDuplicateGroupFilters,
    selectedDuplicateGroup,
    selectedDuplicateKey,
    updateDuplicateGroupProvider,
    updateDuplicateGroupQuery,
    updateMergeTarget,
    updateSelectedDuplicateKey,
  } = useMaintenanceDuplicateMergeActions({
    loadDiagnostics,
    setError,
    setMessage,
  });
  const {
    artworkHistory,
    artworkHistoryLoading,
    artworkHistoryQuery,
    artworkHistoryStatusFilter,
    batchMatchHistory,
    batchMatchHistoryLoading,
    batchMatchHistoryQuery,
    batchMatchHistoryStatusFilter,
    descriptionHistory,
    descriptionHistoryLoading,
    descriptionHistoryProviderFilter,
    descriptionHistoryQuery,
    descriptionHistoryStatusFilter,
    duplicateAuditHistory,
    duplicateAuditHistoryLoading,
    duplicateAuditHistoryProvider,
    duplicateAuditHistoryQuery,
    loadArtworkHistory,
    loadBatchMatchHistory,
    loadDescriptionRepairHistory,
    loadDuplicateAuditHistory,
    refreshHistoryForTaskType,
    resetArtworkHistoryFilters,
    resetBatchMatchHistoryFilters,
    resetDescriptionHistoryFilters,
    resetDuplicateAuditHistoryFilters,
    setArtworkHistoryQuery,
    setArtworkHistoryStatusFilter,
    setBatchMatchHistoryQuery,
    setBatchMatchHistoryStatusFilter,
    setDescriptionHistoryProviderFilter,
    setDescriptionHistoryQuery,
    setDescriptionHistoryStatusFilter,
    setDuplicateAuditHistoryProvider,
    setDuplicateAuditHistoryQuery,
  } = useMaintenanceHistoryActions({
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
    onTaskRetried: async (task) => {
      await refreshHistoryForTaskType(task.taskType);
    },
    setError,
    setMessage,
  });
  const {
    artworkRepairLoading,
    descriptionRepairLoading,
    duplicateAuditLoading,
    metadataRepairLoading,
    startArtworkRepair,
    startDescriptionImageRepair,
    startDuplicateExternalIdAudit,
    startMetadataRepair,
  } = useMaintenanceQueueActions({
    loadDiagnostics,
    loadMaintenanceTasks,
    onOpenTasks,
    refreshHistoryForTaskType,
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
          onMergeTargetChange={updateMergeTarget}
          onPreviewMerge={previewDuplicateMerge}
          onProviderChange={updateDuplicateGroupProvider}
          onQueryChange={updateDuplicateGroupQuery}
          onResetFilters={resetDuplicateGroupFilters}
          onSelectedDuplicateKeyChange={updateSelectedDuplicateKey}
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

}
