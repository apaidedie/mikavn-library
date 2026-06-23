import type { ImageHealthReport, ImageQuarantineReport } from '@/types/archive';
import { redactDiagnosticText } from '@/utils/diagnosticRedaction';

const quarantineRecoveryHint = '隔离区 manifest.json 可用于按原路径找回。';

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
    | 'oversizedImageRefs'
    | 'contentTypeMismatchFiles'
    | 'contentTypeMismatchRefs'
  >>;
};

export function formatImageQuarantineCompletionMessage(
  result: Pick<ImageQuarantineReport, 'movedFiles' | 'skippedFiles'>,
  report: Pick<ImageHealthReport, 'summary'>,
) {
  const skipped = result.skippedFiles > 0 ? `；跳过 ${formatCount(result.skippedFiles)} 个` : '';
  return `安全整理完成：已移动 ${formatCount(result.movedFiles)} 个孤儿图片到隔离区${skipped}；复查剩余 ${formatCount(report.summary.orphanFiles)} 个孤儿图片。${quarantineRecoveryHint}`;
}

export function formatImageDuplicateContentQuarantineCompletionMessage(
  result: Pick<ImageQuarantineReport, 'movedFiles' | 'skippedFiles'>,
  report: Pick<ImageHealthReport, 'summary'>,
) {
  const skipped = result.skippedFiles > 0 ? `；跳过 ${formatCount(result.skippedFiles)} 个` : '';
  return `重复内容整理完成：已移动 ${formatCount(result.movedFiles)} 个未引用副本到隔离区${skipped}；复查剩余 ${formatCount(report.summary.duplicateContentGroups)} 组重复内容。${quarantineRecoveryHint}`;
}

export function formatImageInvalidQuarantineCompletionMessage(
  result: Pick<ImageQuarantineReport, 'movedFiles' | 'skippedFiles'>,
  report: Pick<ImageHealthReport, 'summary'>,
) {
  const skipped = result.skippedFiles > 0 ? `；跳过 ${formatCount(result.skippedFiles)} 个` : '';
  const remainingUnreferenced = Math.max(0, report.summary.invalidImageFiles - report.summary.invalidImageRefs);
  return `无效图片整理完成：已移动 ${formatCount(result.movedFiles)} 个未引用坏图到隔离区${skipped}；复查剩余 ${formatCount(remainingUnreferenced)} 个未引用坏图。${quarantineRecoveryHint}`;
}

export function formatImageOversizedQuarantineCompletionMessage(
  result: Pick<ImageQuarantineReport, 'movedFiles' | 'skippedFiles'>,
  report: Pick<ImageHealthReport, 'summary'>,
) {
  const skipped = result.skippedFiles > 0 ? `；跳过 ${formatCount(result.skippedFiles)} 个` : '';
  const remainingUnreferenced = Math.max(0, report.summary.oversizedFiles - report.summary.oversizedImageRefs);
  return `过大图片整理完成：已移动 ${formatCount(result.movedFiles)} 个未引用大图到隔离区${skipped}；复查剩余 ${formatCount(remainingUnreferenced)} 个未引用大图。${quarantineRecoveryHint}`;
}

export function formatImageContentTypeMismatchQuarantineCompletionMessage(
  result: Pick<ImageQuarantineReport, 'movedFiles' | 'skippedFiles'>,
  report: Pick<ImageHealthReport, 'summary'>,
) {
  const skipped = result.skippedFiles > 0 ? `；跳过 ${formatCount(result.skippedFiles)} 个` : '';
  const remainingUnreferenced = Math.max(0, report.summary.contentTypeMismatchFiles - report.summary.contentTypeMismatchRefs);
  return `类型不匹配整理完成：已移动 ${formatCount(result.movedFiles)} 个未引用错配图片到隔离区${skipped}；复查剩余 ${formatCount(remainingUnreferenced)} 个未引用错配图片。${quarantineRecoveryHint}`;
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
  const remainingOversized = Math.max(0, report.summary.oversizedFiles - report.summary.oversizedImageRefs);
  return `批量安全整理完成：已移动 ${formatCount(moved)} 个未引用缓存文件到隔离区${skipped}；复查剩余孤儿 ${formatCount(report.summary.orphanFiles)} 个、重复内容 ${formatCount(report.summary.duplicateContentGroups)} 组、未引用坏图 ${formatCount(remainingInvalid)} 个、未引用大图 ${formatCount(remainingOversized)} 个、未引用类型不匹配 ${formatCount(remainingMismatch)} 个。${quarantineRecoveryHint}`;
}

