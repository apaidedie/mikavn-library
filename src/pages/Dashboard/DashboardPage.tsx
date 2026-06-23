import { EmptyState } from '@/components/ui/notice';
import { PageFrame, PageShell } from '@/components/ui/page';
import type { SettingsSection, SettingsTab } from '@/pages/Settings/SettingsPage';
import type { LibraryFilterPreset } from '@/types/game';
import type { TaskFilterPreset } from '@/types/task';
import { DashboardErrorNotice } from './DashboardErrorNotice';
import { ContinuePanel, TodayStrip } from './DashboardHeroPanels';
import { LocalSafetyPanel, NeedsAttentionPanel } from './DashboardLocalPanels';
import { RecentTasksPanel } from './RecentTasksPanel';
import { useDashboardDiagnosticExport } from './useDashboardDiagnosticExport';
import { useDashboardPageData } from './useDashboardPageData';

type DashboardPageProps = {
  refreshKey: number;
  onOpenGame: (id: string) => void;
  onAddGame?: () => void;
  onOpenScanner?: () => void;
  onOpenLibrary?: (preset?: LibraryFilterPreset | null) => void;
  onOpenMaintenance?: (section?: string | null) => void;
  onOpenMetadata?: (preset?: { query?: string; missingProvider?: string } | null) => void;
  onOpenSaves?: () => void;
  onOpenSettings?: (tab?: SettingsTab, section?: SettingsSection | null) => void;
  onOpenTasks?: (taskId?: string | null, preset?: TaskFilterPreset | null) => void;
};

export function DashboardPage({ refreshKey, onOpenGame, onAddGame, onOpenScanner, onOpenLibrary, onOpenMaintenance, onOpenMetadata, onOpenSaves, onOpenSettings, onOpenTasks }: DashboardPageProps) {
  const { attentionItems, continueGames, data, diagnostics, error, sectionErrors, taskSummary, tasks } = useDashboardPageData(refreshKey);
  const { copyDashboardDiagnosticExportPath, diagnosticExportLoading, diagnosticExportMessage, diagnosticExportPath, exportDiagnosticPackage, revealDiagnosticExportPath } = useDashboardDiagnosticExport();

  if (error) {
    return (
      <div className="p-5">
        <DashboardErrorNotice
          diagnosticExportLoading={diagnosticExportLoading}
          diagnosticExportMessage={diagnosticExportMessage}
          diagnosticExportPath={diagnosticExportPath}
          message={error}
          tone="error"
          onExportDiagnosticPackage={exportDiagnosticPackage}
          onRevealDiagnosticExportPath={revealDiagnosticExportPath}
        />
      </div>
    );
  }

  if (!data) {
    return <div className="p-5"><EmptyState>正在读取本地游戏库...</EmptyState></div>;
  }

  return (
    <PageShell>
      <PageFrame className="max-w-[88rem] gap-6">
        <TodayStrip data={data} attentionCount={attentionItems.length} runningCount={taskSummary.runningCount} onAddGame={onAddGame} onOpenMaintenance={onOpenMaintenance} onOpenScanner={onOpenScanner} onOpenSettings={onOpenSettings} onOpenTasks={onOpenTasks} />
        {sectionErrors.length > 0 && (
          <div className="space-y-2">
            {sectionErrors.map((item) => (
              <DashboardErrorNotice
                diagnosticExportLoading={diagnosticExportLoading}
                diagnosticExportMessage={diagnosticExportMessage}
                diagnosticExportPath={diagnosticExportPath}
                key={item}
                message={item}
                tone="warning"
                onExportDiagnosticPackage={exportDiagnosticPackage}
                onRevealDiagnosticExportPath={revealDiagnosticExportPath}
              />
            ))}
          </div>
        )}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.75fr)]">
          <ContinuePanel games={continueGames} onOpenGame={onOpenGame} onAddGame={onAddGame} onOpenScanner={onOpenScanner} />
          <NeedsAttentionPanel items={attentionItems} onOpenLibrary={onOpenLibrary} onOpenMaintenance={onOpenMaintenance} onOpenMetadata={onOpenMetadata} onOpenSettings={onOpenSettings} onOpenTasks={onOpenTasks} />
        </div>
        <LocalSafetyPanel
          diagnosticExportLoading={diagnosticExportLoading}
          diagnosticExportMessage={diagnosticExportMessage}
          diagnosticExportPath={diagnosticExportPath}
          diagnostics={diagnostics}
          onCopyDiagnosticExportPath={() => void copyDashboardDiagnosticExportPath()}
          onExportDiagnosticPackage={exportDiagnosticPackage}
          onOpenSaves={onOpenSaves}
          onOpenSettings={onOpenSettings}
          onOpenTasks={onOpenTasks}
          onRevealDiagnosticExportPath={revealDiagnosticExportPath}
        />
        <RecentTasksPanel tasks={tasks} onOpenTasks={onOpenTasks} />
      </PageFrame>
    </PageShell>
  );
}
