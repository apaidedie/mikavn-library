export function formatAdvancedSearchResultDescription(result: { total: number; visible: number } | null) {
  if (!result) return '尚未搜索';

  const total = formatCount(result.total);
  const visible = formatCount(result.visible);
  if (result.visible < result.total) {
    return `显示 ${visible} / ${total} 个匹配条目，已限制结果以保持响应速度`;
  }
  return `${total} 个匹配条目`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}
