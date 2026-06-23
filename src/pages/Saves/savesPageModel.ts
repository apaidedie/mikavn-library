import type { Game } from '@/types/game';
import type { SaveBackup, SaveRestoreMode, SaveRestorePreview } from '@/types/saves';

export const saveGamePickerMaxOptions = 80;
export const saveBackupHistoryInitialRenderCount = 80;
export const saveBackupHistoryRenderBatchSize = 80;

export type SaveRestorePreviewPair = {
  mergeKey: string;
  mirrorKey: string;
  mergePreview: SaveRestorePreview | null;
  mirrorPreview: SaveRestorePreview | null;
};

export type SaveBackupHistoryRenderWindow = {
  visibleBackups: SaveBackup[];
  renderedCount: number;
  totalCount: number;
  hasMore: boolean;
};

export function getSaveRestorePreviewPair(backupId: string, previews: Record<string, SaveRestorePreview>): SaveRestorePreviewPair {
  const mergeKey = `${backupId}:merge`;
  const mirrorKey = `${backupId}:mirror`;
  return {
    mergeKey,
    mirrorKey,
    mergePreview: previews[mergeKey] ?? null,
    mirrorPreview: previews[mirrorKey] ?? null,
  };
}

export function getSaveBackupHistoryRenderWindow(backups: SaveBackup[], visibleCount: number): SaveBackupHistoryRenderWindow {
  const safeVisibleCount = Math.max(0, Math.min(backups.length, Math.floor(visibleCount)));
  const visibleBackups = backups.slice(0, safeVisibleCount);
  return {
    visibleBackups,
    renderedCount: visibleBackups.length,
    totalCount: backups.length,
    hasMore: visibleBackups.length < backups.length,
  };
}

export function formatSaveBackupHistoryLoadMoreLabel(renderedCount: number, totalCount: number) {
  return `加载更多 ${formatSaveCount(renderedCount)} / ${formatSaveCount(totalCount)}`;
}

export function savePathCandidateMessage(count: number) {
  return count === 0 ? '没有发现已存在的常见存档目录。' : `发现 ${formatSaveCount(count)} 个候选存档目录。`;
}

export function restoreTaskMessage(mode: SaveRestoreMode, taskId: string) {
  return `${restoreModeText(mode)}存档恢复任务已创建：${taskId}`;
}

export function restorePreviewCompletionMessage(mode: SaveRestoreMode, preview: SaveRestorePreview) {
  return `${restoreModeText(mode)}恢复预览完成：新增 ${formatSaveCount(preview.newFiles)}，覆盖 ${formatSaveCount(preview.overwrittenFiles)}，${mode === 'mirror' ? `清理 ${formatSaveCount(preview.removedFiles)}` : `保留 ${formatSaveCount(preview.keptFiles)}`}。`;
}

export function getSaveGamePickerOptions(games: Game[], selectedGameId: string | null, query: string) {
  const normalizedQuery = normalizePickerText(query);
  const selectedGame = selectedGameId ? games.find((game) => game.id === selectedGameId) ?? null : null;
  const matches = normalizedQuery ? games.filter((game) => saveGameMatchesQuery(game, normalizedQuery)) : games;
  const options: Game[] = [];
  const seen = new Set<string>();

  const addGame = (game: Game | null) => {
    if (!game || seen.has(game.id) || options.length >= saveGamePickerMaxOptions) return;
    options.push(game);
    seen.add(game.id);
  };

  addGame(selectedGame);
  for (const game of matches) {
    addGame(game);
  }

  return options;
}

export function formatSaveGamePickerHint(visibleCount: number, totalCount: number, query: string) {
  const prefix = query.trim() ? '匹配' : '显示';
  const suffix = query.trim() ? '。' : '，输入关键词缩小范围。';
  return `${prefix} ${formatSaveCount(visibleCount)} / ${formatSaveCount(totalCount)} 个游戏${suffix}`;
}

function restoreModeText(mode: SaveRestoreMode) {
  return mode === 'mirror' ? '镜像' : '合并';
}

function formatSaveCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function saveGameMatchesQuery(game: Game, normalizedQuery: string) {
  return [
    game.title,
    game.originalTitle,
    game.developer,
    game.publisher,
    game.brand,
    ...(game.aliases ?? []),
    ...(game.tags ?? []),
    ...(game.genres ?? []),
  ].some((value) => normalizePickerText(value).includes(normalizedQuery));
}

function normalizePickerText(value?: string | null) {
  return (value ?? '').trim().toLocaleLowerCase();
}
