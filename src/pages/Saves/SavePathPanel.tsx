import { Archive, Copy, FolderOpen, FolderPlus, LocateFixed, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/notice';
import { MetricTile, Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import type { Game } from '@/types/game';
import type { SaveBackup, SavePath, SavePathCandidate } from '@/types/saves';
import { formatSaveGamePickerHint, getSaveGamePickerOptions } from './savesPageModel';

type SavePathPanelProps = {
  backupLabel: string;
  backups: SaveBackup[];
  candidates: SavePathCandidate[];
  games: Game[];
  label: string;
  loading: boolean;
  path: string;
  paths: SavePath[];
  selectedGameId: string | null;
  onAddPath: () => void;
  onBackupLabelChange: (value: string) => void;
  onCopyPath: (label: string, targetPath: string) => void;
  onCreateBackup: (savePathId: string) => void;
  onLabelChange: (value: string) => void;
  onPathChange: (value: string) => void;
  onPickPath: () => void;
  onRemovePath: (item: SavePath) => void;
  onReveal: (targetPath: string) => void;
  onSelectGame: (gameId: string | null) => void;
  onSuggestPaths: () => void;
  onUseCandidate: (candidate: SavePathCandidate, mode: 'fill' | 'add') => void;
};

export function SavePathPanel({ backupLabel, backups, candidates, games, label, loading, onAddPath, onBackupLabelChange, onCopyPath, onCreateBackup, onLabelChange, onPathChange, onPickPath, onRemovePath, onReveal, onSelectGame, onSuggestPaths, onUseCandidate, path, paths, selectedGameId }: SavePathPanelProps) {
  const [gamePickerQuery, setGamePickerQuery] = useState('');
  const gamePickerOptions = useMemo(() => getSaveGamePickerOptions(games, selectedGameId, gamePickerQuery), [gamePickerQuery, games, selectedGameId]);

  return (
    <Panel>
      <PanelHeader title="存档路径" icon={<Archive className="h-4 w-4" />} />
      <PanelContent className="space-y-4">
        <SoftRow className="px-3 py-2.5">
          <Label>游戏</Label>
          <Input
            className="mt-2"
            value={gamePickerQuery}
            onChange={(event) => setGamePickerQuery(event.target.value)}
            placeholder="筛选标题 / 会社 / 标签"
          />
          <Select className="mt-2 w-full" value={selectedGameId ?? ''} onChange={(event) => onSelectGame(event.target.value || null)}>
            {gamePickerOptions.map((game) => <option key={game.id} value={game.id}>{game.title}</option>)}
          </Select>
          <div className="mt-1 text-xs text-slate-500">{formatSaveGamePickerHint(gamePickerOptions.length, games.length, gamePickerQuery)}</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MetricTile icon={<FolderPlus className="h-3.5 w-3.5" />} label="存档路径" value={`${paths.length}`} />
            <MetricTile icon={<ShieldCheck className="h-3.5 w-3.5" />} label="备份记录" value={`${backups.length}`} />
          </div>
        </SoftRow>

        <SoftRow className="grid gap-3 px-3 py-2.5 md:grid-cols-[0.7fr_1fr_auto]">
          <label className="space-y-1.5"><Label>标签</Label><Input value={label} onChange={(event) => onLabelChange(event.target.value)} /></label>
          <label className="space-y-1.5"><Label>存档目录</Label><Input value={path} onChange={(event) => onPathChange(event.target.value)} /></label>
          <div className="flex items-end gap-2">
            <Button aria-label="复制待添加存档目录" disabled={!path.trim()} variant="outline" onClick={() => onCopyPath('待添加存档目录', path)}><Copy className="h-4 w-4" />复制</Button>
            <Button variant="secondary" onClick={onPickPath}><FolderPlus className="h-4 w-4" />选择</Button>
            <Button disabled={!selectedGameId || !path.trim() || loading} onClick={onAddPath}>添加</Button>
          </div>
        </SoftRow>

        <SoftRow className="space-y-3 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-slate-100">候选存档目录</div>
              <div className="mt-1 text-xs text-slate-500">只查找已存在的常见位置，添加前由你确认。</div>
            </div>
            <Button disabled={!selectedGameId || loading} size="sm" variant="outline" onClick={onSuggestPaths}><LocateFixed className="h-4 w-4" />查找候选</Button>
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
                      <Button aria-label="复制候选存档目录" size="sm" variant="outline" onClick={() => onCopyPath('候选存档目录', candidate.path)}><Copy className="h-4 w-4" />复制</Button>
                      <Button size="sm" variant="ghost" onClick={() => onUseCandidate(candidate, 'fill')}>填入</Button>
                      <Button disabled={candidate.alreadyAdded || loading} size="sm" variant="secondary" onClick={() => onUseCandidate(candidate, 'add')}>添加</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SoftRow>

        <SoftRow className="space-y-2 px-3 py-2.5">
          <Label>备份标签</Label>
          <Input value={backupLabel} onChange={(event) => onBackupLabelChange(event.target.value)} />
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
                  <Button aria-label={`复制${item.label}路径`} size="sm" variant="outline" onClick={() => onCopyPath(item.label, item.path)}><Copy className="h-4 w-4" />复制</Button>
                  <Button size="sm" variant="outline" onClick={() => onReveal(item.path)}><FolderOpen className="h-4 w-4" />打开</Button>
                  <Button disabled={loading} size="sm" variant="secondary" onClick={() => onCreateBackup(item.id)}><Save className="h-4 w-4" />备份</Button>
                  <Button aria-label="移除存档路径记录" disabled={loading} size="icon" title="移除存档路径记录" variant="ghost" onClick={() => onRemovePath(item)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </SoftRow>
          ))}
        </div>
      </PanelContent>
    </Panel>
  );
}
