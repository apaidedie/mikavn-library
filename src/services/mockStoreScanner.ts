import type { Game, ScanCandidate, ScanConflict } from '@/types/game';

export function normalizeMockPath(value: string) {
  return value.trim().replace(/[/]+/g, '\\').replace(/[\\/]+$/g, '').toLowerCase();
}

function normalizeMockTitle(value: string) {
  return value.trim().replace(/[\s　_-]+/g, '').toLowerCase();
}

export function findScanConflict(games: Game[], installPath: string, title: string): ScanConflict | null {
  const found = games.find((game) => normalizeMockPath(game.installPath) === normalizeMockPath(installPath) || normalizeMockTitle(game.title) === normalizeMockTitle(title));
  return found ? { gameId: found.id, title: found.title, reason: normalizeMockPath(found.installPath) === normalizeMockPath(installPath) ? '安装目录已存在' : '标题相同' } : null;
}

export function mockScanPathPreview(games: Game[], path: string, recursive: boolean): ScanCandidate[] {
  const root = path.trim() || 'D:\\Games\\VisualNovel';
  const baseDepth = recursive ? 'ゆずソフト\\天使騒々' : '天使騒々';
  return [
    {
      id: crypto.randomUUID(),
      rootPath: root,
      installPath: `${root}\\星之终途`,
      folderName: '[汉化硬盘版] 星之终途 v1.02',
      suggestedTitle: '星之终途',
      aliases: ['[汉化硬盘版] 星之终途 v1.02'],
      executables: [{ name: 'stella.exe', path: `${root}\\星之终途\\stella.exe` }],
      selectedExecutable: `${root}\\星之终途\\stella.exe`,
      conflict: findScanConflict(games, `${root}\\星之终途`, '星之终途'),
    },
    {
      id: crypto.randomUUID(),
      rootPath: root,
      installPath: `${root}\\${baseDepth}`,
      folderName: '[230428][ゆずソフト] 天使☆騒々 RE-BOOT!',
      suggestedTitle: '天使☆騒々 RE-BOOT!',
      aliases: ['[230428][ゆずソフト] 天使☆騒々 RE-BOOT!'],
      executables: [{ name: '天使騒々.exe', path: `${root}\\${baseDepth}\\天使騒々.exe` }],
      selectedExecutable: `${root}\\${baseDepth}\\天使騒々.exe`,
      conflict: findScanConflict(games, `${root}\\${baseDepth}`, '天使☆騒々 RE-BOOT!'),
    },
  ];
}
