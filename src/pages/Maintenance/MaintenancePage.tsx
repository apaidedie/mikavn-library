import { ListChecks, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PageFrame, PageHeader, PageShell } from '@/components/ui/page';
import type { LibraryFilterPreset } from '@/types/game';
import type { TaskRecord } from '@/types/task';
import { MaintenancePageContent } from './MaintenancePageContent';
import { MaintenanceStatusNotices } from './MaintenanceStatusNotices';
import { useMaintenanceDataActions } from './useMaintenanceDataActions';
import { useMaintenanceDuplicateMergeActions } from './useMaintenanceDuplicateMergeActions';
import { useMaintenanceHistoryActions } from './useMaintenanceHistoryActions';
import { useMaintenanceInspectionActions } from './useMaintenanceInspectionActions';
import { useMaintenanceQueueActions } from './useMaintenanceQueueActions';
import { useMaintenanceTasks } from './useMaintenanceTasks';

type TaskMessage = { text: string; taskId?: string | null };

type MaintenancePageProps = {
  focusRequestKey?: number;
  focusSection?: string | null;
  onOpenGame?: (gameId: string) => void;
  onOpenLibrary?: (preset?: LibraryFilterPreset | null) => void;
  onOpenMetadata?: (preset?: { query?: string; missingProvider?: string } | null) => void;
  onOpenTasks?: (taskId?: string | null) => void;
  refreshKey: number;
};

export function MaintenancePage({ refreshKey, focusSection, focusRequestKey = 0, onOpenGame, onOpenLibrary, onOpenMetadata, onOpenTasks }: MaintenancePageProps) {
  const imageAuditRef = useRef<HTMLElement | null>(null);
  const handledFocusKeyRef = useRef<number | null>(null);
  const [message, setMessage] = useState<TaskMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dataActions = useMaintenanceDataActions({ setError, setMessage });
  const inspectionActions = useMaintenanceInspectionActions({ setError, setMessage });
  const historyActions = useMaintenanceHistoryActions({ setError, setMessage });
  const duplicateMergeActions = useMaintenanceDuplicateMergeActions({
    loadDiagnostics: dataActions.loadDiagnostics,
    setError,
    setMessage,
  });
  const refreshTaskHistory = useCallback(async (task: TaskRecord) => {
    await historyActions.refreshHistoryForTaskType(task.taskType);
  }, [historyActions.refreshHistoryForTaskType]);
  const taskActions = useMaintenanceTasks({
    onTaskRetried: refreshTaskHistory,
    setError,
    setMessage,
  });
  const queueActions = useMaintenanceQueueActions({
    loadDiagnostics: dataActions.loadDiagnostics,
    loadMaintenanceTasks: taskActions.loadMaintenanceTasks,
    onOpenTasks,
    refreshHistoryForTaskType: historyActions.refreshHistoryForTaskType,
    setError,
    setMessage,
  });

  useEffect(() => {
    void dataActions.loadDiagnostics();
    void taskActions.loadMaintenanceTasks();
  }, [dataActions.loadDiagnostics, refreshKey, taskActions.loadMaintenanceTasks]);

  useEffect(() => {
    if (focusSection !== 'image-audit' || handledFocusKeyRef.current === focusRequestKey) return;
    handledFocusKeyRef.current = focusRequestKey;
    window.requestAnimationFrame(() => {
      imageAuditRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    if (!inspectionActions.imageAudit && !inspectionActions.imageAuditLoading) {
      void inspectionActions.loadImageAudit();
    }
  }, [focusRequestKey, focusSection, inspectionActions.imageAudit, inspectionActions.imageAuditLoading, inspectionActions.loadImageAudit]);

  useEffect(() => {
    if (focusSection !== 'image-health' || handledFocusKeyRef.current === focusRequestKey) return;
    handledFocusKeyRef.current = focusRequestKey;
    window.requestAnimationFrame(() => {
      imageAuditRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    if (!inspectionActions.imageHealth && !inspectionActions.imageHealthLoading) {
      void inspectionActions.loadImageHealth();
    }
  }, [focusRequestKey, focusSection, inspectionActions.imageHealth, inspectionActions.imageHealthLoading, inspectionActions.loadImageHealth]);

  return (
    <PageShell>
      <PageFrame className="max-w-[88rem] gap-5">
        <PageHeader
          title="维护中心"
          description="本机数据健康、媒体覆盖、重复风险和清理动作。"
          actions={(
            <>
              {onOpenTasks && <Button variant="ghost" onClick={() => onOpenTasks()}><ListChecks className="h-4 w-4" />任务</Button>}
              <Button disabled={dataActions.loading} onClick={dataActions.loadDiagnostics}><RefreshCw className="h-4 w-4" />{dataActions.loading ? '刷新中' : '刷新'}</Button>
            </>
          )}
        />

        <MaintenanceStatusNotices
          diagnostics={dataActions.diagnostics}
          diagnosticExportPath={dataActions.diagnosticExportPath}
          error={error}
          imageQuarantinePath={inspectionActions.imageQuarantinePath}
          message={message}
          onCopyDiagnosticExportPath={dataActions.copyDiagnosticExportPath}
          onCopyImageQuarantineManifestPath={inspectionActions.copyImageQuarantineManifestPath}
          onOpenTask={onOpenTasks}
          onRevealImageQuarantineDir={inspectionActions.revealImageQuarantineDir}
          onRevealDiagnosticExportPath={dataActions.revealDiagnosticExportPath}
        />
        <MaintenancePageContent
          dataActions={dataActions}
          duplicateMergeActions={duplicateMergeActions}
          historyActions={historyActions}
          imageAuditRef={imageAuditRef}
          inspectionActions={inspectionActions}
          queueActions={queueActions}
          taskActions={taskActions}
          onOpenGame={onOpenGame}
          onOpenLibrary={onOpenLibrary}
          onOpenMetadata={onOpenMetadata}
          onOpenTasks={onOpenTasks}
        />
      </PageFrame>
    </PageShell>
  );
}
