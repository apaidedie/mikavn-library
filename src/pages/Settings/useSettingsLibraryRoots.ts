import { useCallback, useState } from 'react';
import { api } from '@/services/api';
import { chooseDirectory } from '@/services/dialog';
import type { LibraryRoot } from '@/types/game';
import { errorMessage } from '@/utils/errorMessage';

type TaskMessage = { text: string; taskId?: string | null };

type UseSettingsLibraryRootsOptions = {
  onSaved?: () => void;
  setError: (message: string | null) => void;
  setMessage: (message: TaskMessage | null) => void;
};

export function useSettingsLibraryRoots({ onSaved, setError, setMessage }: UseSettingsLibraryRootsOptions) {
  const [libraryRoots, setLibraryRoots] = useState<LibraryRoot[]>([]);
  const [libraryRootPath, setLibraryRootPath] = useState('');
  const [rootActionId, setRootActionId] = useState<string | null>(null);

  const loadLibraryRoots = useCallback(async () => {
    try {
      setLibraryRoots(await api.listLibraryRoots());
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }, [setError]);

  const pickLibraryRoot = useCallback(async () => {
    const selected = await chooseDirectory(libraryRootPath);
    if (selected) setLibraryRootPath(selected);
  }, [libraryRootPath]);

  const addLibraryRoot = useCallback(async () => {
    setError(null);
    setMessage(null);
    try {
      const path = libraryRootPath.trim() || await chooseDirectory(libraryRootPath);
      if (!path) return;
      await api.addLibraryRoot(path);
      setLibraryRootPath('');
      setMessage({ text: '库目录已添加。扫描会先生成候选，由你确认后才写入数据库。' });
      await loadLibraryRoots();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }, [libraryRootPath, loadLibraryRoots, setError, setMessage]);

  const updateLibraryRoot = useCallback(async (root: LibraryRoot, input: { recursive?: boolean; enabled?: boolean }) => {
    setRootActionId(root.id);
    setError(null);
    try {
      await api.updateLibraryRoot(root.id, input);
      await loadLibraryRoots();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setRootActionId(null);
    }
  }, [loadLibraryRoots, setError]);

  const removeLibraryRoot = useCallback(async (root: LibraryRoot) => {
    if (!window.confirm('移除这个库目录记录？不会删除真实文件，也不会删除已入库游戏。')) return;
    setRootActionId(root.id);
    setError(null);
    try {
      await api.removeLibraryRoot(root.id);
      setMessage({ text: '库目录记录已移除，不影响真实文件和已入库游戏。' });
      await loadLibraryRoots();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setRootActionId(null);
    }
  }, [loadLibraryRoots, setError, setMessage]);

  const scanLibraryRoot = useCallback(async (root: LibraryRoot) => {
    setRootActionId(root.id);
    setError(null);
    setMessage(null);
    try {
      const task = await api.startScanTask(root.path, root.recursive);
      setMessage({ text: `已创建库目录扫描任务：${task.id}。请到扫描入库或任务页查看候选与进度。`, taskId: task.id });
      onSaved?.();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setRootActionId(null);
    }
  }, [onSaved, setError, setMessage]);

  return {
    addLibraryRoot,
    libraryRootPath,
    libraryRoots,
    loadLibraryRoots,
    pickLibraryRoot,
    removeLibraryRoot,
    rootActionId,
    scanLibraryRoot,
    setLibraryRootPath,
    updateLibraryRoot,
  };
}
