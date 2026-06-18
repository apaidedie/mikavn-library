import type { SaveRestoreMode, SaveRestorePreview } from '@/types/saves';

export type SaveRestorePreviewPair = {
  mergeKey: string;
  mirrorKey: string;
  mergePreview: SaveRestorePreview | null;
  mirrorPreview: SaveRestorePreview | null;
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

export function savePathCandidateMessage(count: number) {
  return count === 0 ? '没有发现已存在的常见存档目录。' : `发现 ${formatSaveCount(count)} 个候选存档目录。`;
}

export function restoreTaskMessage(mode: SaveRestoreMode, taskId: string) {
  return `${restoreModeText(mode)}存档恢复任务已创建：${taskId}`;
}

export function restorePreviewCompletionMessage(mode: SaveRestoreMode, preview: SaveRestorePreview) {
  return `${restoreModeText(mode)}恢复预览完成：新增 ${formatSaveCount(preview.newFiles)}，覆盖 ${formatSaveCount(preview.overwrittenFiles)}，${mode === 'mirror' ? `清理 ${formatSaveCount(preview.removedFiles)}` : `保留 ${formatSaveCount(preview.keptFiles)}`}。`;
}

function restoreModeText(mode: SaveRestoreMode) {
  return mode === 'mirror' ? '镜像' : '合并';
}

function formatSaveCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}
