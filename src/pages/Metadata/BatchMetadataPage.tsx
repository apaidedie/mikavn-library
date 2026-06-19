import { Notice } from '@/components/ui/notice';
import { PageFrame, PageHeader, PageShell } from '@/components/ui/page';
import { TaskNotice } from '@/components/ui/task-notice';
import { BatchMetadataQueuePanel } from './BatchMetadataQueuePanel';
import { BatchMetadataResultsPanel } from './BatchMetadataResultsPanel';
import type { QueuePresetRequest } from './batchMetadataPageModel';
import { useBatchMetadataPageActions } from './useBatchMetadataPageActions';

type BatchMetadataPageProps = {
  refreshKey: number;
  queuePresetRequest?: QueuePresetRequest | null;
  onOpenTask?: (taskId: string) => void;
};

export function BatchMetadataPage({ refreshKey, queuePresetRequest, onOpenTask }: BatchMetadataPageProps) {
  const page = useBatchMetadataPageActions(refreshKey, queuePresetRequest);
  const actions = page.actions;

  return (
    <PageShell>
      <PageFrame>
        <PageHeader title="批量匹配" description="选择元数据不完整的游戏，按 ButterFetch 风格批量匹配 VNDB / DLsite / FANZA。" />
        {(page.error || page.message) && (
          <div className="space-y-2">
            {page.error && <Notice tone="error">{page.error}</Notice>}
            {page.message && <TaskNotice message={page.message.text} taskId={page.message.taskId} onOpenTask={onOpenTask} />}
          </div>
        )}

        <div className="grid min-h-[calc(100vh-9rem)] gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <BatchMetadataQueuePanel
            fields={page.fields}
            filteredIncompleteGames={page.filteredIncompleteGames}
            incompleteGames={page.incompleteGames}
            loading={page.loading}
            missingProviderFilter={page.missingProviderFilter}
            queueGapCounts={page.queueGapCounts}
            queueQuery={page.queueQuery}
            selectedIds={page.selectedIds}
            onFieldsChange={actions.setFields}
            onMissingProviderFilterChange={actions.setMissingProviderFilter}
            onQueueQueryChange={actions.setQueueQuery}
            onResetQueueFilters={actions.resetQueueFilters}
            onSelectIds={actions.setSelectedIds}
            onStart={() => void actions.start()}
            onToggleField={actions.toggleField}
            onToggleGame={actions.toggleGame}
          />

          <BatchMetadataResultsPanel
            appliedIds={page.appliedIds}
            applyingIds={page.applyingIds}
            expandedIds={page.expandedIds}
            fields={page.fields}
            filteredApplicableResults={page.filteredApplicableResults}
            filteredResults={page.filteredResults}
            loading={page.loading}
            resultCounts={page.resultCounts}
            resultQuery={page.resultQuery}
            resultStatusFilter={page.resultStatusFilter}
            selectedCandidates={page.selectedCandidates}
            status={page.status}
            writeFilter={page.writeFilter}
            onApplyAll={() => void actions.applyAll()}
            onApplyResult={(result) => void actions.applyResult(result)}
            onCancel={() => void actions.cancel()}
            onChooseCandidate={actions.chooseCandidate}
            onResetResultFilters={actions.resetResultFilters}
            onResultQueryChange={actions.setResultQuery}
            onResultStatusFilterChange={actions.setResultStatusFilter}
            onToggleExpanded={actions.toggleExpanded}
            onWriteFilterChange={actions.setWriteFilter}
          />
        </div>
      </PageFrame>
    </PageShell>
  );
}
