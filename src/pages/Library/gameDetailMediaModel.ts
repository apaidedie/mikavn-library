import type { ImageReferenceAudit } from '@/types/archive';
import type { Game } from '@/types/game';

export type DescriptionPart =
  | { type: 'text'; value: string }
  | { type: 'image'; src: string; alt?: string };

export type MediaHealthItem = {
  id: string;
  label: string;
  status: 'ok' | 'missing';
  detail: string;
};

const descriptionImageTokenPattern = /!\[([^\]]*)\]\(([^)]*?)\)|<img\b[^>]*>|\[img\]([\s\S]*?)\[\/img\]|https?:\/\/[^\s<>"']+?\.(?:png|jpe?g|webp|gif)(?:\?[^\s<>"']*)?/gi;

export const assetTypeOrder = ['cover', 'banner', 'background', 'screenshot', 'other'];
export const descriptionImageInitialRenderLimit = 12;

export function parseDescriptionParts(value: string): DescriptionPart[] {
  const parts: DescriptionPart[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(descriptionImageTokenPattern)) {
    const index = match.index ?? 0;
    pushDescriptionText(parts, value.slice(lastIndex, index));

    const token = match[0];
    const image = imagePartFromToken(token, match);
    if (image) parts.push(image);
    else pushDescriptionText(parts, token);

    lastIndex = index + token.length;
  }

  pushDescriptionText(parts, value.slice(lastIndex));
  return parts;
}

export function getVisibleDescriptionParts(parts: DescriptionPart[], imageLimit: number) {
  const limit = Number.isFinite(imageLimit) ? Math.max(0, Math.floor(imageLimit)) : Number.POSITIVE_INFINITY;
  const visibleParts: DescriptionPart[] = [];
  let renderedImageCount = 0;
  let totalImageCount = 0;

  for (const part of parts) {
    if (part.type === 'image') {
      totalImageCount += 1;
      if (renderedImageCount >= limit) continue;
      renderedImageCount += 1;
    }
    visibleParts.push(part);
  }

  return {
    hiddenImageCount: totalImageCount - renderedImageCount,
    renderedImageCount,
    totalImageCount,
    visibleParts,
  };
}

function pushDescriptionText(parts: DescriptionPart[], value: string) {
  const normalized = value.replace(/\r\n?/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
  if (!normalized) return;
  const previous = parts.at(-1);
  if (previous?.type === 'text') previous.value = `${previous.value}\n${normalized}`;
  else parts.push({ type: 'text', value: normalized });
}

function imagePartFromToken(token: string, match: RegExpMatchArray): DescriptionPart | null {
  if (match[2] !== undefined) {
    const src = cleanDescriptionImageSource(match[2]);
    return src ? { type: 'image', src, alt: decodeDescriptionHtml(match[1] ?? '') } : null;
  }

  if (token.toLowerCase().startsWith('<img')) {
    const src = readDescriptionImageAttr(token, ['src', 'data-src', 'data-original', 'data-lazy-src']);
    if (!src) return null;
    return { type: 'image', src: cleanDescriptionImageSource(src), alt: readDescriptionImageAttr(token, ['alt', 'title']) };
  }

  if (match[3] !== undefined) {
    const src = cleanDescriptionImageSource(match[3]);
    return src ? { type: 'image', src } : null;
  }

  const src = cleanDescriptionImageSource(token, true);
  return src ? { type: 'image', src } : null;
}

function readDescriptionImageAttr(tag: string, names: string[]) {
  for (const name of names) {
    const pattern = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
    const match = tag.match(pattern);
    const value = match?.[2] ?? match?.[3] ?? match?.[4];
    if (value) return decodeDescriptionHtml(value.trim());
  }
  return '';
}

function cleanDescriptionImageSource(value: string, trimTrailingPunctuation = false) {
  let clean = decodeDescriptionHtml(value).trim().replace(/^['"]|['"]$/g, '');
  if (trimTrailingPunctuation) clean = clean.replace(/[),，。.;；]+$/g, '');
  if (clean.startsWith('//')) clean = `https:${clean}`;
  return clean;
}

function decodeDescriptionHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function assetTypeLabel(type: string) {
  const labels: Record<string, string> = {
    cover: '封面',
    banner: '横幅',
    background: '背景',
    screenshot: '截图',
    other: '其他',
  };
  return labels[type] ?? type;
}

export function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? Math.round(size) : size.toFixed(size >= 10 ? 1 : 2)} ${units[unit]}`;
}

export function summarizeMediaHealth(game: Game): { items: MediaHealthItem[]; missingCount: number } {
  const descriptionImageCount = countDescriptionImages(game.description);
  const items: MediaHealthItem[] = [
    mediaFieldHealth('cover', '封面', game.coverImage),
    mediaFieldHealth('banner', '横幅', game.bannerImage),
    mediaFieldHealth('background', '背景', game.backgroundImage),
    {
      id: 'description-images',
      label: '简介图',
      status: descriptionImageCount > 0 ? 'ok' : 'missing',
      detail: descriptionImageCount > 0 ? `${descriptionImageCount} 张引用` : '未检测到引用',
    },
  ];
  return { items, missingCount: items.filter((item) => item.status === 'missing').length };
}

export function formatGameImageDiagnostic(game: Game, audit: ImageReferenceAudit | null) {
  const descriptionImageCount = countDescriptionImages(game.description);
  const lines = [
    '# MikaVN 图片诊断',
    '',
    `游戏：${game.title} (${game.id})`,
    `安装目录：${valueOrEmpty(game.installPath)}`,
    `封面：${valueOrEmpty(game.coverImage)}`,
    `横幅：${valueOrEmpty(game.bannerImage)}`,
    `背景：${valueOrEmpty(game.backgroundImage)}`,
    `简介图片：${descriptionImageCount} 张引用`,
    '',
    '## 引用审计',
  ];

  if (!audit) {
    lines.push('尚未运行图片引用检查。请先点“检查引用”，或到维护中心查看图片健康。');
  } else {
    lines.push(
      `引用总数：${audit.totalRefs}`,
      `问题引用：${audit.issueCount}`,
      `本地引用：${audit.localCount}`,
      `远程引用：${audit.remoteCount}`,
      `缺失：${audit.missingCount}`,
      `C 盘：${audit.cDriveCount}`,
      `Playnite：${audit.playniteCount}`,
      `结果截断：${audit.truncated ? '是' : '否'}`,
    );

    const issueItems = audit.items.filter((item) => item.issues.length > 0 || item.status !== 'ok').slice(0, 8);
    if (issueItems.length > 0) {
      lines.push('', '## 问题样本');
      issueItems.forEach((item, index) => {
        const issues = item.issues.length > 0 ? item.issues : [item.status];
        lines.push(
          `${index + 1}. ${imageAuditFieldLabel(item.fieldName ?? item.sourceLabel)} [${issues.map(imageAuditIssueLabel).join(', ')}]`,
          `   原始值：${item.value}`,
        );
        if (item.resolvedPath) lines.push(`   解析路径：${item.resolvedPath}`);
      });
    }
  }

  lines.push('', '维护入口：维护中心 -> 图片健康 / 图片引用审计');
  return lines.join('\n');
}

function mediaFieldHealth(id: string, label: string, value?: string | null): MediaHealthItem {
  const filled = Boolean(value?.trim());
  return {
    id,
    label,
    status: filled ? 'ok' : 'missing',
    detail: filled ? '已填写' : '缺失',
  };
}

function valueOrEmpty(value?: string | null) {
  return value?.trim() ? value.trim() : '(空)';
}

function countDescriptionImages(value?: string | null) {
  return parseDescriptionParts(value ?? '').filter((part) => part.type === 'image').length;
}

export function imageAuditIssueLabel(value: string) {
  if (value === 'missing') return '缺失';
  if (value === 'c_drive') return 'C 盘';
  if (value === 'playnite') return 'Playnite';
  if (value === 'remote') return '远程';
  if (value === 'ok') return '正常';
  if (value === 'warning') return '警告';
  return value;
}

export function imageAuditFieldLabel(value: string) {
  if (value === 'cover_image' || value === 'coverImage' || value === '封面') return '封面';
  if (value === 'banner_image' || value === 'bannerImage' || value === '横幅') return '横幅';
  if (value === 'background_image' || value === 'backgroundImage' || value === '背景') return '背景';
  if (value === 'description' || value === '简介图片') return '简介图';
  if (value === 'game_assets.uri') return '图库';
  return value;
}

export function imageAuditBadgeClass(value: string) {
  if (value === 'missing') return 'border-amber-300/25 bg-amber-300/10 text-amber-100';
  if (value === 'c_drive' || value === 'playnite') return 'border-rose-300/25 bg-rose-300/10 text-rose-100';
  if (value === 'ok' || value === 'remote') return 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100';
  return 'border-white/10 bg-white/[0.045] text-slate-300';
}

export type MediaAuditItem = ImageReferenceAudit['items'][number];
