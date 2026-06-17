import type { Game } from '@/types/game';
import type { SaveBackup, SavePathCandidate, SaveRestoreMode, SaveRestorePreview } from '@/types/saves';

export function mockSavePathCandidates(game: Game, existing: Set<string>): SavePathCandidate[] {
  const install = game.installPath.replace(/[\\/]$/, '');
  return ['save', 'savedata', 'SaveData'].map((folder) => {
    const candidatePath = `${install}\\${folder}`;
    return {
      label: '游戏目录存档',
      path: candidatePath,
      reason: '浏览器预览候选：安装目录下的常见存档文件夹',
      exists: true,
      alreadyAdded: existing.has(candidatePath.toLowerCase()),
    };
  });
}

export function mockSaveRestorePreview(backup: SaveBackup, mode: SaveRestoreMode = 'merge'): SaveRestorePreview {
  return {
    mode,
    backupPath: backup.backupPath,
    savePath: backup.sourcePath,
    backupFileCount: 3,
    currentFileCount: 4,
    newFiles: 1,
    overwrittenFiles: 2,
    keptFiles: mode === 'merge' ? 2 : 0,
    removedFiles: mode === 'mirror' ? 4 : 0,
    sampleNewFiles: ['new-slot.dat'],
    sampleOverwrittenFiles: ['slot1.dat', 'nested/slot2.dat'],
    sampleKeptFiles: mode === 'merge' ? ['local-only.dat', 'config/user.ini'] : [],
    sampleRemovedFiles: mode === 'mirror' ? ['slot1.dat', 'local-only.dat', 'config/user.ini'] : [],
  };
}
