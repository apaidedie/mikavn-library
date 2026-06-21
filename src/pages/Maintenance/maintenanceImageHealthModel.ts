import type { ImageHealthReport, ImageQuarantineReport } from '@/types/archive';

type ImageHealthActionHintReport = {
  summary: Partial<Pick<
    ImageHealthReport['summary'],
    | 'orphanFiles'
    | 'missingLocalRefs'
    | 'invalidImageFiles'
    | 'invalidImageRefs'
    | 'cDriveRefs'
    | 'playniteRefs'
    | 'externalLegacyRefs'
    | 'missingArtworkGames'
    | 'duplicateContentGroups'
    | 'duplicateFileNameGroups'
    | 'oversizedFiles'
    | 'contentTypeMismatchFiles'
    | 'contentTypeMismatchRefs'
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

export function formatImageInvalidQuarantineCompletionMessage(
  result: Pick<ImageQuarantineReport, 'movedFiles' | 'skippedFiles'>,
  report: Pick<ImageHealthReport, 'summary'>,
) {
  const skipped = result.skippedFiles > 0 ? `；跳过 ${formatCount(result.skippedFiles)} 个` : '';
  const remainingUnreferenced = Math.max(0, report.summary.invalidImageFiles - report.summary.invalidImageRefs);
  return `无效图片整理完成：已移动 ${formatCount(result.movedFiles)} 个未引用坏图到隔离区${skipped}；复查剩余 ${formatCount(remainingUnreferenced)} 个未引用坏图。`;
}

export function formatImageOversizedQuarantineCompletionMessage(
  result: Pick<ImageQuarantineReport, 'movedFiles' | 'skippedFiles'>,
  report: Pick<ImageHealthReport, 'summary'>,
) {
  const skipped = result.skippedFiles > 0 ? `；跳过 ${formatCount(result.skippedFiles)} 个` : '';
  return `过大图片整理完成：已移动 ${formatCount(result.movedFiles)} 个未引用大图到隔离区${skipped}；复查剩余 ${formatCount(report.summary.oversizedFiles)} 个过大图片。`;
}

export function formatImageContentTypeMismatchQuarantineCompletionMessage(
  result: Pick<ImageQuarantineReport, 'movedFiles' | 'skippedFiles'>,
  report: Pick<ImageHealthReport, 'summary'>,
) {
  const skipped = result.skippedFiles > 0 ? `；跳过 ${formatCount(result.skippedFiles)} 个` : '';
  const remainingUnreferenced = Math.max(0, report.summary.contentTypeMismatchFiles - report.summary.contentTypeMismatchRefs);
  return `类型不匹配整理完成：已移动 ${formatCount(result.movedFiles)} 个未引用错配图片到隔离区${skipped}；复查剩余 ${formatCount(remainingUnreferenced)} 个未引用错配图片。`;
}

export function formatImageSafeCacheBatchCompletionMessage(
  results: Pick<ImageQuarantineReport, 'movedFiles' | 'skippedFiles'>[],
  report: Pick<ImageHealthReport, 'summary'>,
) {
  const moved = results.reduce((sum, result) => sum + result.movedFiles, 0);
  const skippedCount = results.reduce((sum, result) => sum + result.skippedFiles, 0);
  const skipped = skippedCount > 0 ? `；跳过 ${formatCount(skippedCount)} 个` : '';
  const remainingInvalid = Math.max(0, report.summary.invalidImageFiles - report.summary.invalidImageRefs);
  const remainingMismatch = Math.max(0, report.summary.contentTypeMismatchFiles - report.summary.contentTypeMismatchRefs);
  return `批量安全整理完成：已移动 ${formatCount(moved)} 个未引用缓存文件到隔离区${skipped}；复查剩余孤儿 ${formatCount(report.summary.orphanFiles)} 个、重复内容 ${formatCount(report.summary.duplicateContentGroups)} 组、未引用坏图 ${formatCount(remainingInvalid)} 个、过大图片 ${formatCount(report.summary.oversizedFiles)} 个、未引用类型不匹配 ${formatCount(remainingMismatch)} 个。`;
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
  const hasOversizedImages = (summary.oversizedFiles ?? 0) > 0;
  const hasInvalidUnreferencedImages = Math.max(0, (summary.invalidImageFiles ?? 0) - (summary.invalidImageRefs ?? 0)) > 0;
  const hasContentTypeMismatchUnreferenced = Math.max(0, (summary.contentTypeMismatchFiles ?? 0) - (summary.contentTypeMismatchRefs ?? 0)) > 0;
  const hasBrokenRefs = [
    summary.missingLocalRefs,
    summary.invalidImageRefs,
    summary.cDriveRefs,
    summary.playniteRefs,
    summary.externalLegacyRefs,
  ].some((value) => (value ?? 0) > 0);

  if (!hasOrphans && !hasArtworkGaps && !hasBrokenRefs && !hasDuplicateCache && !hasOversizedImages && !hasContentTypeMismatchUnreferenced) return '当前图片健康检查没有发现需要处理的图片问题。';

  const disabledReasons = [];
  if (hasDuplicateContent) disabledReasons.push('可整理重复内容中的未引用副本');
  if (hasInvalidUnreferencedImages) disabledReasons.push('可整理未引用的无效图片');
  if (hasOversizedImages) disabledReasons.push('可整理未引用的过大图片');
  if (hasContentTypeMismatchUnreferenced) disabledReasons.push('可整理未引用的类型不匹配图片');
  if (hasDuplicateFileNames) disabledReasons.push('重复文件名需要人工确认内容是否相同');
  if (!hasBrokenRefs) disabledReasons.push('没有需要逐条审计的失效引用');
  if (!hasArtworkGaps) disabledReasons.push('没有可补全的媒体缺图');
  if (!hasOrphans) disabledReasons.push('没有可整理的孤儿图片');

  return disabledReasons.length ? `${disabledReasons.join('；')}。` : '可处理项目已点亮，建议按提示逐项处理。';
}

function formatCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}
