import { Clock3, Copy, FolderOpen, ListChecks, RotateCcw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/notice';
import { Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import type { Game } from '@/types/game';
import type { SaveBackup, SaveRestoreMode, SaveRestorePreview } from '@/types/saves';
import { formatDateTime } from '@/utils/time';
import { SaveRestorePreviewBlock } from './SaveRestorePreviewBlock';
import { getSaveRestorePreviewPair } from './savesPageModel';

type SaveBackupHistoryPanelProps = {
  backups: SaveBackup[];
  loading: boolean;
  restorePreviewLoadingKey: string | null;
  restorePreviews: Record<string, SaveRestorePreview>;
  selectedGame: Game | null;
  onCopyPath: (label: string, targetPath: string) => void;
  onDeleteBackup: (backup: SaveBackup) => void;
  onLoadRestorePreview: (backup: SaveBackup, mode: SaveRestoreMode) => void;
  onRestore: (backup: SaveBackup, mode: SaveRestoreMode) => void;
  onReveal: (targetPath: string) => void;
};

export function SaveBackupHistoryPanel({ backups, loading, onCopyPath, onDeleteBackup, onLoadRestorePreview, onRestore, onReveal, restorePreviewLoadingKey, restorePreviews, selectedGame }: SaveBackupHistoryPanelProps) {
  return (
    <Panel>
      <PanelHeader title="备份历史" description={selectedGame ? selectedGame.title : '选择游戏后显示备份历史。'} icon={<Clock3 className="h-4 w-4" />} />
      <PanelContent className="max-h-[calc(100vh-12rem)] space-y-2 overflow-auto pr-1">
        {backups.length === 0 ? <EmptyState className="flex min-h-[22rem] flex-col items-center justify-center py-12">还没有备份记录。</EmptyState> : backups.map((backup) => {
          const { mergeKey, mergePreview, mirrorKey, mirrorPreview } = getSaveRestorePreviewPair(backup.id, restorePreviews);
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
                  <Button aria-label={`复制${backup.label}路径`} size="sm" variant="outline" onClick={() => onCopyPath(backup.label, backup.backupPath)}><Copy className="h-4 w-4" />复制</Button>
                  <Button size="sm" variant="outline" onClick={() => onReveal(backup.backupPath)}><FolderOpen className="h-4 w-4" />打开</Button>
                  <Button disabled={loading || restorePreviewLoadingKey === mergeKey} size="sm" variant="ghost" onClick={() => onLoadRestorePreview(backup, 'merge')}><ListChecks className="h-4 w-4" />{restorePreviewLoadingKey === mergeKey ? '预览中' : '预览'}</Button>
                  <Button disabled={loading || restorePreviewLoadingKey === mirrorKey} size="sm" variant="ghost" onClick={() => onLoadRestorePreview(backup, 'mirror')}><ListChecks className="h-4 w-4" />{restorePreviewLoadingKey === mirrorKey ? '预览中' : '镜像预览'}</Button>
                  <Button disabled={loading || restorePreviewLoadingKey === mergeKey} size="sm" variant="outline" onClick={() => onRestore(backup, 'merge')}><RotateCcw className="h-4 w-4" />恢复</Button>
                  <Button disabled={loading || restorePreviewLoadingKey === mirrorKey} size="sm" variant="ghost" onClick={() => onRestore(backup, 'mirror')}>镜像恢复</Button>
                  <Button aria-label="删除备份记录" disabled={loading} size="icon" title="删除备份记录" variant="ghost" onClick={() => onDeleteBackup(backup)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              {mergePreview && <SaveRestorePreviewBlock preview={mergePreview} />}
              {mirrorPreview && <SaveRestorePreviewBlock preview={mirrorPreview} />}
            </SoftRow>
          );
        })}
      </PanelContent>
    </Panel>
  );
}
