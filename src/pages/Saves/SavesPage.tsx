import { Archive, Clock3, Copy, FolderOpen, FolderPlus, ListChecks, LocateFixed, RotateCcw, Save, ShieldCheck, Trash2 } from 'lucide-react';
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
import type { SaveBackup, SavePath, SavePathCandidate, SaveRestoreMode, SaveRestorePreview } from '@/types/saves';
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
  const [restorePreviews, setRestorePreviews] = useState<Record<string, SaveRestorePreview>>({});
  const [restorePreviewLoadingKey, setRestorePreviewLoadingKey] = useState<string | null>(null);
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
      setRestorePreviews({});
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
      setRestorePreviews({});
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

  const loadRestorePreview = async (backup: SaveBackup, mode: SaveRestoreMode, announce = true) => {
    const key = restorePreviewKey(backup.id, mode);
    setRestorePreviewLoadingKey(key);
    setError(null);
    if (announce) setMessage(null);
    try {
      const preview = await api.previewSaveRestore(backup.id, mode);
      setRestorePreviews((current) => ({ ...current, [key]: preview }));
      if (announce) setMessage({ text: `${restoreModeLabel(mode)}恢复预览完成：新增 ${formatCount(preview.newFiles)}，覆盖 ${formatCount(preview.overwrittenFiles)}，${mode === 'mirror' ? `清理 ${formatCount(preview.removedFiles)}` : `保留 ${formatCount(preview.keptFiles)}`}。` });
      return preview;
    } catch (reason) {
      setError(errorMessage(reason));
      return null;
    } finally {
      setRestorePreviewLoadingKey(null);
    }
  };

  const restore = async (backup: SaveBackup, mode: SaveRestoreMode = 'merge') => {
    const preview = restorePreviews[restorePreviewKey(backup.id, mode)] ?? await loadRestorePreview(backup, mode, false);
    if (!preview) return;
    const ok = window.confirm(restoreConfirmationMessage(mode, preview));
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

  const removePath = async (item: SavePath) => {
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
  };

  const deleteBackup = async (backup: SaveBackup) => {
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

  const copyPath = async (label: string, targetPath: string) => {
    setMessage(null);
    setError(null);
    try {
      await navigator.clipboard.writeText(targetPath);
      setMessage({ text: `已复制${label}路径。` });
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
                    <Button aria-label={`复制${item.label}路径`} size="sm" variant="outline" onClick={() => void copyPath(item.label, item.path)}><Copy className="h-4 w-4" />复制</Button>
                    <Button size="sm" variant="outline" onClick={() => void reveal(item.path)}><FolderOpen className="h-4 w-4" />打开</Button>
                    <Button disabled={loading} size="sm" variant="secondary" onClick={() => createBackup(item.id)}><Save className="h-4 w-4" />备份</Button>
                    <Button aria-label="移除存档路径记录" disabled={loading} size="icon" title="移除存档路径记录" variant="ghost" onClick={() => void removePath(item)}><Trash2 className="h-4 w-4" /></Button>
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
          {backups.length === 0 ? <EmptyState className="flex min-h-[22rem] flex-col items-center justify-center py-12">还没有备份记录。</EmptyState> : backups.map((backup) => {
            const mergeKey = restorePreviewKey(backup.id, 'merge');
            const mirrorKey = restorePreviewKey(backup.id, 'mirror');
            const mergePreview = restorePreviews[mergeKey];
            const mirrorPreview = restorePreviews[mirrorKey];
            return (
              <SoftRow className="space-y-3 px-3 py-2.5" key={backup.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-100">
                      {backup.label}
                      {backup.protection && <Badge>保护备份</Badge>}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{formatDateTime(backup.createdAt)}</div>
                    <div className="mt-2 break-all font-mono text-xs text-slate-500">{backup.backupPath}</div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button aria-label={`复制${backup.label}路径`} size="sm" variant="outline" onClick={() => void copyPath(backup.label, backup.backupPath)}><Copy className="h-4 w-4" />复制</Button>
                    <Button size="sm" variant="outline" onClick={() => void reveal(backup.backupPath)}><FolderOpen className="h-4 w-4" />打开</Button>
                    <Button disabled={loading || restorePreviewLoadingKey === mergeKey} size="sm" variant="ghost" onClick={() => void loadRestorePreview(backup, 'merge')}><ListChecks className="h-4 w-4" />{restorePreviewLoadingKey === mergeKey ? '预览中' : '预览'}</Button>
                    <Button disabled={loading || restorePreviewLoadingKey === mirrorKey} size="sm" variant="ghost" onClick={() => void loadRestorePreview(backup, 'mirror')}><ListChecks className="h-4 w-4" />{restorePreviewLoadingKey === mirrorKey ? '预览中' : '镜像预览'}</Button>
                    <Button disabled={loading || restorePreviewLoadingKey === mergeKey} size="sm" variant="outline" onClick={() => void restore(backup, 'merge')}><RotateCcw className="h-4 w-4" />恢复</Button>
                    <Button disabled={loading || restorePreviewLoadingKey === mirrorKey} size="sm" variant="ghost" onClick={() => void restore(backup, 'mirror')}>镜像恢复</Button>
                    <Button aria-label="删除备份记录" disabled={loading} size="icon" title="删除备份记录" variant="ghost" onClick={() => void deleteBackup(backup)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                {mergePreview && <SaveRestorePreviewBlock preview={mergePreview} />}
                {mirrorPreview && <SaveRestorePreviewBlock preview={mirrorPreview} />}
              </SoftRow>
            );
          })}
        </PanelContent>
      </Panel>
        </div>
      </PageFrame>
    </PageShell>
  );
}

function SaveRestorePreviewBlock({ preview }: { preview: SaveRestorePreview }) {
  const isMirror = preview.mode === 'mirror';
  return (
    <div className="rounded-md border border-white/[0.08] bg-black/[0.12] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-100">
          <Badge className={isMirror ? 'border-rose-300/25 bg-rose-300/10 text-rose-100' : 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'}>{restoreModeLabel(preview.mode as SaveRestoreMode)}预览</Badge>
          <span>备份 {formatCount(preview.backupFileCount)} 个文件，当前 {formatCount(preview.currentFileCount)} 个文件</span>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <PreviewStat label="新增" value={preview.newFiles} tone={preview.newFiles > 0 ? 'ok' : 'neutral'} />
        <PreviewStat label="覆盖" value={preview.overwrittenFiles} tone={preview.overwrittenFiles > 0 ? 'warn' : 'neutral'} />
        <PreviewStat label={isMirror ? '将清理' : '将保留'} value={isMirror ? preview.removedFiles : preview.keptFiles} tone={(isMirror ? preview.removedFiles : preview.keptFiles) > 0 ? 'warn' : 'neutral'} />
        <PreviewStat label="备份文件" value={preview.backupFileCount} />
      </div>
      <div className="mt-3 grid gap-2 text-[11px] leading-5 lg:grid-cols-2">
        <PreviewSamples label="新增样例" values={preview.sampleNewFiles} />
        <PreviewSamples label="覆盖样例" values={preview.sampleOverwrittenFiles} />
        <PreviewSamples label={isMirror ? '清理样例' : '保留样例'} values={isMirror ? preview.sampleRemovedFiles : preview.sampleKeptFiles} />
      </div>
    </div>
  );
}

function PreviewStat({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'ok' | 'warn' }) {
  const toneClass = tone === 'ok' ? 'text-emerald-200' : tone === 'warn' ? 'text-amber-200' : 'text-slate-200';
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-sm ${toneClass}`}>{formatCount(value)}</div>
    </div>
  );
}

function PreviewSamples({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="min-w-0 rounded-md border border-white/[0.06] bg-black/[0.10] px-2.5 py-2">
      <div className="mb-1 text-slate-600">{label}</div>
      <div className="space-y-0.5">
        {values.map((value) => <div className="truncate font-mono text-slate-400" key={value} title={value}>{value}</div>)}
      </div>
    </div>
  );
}

function restorePreviewKey(backupId: string, mode: SaveRestoreMode) {
  return `${backupId}:${mode}`;
}

function restoreModeLabel(mode: SaveRestoreMode | string) {
  return mode === 'mirror' ? '镜像' : '合并';
}

function restoreConfirmationMessage(mode: SaveRestoreMode, preview: SaveRestorePreview) {
  const summary = `${restoreModeLabel(mode)}恢复预览：新增 ${formatCount(preview.newFiles)} 个，覆盖 ${formatCount(preview.overwrittenFiles)} 个，${mode === 'mirror' ? `清理当前 ${formatCount(preview.removedFiles)} 个` : `保留当前 ${formatCount(preview.keptFiles)} 个`}。`;
  const warning = mode === 'mirror'
    ? '镜像恢复会先创建保护备份，然后清空当前存档目录内容，再复制备份内容。此操作只作用于已登记存档目录。'
    : '合并恢复会先创建保护备份，然后复制备份内容并覆盖同名存档文件，当前目录里的其它文件会保留。';
  return `${summary}\n\n${warning}\n\n确认继续吗？`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}
