import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { PageFrame, PageHeader, PageShell } from '@/components/ui/page';
import type { TaskFilterPreset } from '@/types/task';
import { TaskOverviewPanel } from './TaskOverviewPanel';
import { TaskQueuePanel } from './TaskQueuePanel';
import { useTasksPageActions } from './useTasksPageActions';

export function TasksPage({ refreshKey, focusTaskId, focusRequestKey = 0, filterPreset }: { refreshKey: number; focusTaskId?: string | null; focusRequestKey?: number; filterPreset?: (TaskFilterPreset & { key: number }) | null }) {
  const tasksPage = useTasksPageActions({ filterPreset, focusRequestKey, focusTaskId, refreshKey });

  return (
    <PageShell>
      <PageFrame className="max-w-[76rem] gap-6">
        <PageHeader
          title="任务"
          description="扫描、元数据、备份和导出等长任务会逐步汇总到这里。"
          actions={<Button disabled={tasksPage.loading} variant="outline" onClick={() => void tasksPage.loadTasks()}><RefreshCw className="h-4 w-4" />刷新</Button>}
        />
        {tasksPage.error && <Notice tone="error">{tasksPage.error}</Notice>}
        {tasksPage.message && <Notice>{tasksPage.message}</Notice>}

        <TaskOverviewPanel
          filteredTasks={tasksPage.filteredTasks}
          statusFilter={tasksPage.statusFilter}
          taskQuery={tasksPage.taskQuery}
          tasks={tasksPage.tasks}
          typeFilter={tasksPage.typeFilter}
          onApplyStatusShortcut={tasksPage.applyStatusShortcut}
          onApplyTypeShortcut={tasksPage.applyTypeShortcut}
          onCopyTaskDiagnostic={(task) => void tasksPage.copyTaskDiagnostic(task)}
          onOpenResultLogs={(id) => void tasksPage.openResultLogs(id)}
          onResetFilters={tasksPage.resetFilters}
          onRetry={(id) => void tasksPage.retry(id)}
          onStatusFilterChange={tasksPage.setStatusFilter}
          onTaskQueryChange={tasksPage.setTaskQuery}
          onTypeFilterChange={tasksPage.setTypeFilter}
        />

        <TaskQueuePanel
          expandedId={tasksPage.expandedId}
          filteredTasks={tasksPage.filteredTasks}
          focusTaskId={focusTaskId}
          logsByTask={tasksPage.logsByTask}
          logQueryByTask={tasksPage.logQueryByTask}
          tasks={tasksPage.tasks}
          onCancel={(id) => void tasksPage.cancel(id)}
          onCopyTaskDiagnostic={(task) => void tasksPage.copyTaskDiagnostic(task)}
          onCopyTaskLog={(log) => void tasksPage.copyTaskLog(log)}
          onLogQueryChange={tasksPage.setLogQuery}
          onResetFilters={tasksPage.resetFilters}
          onRetry={(id) => void tasksPage.retry(id)}
          onRowRef={tasksPage.setRowRef}
          onToggleExpanded={(id) => void tasksPage.toggleExpanded(id)}
        />
      </PageFrame>
    </PageShell>
  );
}
