import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/services/api';
import { chooseDirectory } from '@/services/dialog';
import type { Game } from '@/types/game';
import type { SaveBackup, SavePath, SavePathCandidate, SaveRestoreMode, SaveRestorePreview } from '@/types/saves';
import { errorMessage } from '@/utils/errorMessage';
import { restoreConfirmationMessage, restorePreviewKey } from './SaveRestorePreviewBlock';
import { restorePreviewCompletionMessage, restoreTaskMessage, savePathCandidateMessage } from './savesPageModel';

type TaskMessage = { text: string; taskId?: string | null };

export function useSavesPageActions(refreshKey: number) {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [paths, setPaths] = useState<SavePath[]>([]);
  const [backups, setBackups] = useState<SaveBackup[]>([]);
  const [candidates, setCandidates] = useState<SavePathCandidate[]>([]);
  const [label, setLabel] = useState('默认存档');
  const [path, setPath] = useState('');
  const [backupLabel, setBackupLabel] = useState('手动备份');
  const [loading, setLoading] = useState(false);
  const [restorePreviews, setRestorePreviews] = useState<Record<string, SaveRestorePreview>>({});
  const [restorePreviewLoadingKey, setRestorePreviewLoadingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<TaskMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedGame = useMemo(() => games.find((game) => game.id === selectedGameId) ?? null, [games, selectedGameId]);

  const refreshSaves = useCallback(async (gameId = selectedGameId) => {
    if (!gameId) return;
    try {
      const [nextPaths, nextBackups] = await Promise.all([api.listSavePaths(gameId), api.listSaveBackups(gameId)]);
      setPaths(nextPaths);
      setBackups(nextBackups);
      setCandidates([]);
      setRestorePreviews({});
      setError(null);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }, [selectedGameId]);

  useEffect(() => {
    api.listGames({ sortBy: 'updated_at', sortDirection: 'desc' }).then((items) => {
      setGames(items);
      setSelectedGameId((current) => current ?? items[0]?.id ?? null);
    }).catch((reason: unknown) => setError(errorMessage(reason)));
  }, [refreshKey]);

  useEffect(() => {
    if (!selectedGameId) {
      setPaths([]);
      setBackups([]);
      setCandidates([]);
      setRestorePreviews({});
      return;
    }
    void refreshSaves(selectedGameId);
  }, [refreshSaves, selectedGameId]);

  const pickPath = useCallback(async () => {
    const selected = await chooseDirectory(path);
    if (selected) setPath(selected);
  }, [path]);

  const addPath = useCallback(async () => {
    if (!selectedGameId) return;
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      await api.addSavePath(selectedGameId, label, path);
      setPath('');
      setMessage({ text: '存档路径已添加。' });
      await refreshSaves(selectedGameId);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [label, path, refreshSaves, selectedGameId]);

  const suggestPaths = useCallback(async () => {
    if (!selectedGameId) return;
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const nextCandidates = await api.suggestSavePaths(selectedGameId);
      setCandidates(nextCandidates);
      setMessage({ text: savePathCandidateMessage(nextCandidates.length) });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [selectedGameId]);

  const useCandidate = useCallback(async (candidate: SavePathCandidate, mode: 'fill' | 'add') => {
    setLabel(candidate.label);
    setPath(candidate.path);
    if (mode === 'fill' || !selectedGameId || candidate.alreadyAdded) return;
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      await api.addSavePath(selectedGameId, candidate.label, candidate.path);
      setPath('');
      setMessage({ text: '候选存档路径已添加。' });
      await refreshSaves(selectedGameId);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [refreshSaves, selectedGameId]);

  const createBackup = useCallback(async (savePathId: string) => {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const task = await api.createSaveBackupTask(savePathId, backupLabel);
      setMessage({ text: `存档备份任务已创建：${task.id}`, taskId: task.id });
      await refreshSaves();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [backupLabel, refreshSaves]);

  const loadRestorePreview = useCallback(async (backup: SaveBackup, mode: SaveRestoreMode, announce = true) => {
    const key = restorePreviewKey(backup.id, mode);
    setRestorePreviewLoadingKey(key);
    setError(null);
    if (announce) setMessage(null);
    try {
      const preview = await api.previewSaveRestore(backup.id, mode);
      setRestorePreviews((current) => ({ ...current, [key]: preview }));
      if (announce) setMessage({ text: restorePreviewCompletionMessage(mode, preview) });
      return preview;
    } catch (reason) {
      setError(errorMessage(reason));
      return null;
    } finally {
      setRestorePreviewLoadingKey(null);
    }
  }, []);

  const restore = useCallback(async (backup: SaveBackup, mode: SaveRestoreMode = 'merge') => {
    const preview = restorePreviews[restorePreviewKey(backup.id, mode)] ?? await loadRestorePreview(backup, mode, false);
    if (!preview) return;
    const ok = window.confirm(restoreConfirmationMessage(mode, preview));
    if (!ok) return;
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const task = await api.restoreSaveBackupTask(backup.id, mode);
      setMessage({ text: restoreTaskMessage(mode, task.id), taskId: task.id });
      await refreshSaves();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [loadRestorePreview, refreshSaves, restorePreviews]);

  const removePath = useCallback(async (item: SavePath) => {
    if (!window.confirm(`移除存档路径「${item.label}」？这只删除 MikaVN 里的路径记录，不会删除真实存档目录，也不会删除已有备份。`)) return;
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      await api.removeSavePath(item.id);
      setMessage({ text: '存档路径记录已移除，真实存档目录未被删除。' });
      await refreshSaves();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [refreshSaves]);

  const deleteBackup = useCallback(async (backup: SaveBackup) => {
    if (!window.confirm(`删除备份记录「${backup.label}」？这只删除数据库记录，不会删除备份文件夹。`)) return;
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      await api.deleteSaveBackupRecord(backup.id);
      setMessage({ text: '备份记录已删除，备份文件夹未被删除。' });
      await refreshSaves();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [refreshSaves]);

  const reveal = useCallback(async (targetPath: string) => {
    setMessage(null);
    setError(null);
    try {
      await api.revealPath(targetPath);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }, []);

  const copyPath = useCallback(async (copyLabel: string, targetPath: string) => {
    setMessage(null);
    setError(null);
    try {
      await navigator.clipboard.writeText(targetPath);
      setMessage({ text: `已复制${copyLabel}路径。` });
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }, []);

  return {
    addPath,
    backupLabel,
    backups,
    candidates,
    copyPath,
    createBackup,
    deleteBackup,
    error,
    games,
    label,
    loadRestorePreview,
    loading,
    message,
    path,
    paths,
    pickPath,
    removePath,
    restore,
    restorePreviewLoadingKey,
    restorePreviews,
    reveal,
    selectedGame,
    selectedGameId,
    setBackupLabel,
    setLabel,
    setPath,
    setSelectedGameId,
    suggestPaths,
    useCandidate,
  };
}
