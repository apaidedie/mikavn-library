import type { RefObject } from 'react';
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
import type { useMaintenanceDataActions } from './useMaintenanceDataActions';
import type { useMaintenanceDuplicateMergeActions } from './useMaintenanceDuplicateMergeActions';
import type { useMaintenanceHistoryActions } from './useMaintenanceHistoryActions';
import type { useMaintenanceInspectionActions } from './useMaintenanceInspectionActions';
import type { useMaintenanceQueueActions } from './useMaintenanceQueueActions';
import type { useMaintenanceTasks } from './useMaintenanceTasks';

type DataActions = ReturnType<typeof useMaintenanceDataActions>;
type InspectionActions = ReturnType<typeof useMaintenanceInspectionActions>;
type DuplicateMergeActions = ReturnType<typeof useMaintenanceDuplicateMergeActions>;
type HistoryActions = ReturnType<typeof useMaintenanceHistoryActions>;
type TaskActions = ReturnType<typeof useMaintenanceTasks>;
type QueueActions = ReturnType<typeof useMaintenanceQueueActions>;

type MaintenancePageContentProps = {
  dataActions: DataActions;
  duplicateMergeActions: DuplicateMergeActions;
  historyActions: HistoryActions;
  imageAuditRef: RefObject<HTMLElement | null>;
  inspectionActions: InspectionActions;
  onOpenGame?: (gameId: string) => void;
  onOpenLibrary?: (preset?: LibraryFilterPreset | null) => void;
  onOpenMetadata?: (preset?: { query?: string; missingProvider?: string } | null) => void;
  onOpenTasks?: (taskId?: string | null) => void;
  queueActions: QueueActions;
  taskActions: TaskActions;
};

