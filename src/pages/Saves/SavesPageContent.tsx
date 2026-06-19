import type { Game } from '@/types/game';
import type { SaveBackup, SavePath, SavePathCandidate, SaveRestoreMode, SaveRestorePreview } from '@/types/saves';
import { SaveBackupHistoryPanel } from './SaveBackupHistoryPanel';
import { SavePathPanel } from './SavePathPanel';

type SavesPageContentProps = {
  backupLabel: string;
  backups: SaveBackup[];
  candidates: SavePathCandidate[];
  games: Game[];
  label: string;
  loading: boolean;
  path: string;
  paths: SavePath[];
  restorePreviewLoadingKey: string | null;
  restorePreviews: Record<string, SaveRestorePreview>;
  selectedGame: Game | null;
  selectedGameId: string | null;
  onAddPath: () => void;
  onBackupLabelChange: (value: string) => void;
  onCopyPath: (label: string, path: string) => void;
  onCreateBackup: (savePathId: string) => void;
  onDeleteBackup: (backup: SaveBackup) => void;
  onLabelChange: (value: string) => void;
  onLoadRestorePreview: (backup: SaveBackup, mode: SaveRestoreMode) => void;
  onPathChange: (value: string) => void;
  onPickPath: () => void;
  onRemovePath: (item: SavePath) => void;
  onRestore: (backup: SaveBackup, mode: SaveRestoreMode) => void;
  onReveal: (path: string) => void;
  onSelectGame: (gameId: string | null) => void;
  onSuggestPaths: () => void;
  onUseCandidate: (candidate: SavePathCandidate, mode: 'fill' | 'add') => void;
};

export function SavesPageContent({ backupLabel, backups, candidates, games, label, loading, onAddPath, onBackupLabelChange, onCopyPath, onCreateBackup, onDeleteBackup, onLabelChange, onLoadRestorePreview, onPathChange, onPickPath, onRemovePath, onRestore, onReveal, onSelectGame, onSuggestPaths, onUseCandidate, path, paths, restorePreviewLoadingKey, restorePreviews, selectedGame, selectedGameId }: SavesPageContentProps) {
  return (
    <div className="grid min-h-[calc(100vh-9rem)] gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
      <SavePathPanel
        backupLabel={backupLabel}
        backups={backups}
        candidates={candidates}
        games={games}
        label={label}
        loading={loading}
        path={path}
        paths={paths}
        selectedGameId={selectedGameId}
        onAddPath={onAddPath}
        onBackupLabelChange={onBackupLabelChange}
        onCopyPath={onCopyPath}
        onCreateBackup={onCreateBackup}
        onLabelChange={onLabelChange}
        onPathChange={onPathChange}
        onPickPath={onPickPath}
        onRemovePath={onRemovePath}
        onReveal={onReveal}
        onSelectGame={onSelectGame}
        onSuggestPaths={onSuggestPaths}
        onUseCandidate={onUseCandidate}
      />

      <SaveBackupHistoryPanel
        backups={backups}
        loading={loading}
        restorePreviewLoadingKey={restorePreviewLoadingKey}
        restorePreviews={restorePreviews}
        selectedGame={selectedGame}
        onCopyPath={onCopyPath}
        onDeleteBackup={onDeleteBackup}
        onLoadRestorePreview={onLoadRestorePreview}
        onRestore={onRestore}
        onReveal={onReveal}
      />
    </div>
  );
}
