import type { ImageHealthReport, ImageQuarantineReport } from '@/types/archive';

export function formatImageQuarantineCompletionMessage(
  result: Pick<ImageQuarantineReport, 'movedFiles' | 'skippedFiles'>,
  report: Pick<ImageHealthReport, 'summary'>,
) {
  const skipped = result.skippedFiles > 0 ? `；跳过 ${formatCount(result.skippedFiles)} 个` : '';
  return `安全整理完成：已移动 ${formatCount(result.movedFiles)} 个孤儿图片到隔离区${skipped}；复查剩余 ${formatCount(report.summary.orphanFiles)} 个孤儿图片。`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}