export function formatImageHealthSummaryMarkdown(report: Pick<ImageHealthReport, 'generatedAt' | 'recommendations' | 'summary'> & { cache?: Partial<Pick<ImageHealthReport['cache'], 'rootPath' | 'totalBytes' | 'orphanBytes' | 'oversizedBytes' | 'invalidImageBytes' | 'contentTypeMismatchBytes'>> | null }) {
  const summary = report.summary;
  const lines = [
    '# MikaVN 图片健康摘要',
    '',
    `生成时间：${report.generatedAt}`,
    `缓存目录：${report.cache?.rootPath ?? '(未知)'}`,
    `缓存体积：${formatBytes(report.cache?.totalBytes ?? 0)}`,
    `孤儿体积：${formatBytes(report.cache?.orphanBytes ?? 0)}`,
    `过大图片体积：${formatBytes(report.cache?.oversizedBytes ?? 0)}`,
    `无效图片体积：${formatBytes(report.cache?.invalidImageBytes ?? 0)}`,
    `类型不匹配体积：${formatBytes(report.cache?.contentTypeMismatchBytes ?? 0)}`,
    '',
    `图片引用：${formatCount(summary.totalImageRefs)} 条，问题 ${formatCount(summary.issueImageRefs)} 条`,
    `缺失引用：${formatCount(summary.missingLocalRefs)}`,
    `C 盘引用：${formatCount(summary.cDriveRefs)}`,
    `Playnite 引用：${formatCount(summary.playniteRefs)}`,
    `旧导入缓存：${formatCount(summary.legacyAppDataImportRefs)}（已在 app-data/images 内，不计入失效引用；路径规范化需先完成数据库备份。）`,
    `外部旧路径：${formatCount(summary.externalLegacyRefs)}`,
    '',
    `缓存图片：${formatCount(summary.imageFiles)} 个`,
    `孤儿图片：${formatCount(summary.orphanFiles)}`,
    `重复文件名：${formatCount(summary.duplicateFileNameGroups)} 组`,
    `重复内容：${formatCount(summary.duplicateContentGroups)} 组`,
    `过大图片：${formatCount(summary.oversizedFiles)} 个，其中仍被引用 ${formatCount(summary.oversizedImageRefs)} 个`,
    `无效图片：${formatCount(summary.invalidImageFiles)} 个，其中仍被引用 ${formatCount(summary.invalidImageRefs)} 个`,
    `类型不匹配：${formatCount(summary.contentTypeMismatchFiles)} 个，其中仍被引用 ${formatCount(summary.contentTypeMismatchRefs)} 个`,
    '',
    `缺封面游戏：${formatCount(summary.missingCoverGames)}`,
    `媒体图不完整游戏：${formatCount(summary.missingArtworkGames)}`,
  ];

  if (report.recommendations.length > 0) {
    lines.push('', '## 建议');
    report.recommendations.forEach((recommendation, index) => {
      lines.push(`${index + 1}. ${recommendation}`);
    });
  }

  return redactDiagnosticText(lines.join('\n'));
}

export function formatImageHealthReferenceSplit(total?: number | null, referenced?: number | null) {
  const referencedCount = Math.max(0, referenced ?? 0);
  const cleanableCount = Math.max(0, (total ?? 0) - referencedCount);
  return `未引用可整理 ${formatCount(cleanableCount)} · 仍被引用 ${formatCount(referencedCount)}`;
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
  const oversizedUnreferenced = Math.max(0, (summary.oversizedFiles ?? 0) - (summary.oversizedImageRefs ?? 0));
  const hasOversizedImages = (summary.oversizedFiles ?? 0) > 0;
  const hasOversizedUnreferencedImages = oversizedUnreferenced > 0;
  const hasInvalidUnreferencedImages = Math.max(0, (summary.invalidImageFiles ?? 0) - (summary.invalidImageRefs ?? 0)) > 0;
  const contentTypeMismatchUnreferenced = Math.max(0, (summary.contentTypeMismatchFiles ?? 0) - (summary.contentTypeMismatchRefs ?? 0));
  const hasContentTypeMismatchImages = (summary.contentTypeMismatchFiles ?? 0) > 0;
  const hasContentTypeMismatchUnreferenced = contentTypeMismatchUnreferenced > 0;
  const hasBrokenRefs = [
    summary.missingLocalRefs,
    summary.invalidImageRefs,
    summary.cDriveRefs,
    summary.playniteRefs,
    summary.externalLegacyRefs,
  ].some((value) => (value ?? 0) > 0);

  if (!hasOrphans && !hasArtworkGaps && !hasBrokenRefs && !hasDuplicateCache && !hasOversizedImages && !hasContentTypeMismatchImages) return '当前图片健康检查没有发现需要处理的图片问题。';

  const actionHints = [];
  if (hasDuplicateContent) actionHints.push('可整理重复内容中的未引用副本');
  if (hasInvalidUnreferencedImages) actionHints.push('可整理未引用的无效图片');
  if (hasOversizedUnreferencedImages) actionHints.push('可整理未引用的过大图片');
  if (hasOversizedImages && !hasOversizedUnreferencedImages) actionHints.push('过大图片仍被数据库引用，需压缩、重新抓取或人工确认');
  if (hasContentTypeMismatchUnreferenced) actionHints.push('可整理未引用的类型不匹配图片');
  if (hasContentTypeMismatchImages && !hasContentTypeMismatchUnreferenced) actionHints.push('类型不匹配图片仍被数据库引用，需重新抓取或人工确认');
  if (hasDuplicateFileNames) actionHints.push('重复文件名需要人工确认内容是否相同');
  if (hasOrphans) actionHints.push('可整理孤儿图片');
  if (hasBrokenRefs) actionHints.push('可查看失效引用');
  if (hasArtworkGaps) actionHints.push('可诊断或补全媒体缺图');
  if (!hasBrokenRefs) actionHints.push('没有需要逐条审计的失效引用');
  if (!hasArtworkGaps) actionHints.push('没有可补全的媒体缺图');
  if (!hasOrphans) actionHints.push('没有可整理的孤儿图片');

  return actionHints.length ? `${actionHints.join('；')}。` : '可处理项目已点亮，建议按提示逐项处理。';
}

function formatCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatBytes(value: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = Math.max(0, value);
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return unitIndex === 0 ? `${Math.round(size)} ${units[unitIndex]}` : `${size.toFixed(2)} ${units[unitIndex]}`;
}
