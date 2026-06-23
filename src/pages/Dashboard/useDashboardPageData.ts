import { useEffect, useMemo, useState } from 'react';
import { api } from '@/services/api';
import type { AppDataDiagnostics } from '@/types/archive';
import type { DashboardData, Game } from '@/types/game';
import type { TaskRecord } from '@/types/task';
import { errorMessage } from '@/utils/errorMessage';
import { deriveDashboardAttentionItems, deriveDashboardTaskSummary, rankContinueGames, uniqueDashboardGames } from './dashboardPersonal';

export function useDashboardPageData(refreshKey: number) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [playingGames, setPlayingGames] = useState<Game[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [diagnostics, setDiagnostics] = useState<AppDataDiagnostics | null>(null);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sectionErrors, setSectionErrors] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const errors: string[] = [];
    const showSectionError = (message: string) => {
      errors.push(message);
      if (!cancelled) setSectionErrors([...errors]);
    };
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
      .catch((reason: unknown) => showSectionError(`本地自检暂时不可用：${errorMessage(reason)}`));
    api.listGames({ status: 'playing', sortBy: 'last_played_at', sortDirection: 'desc', limit: 24 })
      .then((next) => !cancelled && setPlayingGames(next))
      .catch((reason: unknown) => showSectionError(`继续游玩列表暂时不可用：${errorMessage(reason)}`));

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const hideHidden = settings.privacy_hide_hidden === 'true';
  const continueGames = useMemo(
    () => data ? rankContinueGames(uniqueDashboardGames([...playingGames, ...data.recentGames, ...data.recentlyAdded]), { hideHidden, limit: 6 }) : [],
    [data, hideHidden, playingGames],
  );
  const attentionItems = useMemo(() => deriveDashboardAttentionItems({ diagnostics, tasks }), [diagnostics, tasks]);
  const taskSummary = useMemo(() => deriveDashboardTaskSummary(tasks), [tasks]);

  return {
    attentionItems,
    continueGames,
    data,
    diagnostics,
    error,
    sectionErrors,
    taskSummary,
    tasks,
  };
}