export function MaintenancePageContent({ dataActions, duplicateMergeActions, historyActions, imageAuditRef, inspectionActions, onOpenGame, onOpenLibrary, onOpenMetadata, onOpenTasks, queueActions, taskActions }: MaintenancePageContentProps) {
  const database = dataActions.diagnostics?.database;
  const metadata = database?.metadataCoverage;
  const descriptionImages = database?.descriptionImages;
  const externalIds = database?.externalIds;
  const pathStatus = database?.pathStatus;
  const missingArtworkFieldCount = (metadata?.missingCoverCount ?? 0) + (metadata?.missingBannerCount ?? 0) + (metadata?.missingBackgroundCount ?? 0);
  const providerDescriptionCoverage = percent(descriptionImages?.providerGamesWithImagesCount ?? 0, descriptionImages?.providerGamesCount ?? 0);
  const metadataCoverage = percent(metadata?.completeGameCount ?? 0, database?.gameCount ?? 0);
  const issueCount = database
    ? database.foreignKeyIssues
      + database.missingImageRefsCount
      + database.descriptionImages.missingLocalImageRefsCount
      + database.externalIds.duplicateExternalIdGroupsCount
      + database.pathStatus.brokenCount
      + database.cDriveImageRefsCount
      + database.playniteImageRefsCount
    : 0;

  return (
    <>
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
        assetCleanupLoading={dataActions.assetCleanupLoading}
        assetCleanupPreview={dataActions.assetCleanupPreview}
        cleanupLoading={dataActions.cleanupLoading}
        diagnostics={dataActions.diagnostics}
        diagnosticExportLoading={dataActions.diagnosticExportLoading}
        onCleanupAssetCache={dataActions.cleanupAssetCache}
        onCleanupDatabaseBackups={dataActions.cleanupDatabaseBackups}
        onCopyPath={(label, path) => void dataActions.copyPath(label, path)}
        onExportDiagnosticPackage={dataActions.exportDiagnosticPackage}
        onPreviewAssetCacheCleanup={dataActions.previewAssetCacheCleanup}
        onRevealPath={(path) => void dataActions.revealPath(path)}
      />

      <MaintenanceArtworkDiagnosisPanel
        diagnosis={inspectionActions.artworkDiagnosis}
        loading={inspectionActions.artworkDiagnosisLoading}
        missingArtworkFieldCount={missingArtworkFieldCount}
        query={inspectionActions.artworkDiagnosisQuery}
        statusFilter={inspectionActions.artworkDiagnosisStatusFilter}
        onLoadDiagnosis={inspectionActions.loadArtworkDiagnosis}
        onOpenGame={onOpenGame}
        onOpenMetadata={onOpenMetadata}
        onQueryChange={inspectionActions.setArtworkDiagnosisQuery}
        onResetFilters={inspectionActions.resetArtworkDiagnosisFilters}
        onStatusFilterChange={inspectionActions.setArtworkDiagnosisStatusFilter}
      />

      <MaintenanceBatchMatchHistoryPanel
        history={historyActions.batchMatchHistory}
        loading={historyActions.batchMatchHistoryLoading}
        query={historyActions.batchMatchHistoryQuery}
        statusFilter={historyActions.batchMatchHistoryStatusFilter}
        onLoadHistory={() => historyActions.loadBatchMatchHistory()}
        onOpenTask={onOpenTasks}
        onQueryChange={historyActions.setBatchMatchHistoryQuery}
        onResetFilters={historyActions.resetBatchMatchHistoryFilters}
        onStatusFilterChange={historyActions.setBatchMatchHistoryStatusFilter}
        providerLabel={providerLabel}
      />

      <MaintenanceArtworkHistoryPanel
        actionBusyTaskId={taskActions.maintenanceTaskActionId}
        history={historyActions.artworkHistory}
        loading={historyActions.artworkHistoryLoading}
        query={historyActions.artworkHistoryQuery}
        statusFilter={historyActions.artworkHistoryStatusFilter}
        onLoadHistory={() => historyActions.loadArtworkHistory()}
        onOpenGame={onOpenGame}
        onOpenTask={onOpenTasks}
        onQueryChange={historyActions.setArtworkHistoryQuery}
        onResetFilters={historyActions.resetArtworkHistoryFilters}
        onRetryTask={taskActions.retryMaintenanceTask}
        onStatusFilterChange={historyActions.setArtworkHistoryStatusFilter}
      />

      <MaintenanceDescriptionHistoryPanel
        actionBusyTaskId={taskActions.maintenanceTaskActionId}
        history={historyActions.descriptionHistory}
        loading={historyActions.descriptionHistoryLoading}
        providerFilter={historyActions.descriptionHistoryProviderFilter}
        query={historyActions.descriptionHistoryQuery}
        statusFilter={historyActions.descriptionHistoryStatusFilter}
        onLoadHistory={() => historyActions.loadDescriptionRepairHistory()}
        onOpenGame={onOpenGame}
        onOpenTask={onOpenTasks}
        onProviderFilterChange={historyActions.setDescriptionHistoryProviderFilter}
        onQueryChange={historyActions.setDescriptionHistoryQuery}
        onResetFilters={historyActions.resetDescriptionHistoryFilters}
        onRetryTask={taskActions.retryMaintenanceTask}
        onStatusFilterChange={historyActions.setDescriptionHistoryStatusFilter}
      />

      <MaintenanceImageAuditPanel
        ref={imageAuditRef}
        audit={inspectionActions.imageAudit}
        artworkDiagnosisLoading={inspectionActions.artworkDiagnosisLoading}
        artworkRepairLoading={queueActions.artworkRepairLoading}
        canLoad={Boolean(dataActions.diagnostics)}
        imageHealth={inspectionActions.imageHealth}
        imageHealthLoading={inspectionActions.imageHealthLoading}
        issueFilter={inspectionActions.imageAuditIssueFilter}
        loading={inspectionActions.imageAuditLoading}
        query={inspectionActions.imageAuditQuery}
        onDiagnoseArtwork={inspectionActions.loadArtworkDiagnosis}
        onIssueFilterChange={inspectionActions.setImageAuditIssueFilter}
        onLoadAudit={inspectionActions.loadImageAudit}
        onLoadImageHealth={inspectionActions.loadImageHealth}
        onOpenGame={onOpenGame}
        onQuarantineContentTypeMismatch={inspectionActions.quarantineContentTypeMismatchFiles}
        onQuarantineDuplicateContent={inspectionActions.quarantineDuplicateContentImages}
        onQuarantineInvalidImages={inspectionActions.quarantineInvalidImageCacheFiles}
        onQuarantineOrphans={inspectionActions.quarantineOrphanImages}
        onQuarantineOversizedImages={inspectionActions.quarantineOversizedImageCacheFiles}
        onQuarantineSafeCacheIssues={inspectionActions.quarantineSafeCacheIssues}
        onQueryChange={inspectionActions.setImageAuditQuery}
        onResetFilters={inspectionActions.resetImageAuditFilters}
        onRevealPath={(path) => void dataActions.revealPath(path)}
        onStartArtworkRepair={queueActions.startArtworkRepair}
      />

      <MaintenanceDuplicateAuditHistoryPanel
        history={historyActions.duplicateAuditHistory}
        loading={historyActions.duplicateAuditHistoryLoading}
        providerFilter={historyActions.duplicateAuditHistoryProvider}
        query={historyActions.duplicateAuditHistoryQuery}
        onLoadHistory={() => historyActions.loadDuplicateAuditHistory()}
        onOpenTask={onOpenTasks}
        onProviderFilterChange={historyActions.setDuplicateAuditHistoryProvider}
        onQueryChange={historyActions.setDuplicateAuditHistoryQuery}
        onResetFilters={historyActions.resetDuplicateAuditHistoryFilters}
      />

      <MaintenanceDuplicateMergePanel
        duplicateExternalIdGroupCount={externalIds?.duplicateExternalIdGroupsCount ?? 0}
        duplicateGroupFiltersActive={duplicateMergeActions.duplicateGroupFiltersActive}
        duplicateGroupProvider={duplicateMergeActions.duplicateGroupProvider}
        duplicateGroupQuery={duplicateMergeActions.duplicateGroupQuery}
        duplicateGroups={duplicateMergeActions.duplicateGroups}
        filteredDuplicateGroups={duplicateMergeActions.filteredDuplicateGroups}
        loading={duplicateMergeActions.duplicateGroupsLoading}
        mergeLoading={duplicateMergeActions.mergeLoading}
        mergePreview={duplicateMergeActions.mergePreview}
        mergeSourceIds={duplicateMergeActions.mergeSourceIds}
        mergeTargetId={duplicateMergeActions.mergeTargetId}
        recommendedMergeTargetId={duplicateMergeActions.recommendedMergeTargetId}
        selectedDuplicateGroup={duplicateMergeActions.selectedDuplicateGroup}
        selectedDuplicateKey={duplicateMergeActions.selectedDuplicateKey}
        onCopyPath={(label, path) => void dataActions.copyPath(label, path)}
        onLoadGroups={() => duplicateMergeActions.loadDuplicateGroups()}
        onMergeGroup={duplicateMergeActions.mergeDuplicateGroup}
        onMergeTargetChange={duplicateMergeActions.updateMergeTarget}
        onPreviewMerge={duplicateMergeActions.previewDuplicateMerge}
        onProviderChange={duplicateMergeActions.updateDuplicateGroupProvider}
        onQueryChange={duplicateMergeActions.updateDuplicateGroupQuery}
        onResetFilters={duplicateMergeActions.resetDuplicateGroupFilters}
        onSelectedDuplicateKeyChange={duplicateMergeActions.updateSelectedDuplicateKey}
      />

      <MaintenanceTasksPanel
        actionBusyTaskId={taskActions.maintenanceTaskActionId}
        filteredTasks={taskActions.filteredMaintenanceTasks}
        filter={taskActions.maintenanceTaskFilter}
        loading={taskActions.maintenanceTasksLoading}
        shortcuts={taskActions.maintenanceTaskShortcuts}
        summary={taskActions.maintenanceTaskSummary}
        tasks={taskActions.maintenanceTasks}
        onCancelTask={taskActions.cancelMaintenanceTask}
        onFilterChange={taskActions.setMaintenanceTaskFilter}
        onOpenTask={onOpenTasks}
        onRefresh={() => void taskActions.loadMaintenanceTasks()}
        onRetryTask={taskActions.retryMaintenanceTask}
      />

      <MaintenanceQueuePanel
        artworkRepairLoading={queueActions.artworkRepairLoading}
        descriptionImages={descriptionImages}
        descriptionRepairLoading={queueActions.descriptionRepairLoading}
        duplicateAuditLoading={queueActions.duplicateAuditLoading}
        externalIds={externalIds}
        metadata={metadata}
        metadataRepairLoading={queueActions.metadataRepairLoading}
        missingArtworkFieldCount={missingArtworkFieldCount}
        onOpenMetadata={onOpenMetadata}
        onStartArtworkRepair={queueActions.startArtworkRepair}
        onStartDescriptionImageRepair={queueActions.startDescriptionImageRepair}
        onStartDuplicateExternalIdAudit={queueActions.startDuplicateExternalIdAudit}
        onStartMetadataRepair={queueActions.startMetadataRepair}
      />
    </>
  );
}
