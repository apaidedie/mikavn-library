import type { ImageReferenceAuditItem } from '@/types/archive';

export type ImageAuditSourceSummary = {
  key: string;
  label: string;
  total: number;
  issueCount: number;
  missingCount: number;
  cDriveCount: number;
  playniteCount: number;
};

export type ImageAuditGameSummary = {
  key: string;
  gameId?: string | null;
  title: string;
  issueCount: number;
  sourceLabels: string[];
  issues: string[];
};

export function matchesImageAuditItem(item: ImageReferenceAuditItem, query: string, issueFilter: string) {
  const issues = item.issues.length > 0 ? item.issues : [item.status];
  const matchesIssue = issueFilter === 'all' || issues.includes(issueFilter);
  const value = query.trim().toLowerCase();
  const searchableValues = [
    item.gameId,
    item.gameTitle,
    item.sourceKind,
    item.sourceLabel,
    item.fieldName,
    item.fieldName ? imageFieldLabel(item.fieldName) : '',
    item.value,
    item.resolvedPath,
    item.status,
    imageIssueLabel(item.status),
    imageAuditRecommendation(issues),
    ...issues,
    ...issues.map(imageIssueLabel),
  ];
  const matchesQuery = !value || searchableValues.some((text) => String(text ?? '').toLowerCase().includes(value));
  return matchesIssue && matchesQuery;
}

export function summarizeImageAuditSources(items: ImageReferenceAuditItem[]): ImageAuditSourceSummary[] {
  const summaries = new Map<string, ImageAuditSourceSummary>();
  for (const item of items) {
    if (item.issues.length === 0) continue;
    const key = imageAuditSourceKey(item);
    const current = summaries.get(key) ?? {
      key,
      label: imageAuditSourceLabel(item),
      total: 0,
      issueCount: 0,
      missingCount: 0,
      cDriveCount: 0,
      playniteCount: 0,
    };
    current.total += 1;
    current.issueCount += 1;
    if (item.issues.includes('missing')) current.missingCount += 1;
    if (item.issues.includes('c_drive')) current.cDriveCount += 1;
    if (item.issues.includes('playnite')) current.playniteCount += 1;
    summaries.set(key, current);
  }
  return [...summaries.values()].sort((left, right) => right.issueCount - left.issueCount || left.label.localeCompare(right.label, 'zh-CN'));
}

export function summarizeImageAuditGames(items: ImageReferenceAuditItem[]): ImageAuditGameSummary[] {
  const summaries = new Map<string, ImageAuditGameSummary>();
  for (const item of items) {
    if (item.issues.length === 0) continue;
    const gameId = item.gameId?.trim() || null;
    const key = gameId || `unlinked:${item.sourceKind}:${item.fieldName ?? item.sourceLabel}:${item.value}`;
    const current = summaries.get(key) ?? {
      key,
      gameId,
      title: item.gameTitle?.trim() || gameId || '未关联游戏',
      issueCount: 0,
      sourceLabels: [],
      issues: [],
    };
    current.issueCount += 1;
    pushUnique(current.sourceLabels, imageAuditSourceLabel(item));
    for (const issue of item.issues) pushUnique(current.issues, issue);
    summaries.set(key, current);
  }
  return [...summaries.values()].sort((left, right) => right.issueCount - left.issueCount || left.title.localeCompare(right.title, 'zh-CN'));
}

export function imageAuditRecommendation(issues: string[]) {
  if (issues.includes('playnite')) return '将 Playnite 图片导入 MikaVN 图片缓存，再把引用改为 app-data/images 下的本地副本。';
  if (issues.includes('c_drive')) return '把 C 盘图片复制到 MikaVN 图片缓存或游戏目录内，再更新引用，避免系统盘残留路径。';
  if (issues.includes('missing')) return '重新补图或修正图片路径；如果原图还在本地，先用打开原始路径确认文件位置。';
  return '确认引用是否仍需要保留；正常远程图片可保持不动。';
}

export function isRevealableImageAuditPath(value?: string | null) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return false;
  if (trimmed.startsWith('data:') || trimmed.startsWith('asset:')) return false;
  return /^[a-z]:[\\/]/i.test(trimmed) || trimmed.startsWith('\\\\');
}

export function imageIssueLabel(value: string) {
  if (value === 'missing') return '缺失';
  if (value === 'c_drive') return 'C 盘';
  if (value === 'playnite') return 'Playnite';
  if (value === 'remote') return '远程';
  if (value === 'ok') return '正常';
  if (value === 'warning') return '警告';
  return value;
}

export function imageFieldLabel(value: string) {
  if (value === 'cover_image' || value === 'coverImage') return '封面字段';
  if (value === 'banner_image' || value === 'bannerImage') return '横幅字段';
  if (value === 'background_image' || value === 'backgroundImage') return '背景字段';
  if (value === 'description') return '简介';
  if (value === 'game_assets.uri') return '图库 URI';
  return value;
}

export function imageBadgeClass(value: string) {
  if (value === 'missing') return 'border-amber-300/25 bg-amber-300/10 text-amber-100';
  if (value === 'c_drive' || value === 'playnite') return 'border-rose-300/25 bg-rose-300/10 text-rose-100';
  if (value === 'ok' || value === 'remote') return 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100';
  return 'border-white/10 bg-white/[0.045] text-slate-300';
}

export function formatImageAuditCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function imageAuditSourceKey(item: ImageReferenceAuditItem) {
  if (item.sourceKind === 'description' || item.fieldName === 'description') return 'description';
  if (item.sourceKind === 'game_asset' || item.fieldName === 'game_assets.uri') return 'game_asset';
  if (item.fieldName === 'coverImage' || item.fieldName === 'cover_image') return 'cover';
  if (item.fieldName === 'bannerImage' || item.fieldName === 'banner_image') return 'banner';
  if (item.fieldName === 'backgroundImage' || item.fieldName === 'background_image') return 'background';
  return item.sourceKind || item.fieldName || 'unknown';
}

function imageAuditSourceLabel(item: ImageReferenceAuditItem) {
  const key = imageAuditSourceKey(item);
  if (key === 'description') return '简介图片';
  if (key === 'game_asset') return '媒体图库';
  if (key === 'cover') return '封面';
  if (key === 'banner') return '横幅';
  if (key === 'background') return '背景';
  return item.sourceLabel || imageFieldLabel(item.fieldName ?? key);
}

function pushUnique(values: string[], value: string) {
  if (!values.includes(value)) values.push(value);
}
