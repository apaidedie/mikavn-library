import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/ui/notice';
import { PageFrame, PageShell } from '@/components/ui/page';
import { api } from '@/services/api';
import type { SettingsSection, SettingsTab } from '@/pages/Settings/SettingsPage';
import type { AppDataDiagnostics } from '@/types/archive';
import type { DashboardData, Game, LibraryFilterPreset } from '@/types/game';
import type { TaskFilterPreset, TaskRecord } from '@/types/task';
import { errorMessage } from '@/utils/errorMessage';
import { DashboardErrorNotice } from './DashboardErrorNotice';
import { ContinuePanel, TodayStrip } from './DashboardHeroPanels';
import { LocalSafetyPanel, NeedsAttentionPanel } from './DashboardLocalPanels';
import { deriveDashboardAttentionItems, deriveDashboardTaskSummary, rankContinueGames, uniqueDashboardGames } from './dashboardPersonal';
import { RecentTasksPanel } from './RecentTasksPanel';
import { useDashboardDiagnosticExport } from './useDashboardDiagnosticExport';

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
  const [data, setData] = useState<DashboardData | null>(null);
  const [playingGames, setPlayingGames] = useState<Game[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [diagnostics, setDiagnostics] = useState<AppDataDiagnostics | null>(null);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sectionErrors, setSectionErrors] = useState<string[]>([]);
  const { copyDashboardDiagnosticExportPath, diagnosticExportLoading, diagnosticExportMessage, diagnosticExportPath, exportDiagnosticPackage, revealDiagnosticExportPath } = useDashboardDiagnosticExport();

  useEffect(() => {
    let cancelled = false;
    const errors: string[] = [];
    setSectionErrors([]);

    api
      .getDashboard()
      .then((next) => {
        if (!cancelled) {
          setData(next);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(errorMessage(reason));
      });

    api.listTasks(8).then((next) => !cancelled && setTasks(next)).catch(() => !cancelled && setTasks([]));
    api.getAppSettings().then((next) => !cancelled && setSettings(next)).catch(() => undefined);
    api.getAppDataDiagnostics()
      .then((next) => !cancelled && setDiagnostics(next))
      .catch((reason: unknown) => {
        errors.push(`本地自检暂时不可用：${errorMessage(reason)}`);
        if (!cancelled) setSectionErrors([...errors]);
      });
    api.listGames({ status: 'playing', sortBy: 'last_played_at', sortDirection: 'desc', limit: 24 })
      .then((next) => !cancelled && setPlayingGames(next))
      .catch((reason: unknown) => {
        errors.push(`继续游玩列表暂时不可用：${errorMessage(reason)}`);
        if (!cancelled) setSectionErrors([...errors]);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const hideHidden = settings.privacy_hide_hidden === 'true';
  const continueGames = useMemo(() => data ? rankContinueGames(uniqueDashboardGames([...playingGames, ...data.recentGames, ...data.recentlyAdded]), { hideHidden, limit: 6 }) : [], [data, hideHidden, playingGames]);
  const attentionItems = useMemo(() => deriveDashboardAttentionItems({ diagnostics, tasks }), [diagnostics, tasks]);
  const taskSummary = useMemo(() => deriveDashboardTaskSummary(tasks), [tasks]);

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
