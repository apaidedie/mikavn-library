export const advancedSearchResultRenderBatchSize = 60;

export function formatAdvancedSearchResultDescription(result: { total: number; visible: number } | null) {
  if (!result) return '尚未搜索';

  const total = formatCount(result.total);
  const visible = formatCount(result.visible);
  if (result.visible < result.total) {
    return `显示 ${visible} / ${total} 个匹配条目，已限制结果以保持响应速度`;
  }
  return `${total} 个匹配条目`;
}

export function visibleAdvancedSearchResults<T>(results: T[], limit: number) {
  return results.slice(0, Math.max(0, limit));
}

export function nextAdvancedSearchVisibleResultLimit(currentLimit: number, loadedCount: number) {
  return Math.min(currentLimit + advancedSearchResultRenderBatchSize, loadedCount);
}

export function formatAdvancedSearchRenderedResultSummary(result: { visible: number; loaded: number }) {
  if (result.visible >= result.loaded) return null;
  return `已渲染 ${formatCount(result.visible)} / ${formatCount(result.loaded)} 个结果卡片，继续显示会逐步加载更多图片`;
}

export function shouldRenderAdvancedSearchFeedback(input: { error?: string | null; validationErrorCount?: number | null }) {
  return Boolean(input.error || (input.validationErrorCount ?? 0) > 0);
}

function formatCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}
