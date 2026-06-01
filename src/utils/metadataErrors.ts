import { PROVIDER_LABEL, type MetadataProvider } from '@/types/metadata';
import { errorMessage } from './errorMessage';

const providerLabels: Record<MetadataProvider | string, string> = PROVIDER_LABEL;

export function metadataErrorMessage(reason: unknown) {
  return friendlyMetadataError(errorMessage(reason));
}

export function friendlyMetadataErrors(errors: string[]) {
  const seen = new Set<string>();
  const messages: string[] = [];
  for (const error of errors) {
    const message = friendlyMetadataError(error);
    if (!seen.has(message)) {
      seen.add(message);
      messages.push(message);
    }
  }
  return messages;
}

export function friendlyMetadataError(error: string) {
  const provider = detectProvider(error);
  if (!provider) {
    return error || '元数据检索失败。';
  }
  if (provider === 'vndb-sniff') {
    return 'VNDB 嗅探到的外部 ID 暂时无法补全详情，已保留基础候选。';
  }

  const label = providerLabels[provider] ?? provider;
  const lower = error.toLowerCase();
  const action = provider === 'vndb' ? '已继续使用其它可用数据源。' : '已继续使用其它来源结果。';

  if (lower.includes('timed out') || lower.includes('timeout')) {
    return `${label} 响应超时，${action}`;
  }
  if (lower.includes('dns') || lower.includes('connect') || lower.includes('connection') || lower.includes('network')) {
    return `${label} 暂时无法连接，${action}`;
  }
  if (lower.includes('http') || lower.includes('status')) {
    return `${label} 返回了异常状态，${action}`;
  }
  if (lower.includes('parse') || lower.includes('body') || lower.includes('title not found')) {
    return `${label} 页面结构暂时无法解析，${action}`;
  }
  if (lower.includes('not found') || lower.includes('item not found')) {
    return `${label} 没有找到对应条目，${action}`;
  }
  return `${label} 检索失败，${action}`;
}

function detectProvider(error: string): MetadataProvider | 'vndb-sniff' | null {
  const lower = error.toLowerCase();
  if (lower.includes('vndb sniff')) return 'vndb-sniff';
  if (lower.includes('vndb')) return 'vndb';
  if (lower.includes('dlsite')) return 'dlsite';
  if (lower.includes('fanza') || lower.includes('dmm')) return 'fanza';

  const prefix = lower.match(/^\s*(vndb|dlsite|fanza)\s*:/)?.[1];
  if (prefix === 'vndb' || prefix === 'dlsite' || prefix === 'fanza') {
    return prefix;
  }

  return null;
}
