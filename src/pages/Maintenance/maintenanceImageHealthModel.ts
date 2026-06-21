import type { ImageHealthReport, ImageQuarantineReport } from '@/types/archive';

type ImageHealthActionHintReport = {
  summary: Partial<Pick<
    ImageHealthReport['summary'],
    | 'orphanFiles'
    | 'missingLocalRefs'
    | 'invalidImageRefs'
    | 'cDriveRefs'
    | 'playniteRefs'
    | 'externalLegacyRefs'
    | 'missingArtworkGames'
    | 'duplicateContentGroups'
    | 'duplicateFileNameGroups'
  >>;
};

export function formatImageQuarantineCompletionMessage(
  result: Pick<ImageQuarantineReport, 'movedFiles' | 'skippedFiles'>,
  report: Pick<ImageHealthReport, 'summary'>,
) {
  const skipped = result.skippedFiles > 0 ? `；跳过 ${formatCount(result.skippedFiles)} 个` : '';
  return `安全整理完成：已移动 ${formatCount(result.movedFiles)} 个孤儿图片到隔离区${skipped}；复查剩余 ${formatCount(report.summary.orphanFiles)} 个孤儿图片。`;
}

export function formatImageDuplicateContentQuarantineCompletionMessage(
  result: Pick<ImageQuarantineReport, 'movedFiles' | 'skippedFiles'>,
  report: Pick<ImageHealthReport, 'summary'>,
) {
  const skipped = result.skippedFiles > 0 ? `；跳过 ${formatCount(result.skippedFiles)} 个` : '';
  return `重复内容整理完成：已移动 ${formatCount(result.movedFiles)} 个未引用副本到隔离区${skipped}；复查剩余 ${formatCount(report.summary.duplicateContentGroups)} 组重复内容。`;
}

export function getImageHealthActionHint({ report, loading }: { report: ImageHealthActionHintReport | null; loading: boolean }) {
  if (loading) return '正在检查图片健康，完成后会更新可用操作。';
  if (!report) return '先检查图片健康后，再查看失效引用、诊断缺图或安全整理孤儿图片。';

  const summary = report.summary;
  const hasOrphans = (summary.orphanFiles ?? 0) > 0;
  const hasArtworkGaps = (summary.missingArtworkGames ?? 0) > 0;
  const hasDuplicateContent = (summary.duplicateContentGroups ?? 0) > 0;
  const hasDuplicateFileNames = (summary.duplicateFileNameGroups ?? 0) > 0;
  const hasDuplicateCache = hasDuplicateContent || hasDuplicateFileNames;
  const hasBrokenRefs = [
    summary.missingLocalRefs,
    summary.invalidImageRefs,
    summary.cDriveRefs,
    summary.playniteRefs,
    summary.externalLegacyRefs,
  ].some((value) => (value ?? 0) > 0);

  if (!hasOrphans && !hasArtworkGaps && !hasBrokenRefs && !hasDuplicateCache) return '当前图片健康检查没有发现需要处理的图片问题。';

  const disabledReasons = [];
  if (hasDuplicateContent) disabledReasons.push('可整理重复内容中的未引用副本');
  if (hasDuplicateFileNames) disabledReasons.push('重复文件名需要人工确认内容是否相同');
  if (!hasBrokenRefs) disabledReasons.push('没有需要逐条审计的失效引用');
  if (!hasArtworkGaps) disabledReasons.push('没有可补全的媒体缺图');
  if (!hasOrphans) disabledReasons.push('没有可整理的孤儿图片');

  return disabledReasons.length ? `${disabledReasons.join('；')}。` : '可处理项目已点亮，建议按提示逐项处理。';
}

function formatCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}
