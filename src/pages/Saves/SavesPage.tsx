import { PageFrame, PageHeader, PageShell } from '@/components/ui/page';
import { SavesPageContent } from './SavesPageContent';
import { SavesStatusNotices } from './SavesStatusNotices';
import { useSavesPageActions } from './useSavesPageActions';

export function SavesPage({ refreshKey, onOpenTask }: { refreshKey: number; onOpenTask?: (taskId: string) => void }) {
  const saves = useSavesPageActions(refreshKey);

  return (
    <PageShell>
      <PageFrame>
        <PageHeader title="存档管理" description="为每个游戏配置存档目录，手动备份，恢复前自动创建保护备份。" />
        <SavesStatusNotices error={saves.error} message={saves.message} onOpenTask={onOpenTask} />

        <SavesPageContent
          backupLabel={saves.backupLabel}
          backups={saves.backups}
          candidates={saves.candidates}
          games={saves.games}
          label={saves.label}
          loading={saves.loading}
          path={saves.path}
          paths={saves.paths}
          restorePreviewLoadingKey={saves.restorePreviewLoadingKey}
          restorePreviews={saves.restorePreviews}
          selectedGame={saves.selectedGame}
          selectedGameId={saves.selectedGameId}
          onAddPath={() => void saves.addPath()}
          onBackupLabelChange={saves.setBackupLabel}
          onCopyPath={(copyLabel, targetPath) => void saves.copyPath(copyLabel, targetPath)}
          onCreateBackup={(savePathId) => void saves.createBackup(savePathId)}
          onDeleteBackup={(backup) => void saves.deleteBackup(backup)}
          onLabelChange={saves.setLabel}
          onLoadRestorePreview={(backup, mode) => void saves.loadRestorePreview(backup, mode)}
          onPathChange={saves.setPath}
          onPickPath={() => void saves.pickPath()}
          onRemovePath={(item) => void saves.removePath(item)}
          onRestore={(backup, mode) => void saves.restore(backup, mode)}
          onReveal={(targetPath) => void saves.reveal(targetPath)}
          onSelectGame={saves.setSelectedGameId}
          onSuggestPaths={() => void saves.suggestPaths()}
          onUseCandidate={(candidate, mode) => void saves.useCandidate(candidate, mode)}
        />
      </PageFrame>
    </PageShell>
  );
}
