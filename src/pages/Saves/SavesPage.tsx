import { Archive, Clock3, FolderOpen, FolderPlus, LocateFixed, RotateCcw, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState, Notice } from '@/components/ui/notice';
import { MetricTile, PageFrame, PageHeader, PageShell, Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import { TaskNotice } from '@/components/ui/task-notice';
import { api } from '@/services/api';
import { chooseDirectory } from '@/services/dialog';
import type { Game } from '@/types/game';
import type { SaveBackup, SavePath, SavePathCandidate } from '@/types/saves';
import { errorMessage } from '@/utils/errorMessage';
import { formatDateTime } from '@/utils/time';

type TaskMessage = { text: string; taskId?: string | null };

export function SavesPage({ refreshKey, onOpenTask }: { refreshKey: number; onOpenTask?: (taskId: string) => void }) {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [paths, setPaths] = useState<SavePath[]>([]);
  const [backups, setBackups] = useState<SaveBackup[]>([]);
  const [candidates, setCandidates] = useState<SavePathCandidate[]>([]);
  const [label, setLabel] = useState('默认存档');
  const [path, setPath] = useState('');
  const [backupLabel, setBackupLabel] = useState('手动备份');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<TaskMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedGame = useMemo(() => games.find((game) => game.id === selectedGameId) ?? null, [games, selectedGameId]);

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
      return;
    }
    refreshSaves(selectedGameId);
  }, [selectedGameId]);

  const refreshSaves = async (gameId = selectedGameId) => {
    if (!gameId) return;
    try {
      const [nextPaths, nextBackups] = await Promise.all([api.listSavePaths(gameId), api.listSaveBackups(gameId)]);
      setPaths(nextPaths);
      setBackups(nextBackups);
      setCandidates([]);
      setError(null);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  const pickPath = async () => {
    const selected = await chooseDirectory(path);
    if (selected) setPath(selected);
  };

  const addPath = async () => {
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
  };

  const suggestPaths = async () => {
    if (!selectedGameId) return;
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const nextCandidates = await api.suggestSavePaths(selectedGameId);
      setCandidates(nextCandidates);
      setMessage({ text: nextCandidates.length === 0 ? '没有发现已存在的常见存档目录。' : `发现 ${nextCandidates.length} 个候选存档目录。` });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  };

  const useCandidate = async (candidate: SavePathCandidate, mode: 'fill' | 'add') => {
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
  };

  const createBackup = async (savePathId: string) => {
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
  };

  const restore = async (backup: SaveBackup, mode: 'merge' | 'mirror' = 'merge') => {
    const prompt = mode === 'mirror'
      ? '镜像恢复会先创建保护备份，然后清空当前存档目录内容，再复制备份内容。此操作只作用于已登记存档目录。确认继续吗？'
      : '合并恢复会覆盖同名存档文件；恢复前会自动创建保护备份。确认继续吗？';
    const ok = window.confirm(prompt);
    if (!ok) return;
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const task = await api.restoreSaveBackupTask(backup.id, mode);
      setMessage({ text: `${mode === 'mirror' ? '镜像' : '合并'}存档恢复任务已创建：${task.id}`, taskId: task.id });
      await refreshSaves();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  };

  const removePath = async (id: string) => {
    await api.removeSavePath(id);
    await refreshSaves();
  };

  const deleteBackup = async (id: string) => {
    await api.deleteSaveBackupRecord(id);
    await refreshSaves();
  };

  const reveal = async (targetPath: string) => {
    setMessage(null);
    setError(null);
    try {
      await api.revealPath(targetPath);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  return (
    <PageShell>
      <PageFrame>
        <PageHeader title="存档管理" description="为每个游戏配置存档目录，手动备份，恢复前自动创建保护备份。" />
        {(error || message) && (
          <div className="space-y-2">
            {error && <Notice tone="error">{error}</Notice>}
            {message && <TaskNotice message={message.text} taskId={message.taskId} onOpenTask={onOpenTask} />}
          </div>
        )}

        <div className="grid min-h-[calc(100vh-9rem)] gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
      <Panel>
        <PanelHeader title="存档路径" icon={<Archive className="h-4 w-4" />} />
        <PanelContent className="space-y-4">
          <SoftRow className="px-3 py-2.5">
            <Label>游戏</Label>
            <Select className="mt-2 w-full" value={selectedGameId ?? ''} onChange={(event) => setSelectedGameId(event.target.value || null)}>
              {games.map((game) => <option key={game.id} value={game.id}>{game.title}</option>)}
            </Select>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MetricTile icon={<FolderPlus className="h-3.5 w-3.5" />} label="存档路径" value={`${paths.length}`} />
              <MetricTile icon={<ShieldCheck className="h-3.5 w-3.5" />} label="备份记录" value={`${backups.length}`} />
            </div>
          </SoftRow>

          <SoftRow className="grid gap-3 px-3 py-2.5 md:grid-cols-[0.7fr_1fr_auto]">
            <label className="space-y-1.5"><Label>标签</Label><Input value={label} onChange={(event) => setLabel(event.target.value)} /></label>
            <label className="space-y-1.5"><Label>存档目录</Label><Input value={path} onChange={(event) => setPath(event.target.value)} /></label>
            <div className="flex items-end gap-2">
              <Button variant="secondary" onClick={pickPath}><FolderPlus className="h-4 w-4" />选择</Button>
              <Button disabled={!selectedGameId || !path.trim() || loading} onClick={addPath}>添加</Button>
            </div>
          </SoftRow>

          <SoftRow className="space-y-3 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-100">候选存档目录</div>
                <div className="mt-1 text-xs text-slate-500">只查找已存在的常见位置，添加前由你确认。</div>
              </div>
              <Button disabled={!selectedGameId || loading} size="sm" variant="outline" onClick={suggestPaths}><LocateFixed className="h-4 w-4" />查找候选</Button>
            </div>
            {candidates.length > 0 && (
              <div className="space-y-2">
                {candidates.map((candidate) => (
                  <div className="rounded-md border border-white/10 bg-black/[0.12] p-2.5" key={candidate.path}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-100">
                          <span>{candidate.label}</span>
                          {candidate.alreadyAdded && <Badge>已添加</Badge>}
                          {candidate.exists && <Badge>已存在</Badge>}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{candidate.reason}</div>
                        <div className="mt-1 break-all font-mono text-xs text-slate-400">{candidate.path}</div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" variant="ghost" onClick={() => void useCandidate(candidate, 'fill')}>填入</Button>
                        <Button disabled={candidate.alreadyAdded || loading} size="sm" variant="secondary" onClick={() => void useCandidate(candidate, 'add')}>添加</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SoftRow>

          <SoftRow className="space-y-2 px-3 py-2.5">
            <Label>备份标签</Label>
            <Input value={backupLabel} onChange={(event) => setBackupLabel(event.target.value)} />
          </SoftRow>

          <div className="space-y-2">
            {paths.length === 0 ? <EmptyState className="py-8">还没有配置存档路径。</EmptyState> : paths.map((item) => (
              <SoftRow className="px-3 py-2.5" key={item.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-100">{item.label}</div>
                    <div className="mt-1 break-all font-mono text-xs text-slate-500">{item.path}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => void reveal(item.path)}><FolderOpen className="h-4 w-4" />打开</Button>
                    <Button disabled={loading} size="sm" variant="secondary" onClick={() => createBackup(item.id)}><Save className="h-4 w-4" />备份</Button>
                    <Button size="icon" variant="ghost" onClick={() => removePath(item.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </SoftRow>
            ))}
          </div>
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader title="备份历史" description={selectedGame ? selectedGame.title : '选择游戏后显示备份历史。'} icon={<Clock3 className="h-4 w-4" />} />
        <PanelContent className="max-h-[calc(100vh-12rem)] space-y-2 overflow-auto pr-1">
          {backups.length === 0 ? <EmptyState className="flex min-h-[22rem] flex-col items-center justify-center py-12">还没有备份记录。</EmptyState> : backups.map((backup) => (
            <SoftRow className="px-3 py-2.5" key={backup.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-100">
                    {backup.label}
                    {backup.protection && <Badge>保护备份</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{formatDateTime(backup.createdAt)}</div>
                  <div className="mt-2 break-all font-mono text-xs text-slate-500">{backup.backupPath}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void reveal(backup.backupPath)}><FolderOpen className="h-4 w-4" />打开</Button>
                  <Button disabled={loading} size="sm" variant="outline" onClick={() => restore(backup, 'merge')}><RotateCcw className="h-4 w-4" />恢复</Button>
                  <Button disabled={loading} size="sm" variant="ghost" onClick={() => restore(backup, 'mirror')}>镜像恢复</Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteBackup(backup.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </SoftRow>
          ))}
        </PanelContent>
      </Panel>
        </div>
      </PageFrame>
    </PageShell>
  );
}
