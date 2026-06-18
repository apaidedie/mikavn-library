import type { Game } from '@/types/game';
import type { ApplyMetadataFields, BatchMatchResult, MetadataSearchResult, NormalizedMetadata } from '@/types/metadata';
import { PROVIDER_LABEL } from '@/types/metadata';

export type QueuePresetRequest = { key: number; query?: string; missingProvider?: string };
export type MissingProviderFilter = 'all' | 'external_id' | 'vndb' | 'bangumi' | 'dlsite' | 'fanza' | 'ymgal';

export const defaultFields: ApplyMetadataFields = ['originalTitle', 'description', 'releaseDate', 'developer', 'tags', 'genres', 'coverImage', 'externalIds'];
export const mediaFields: ApplyMetadataFields = ['coverImage', 'externalIds'];
export const textFields: ApplyMetadataFields = ['originalTitle', 'description', 'releaseDate', 'developer', 'tags', 'genres'];

export const missingProviderOptions: { id: MissingProviderFilter; label: string; shortLabel: string }[] = [
  { id: 'all', label: '全部缺失来源', shortLabel: '全部' },
  { id: 'external_id', label: '缺全部外部 ID', shortLabel: '缺全部 ID' },
  { id: 'vndb', label: '缺 VNDB', shortLabel: 'VNDB' },
  { id: 'bangumi', label: '缺 Bangumi', shortLabel: 'Bangumi' },
  { id: 'dlsite', label: '缺 DLsite', shortLabel: 'DLsite' },
  { id: 'fanza', label: '缺 FANZA', shortLabel: 'FANZA' },
  { id: 'ymgal', label: '缺 YMGal', shortLabel: 'YMGal' },
];

export const fieldOptions: Array<{ id: ApplyMetadataFields[number]; label: string }> = [
  { id: 'title', label: '标题' },
  { id: 'originalTitle', label: '原名' },
  { id: 'description', label: '简介' },
  { id: 'releaseDate', label: '发售日' },
  { id: 'developer', label: '会社' },
  { id: 'tags', label: '标签' },
  { id: 'genres', label: '类型' },
  { id: 'coverImage', label: '封面' },
  { id: 'externalIds', label: '外部 ID' },
];

export function resultToMetadata(result: MetadataSearchResult): NormalizedMetadata {
  return {
    provider: result.provider,
    id: result.id,
    title: result.title,
    originalTitle: result.provider === 'vndb' ? result.title : null,
    aliases: [],
    description: result.description,
    releaseDate: result.releaseDate,
    developers: result.developers,
    publishers: [],
    tags: result.tags,
    genres: ['Visual Novel'],
    images: result.imageUrl ? [result.imageUrl] : [],
    externalIds: result.externalIds,
    ageRating: null,
  };
}

export function matchesBatchResultQuery(result: BatchMatchResult, selectedCandidate: MetadataSearchResult | null, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  const candidates = [selectedCandidate, ...result.candidates].filter(Boolean) as MetadataSearchResult[];
  const candidateFields = candidates.flatMap((candidate) => [
    providerLabel(candidate.provider),
    candidate.provider,
    candidate.id,
    candidate.title,
    candidate.description,
    candidate.releaseDate,
    ...candidate.developers,
    ...candidate.tags,
    ...Object.entries(candidate.externalIds).flatMap(([provider, id]) => [provider, id]),
  ]);
  return [
    result.originalTitle,
    result.cleanedTitle,
    result.status,
    result.reason,
    result.selectedProvider,
    result.selectedId,
    ...candidateFields,
  ].some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery));
}

export function providerLabel(value?: string | null) {
  if (value === 'vndb' || value === 'dlsite' || value === 'fanza') {
    return PROVIDER_LABEL[value];
  }
  return value ?? '未知来源';
}

export function normalizeMissingProviderFilter(value?: string | null): MissingProviderFilter {
  return missingProviderOptions.some((option) => option.id === value) ? value as MissingProviderFilter : 'all';
}

export function hasExternalIdValue(value?: string | null) {
  return Boolean(value?.trim());
}

export function hasAnyExternalId(game: Game) {
  return [game.vndbId, game.bangumiId, game.dlsiteId, game.fanzaId, game.ymgalId].some(hasExternalIdValue);
}

export function hasMissingExternalId(game: Game) {
  return [game.vndbId, game.bangumiId, game.dlsiteId, game.fanzaId, game.ymgalId].some((value) => !hasExternalIdValue(value));
}

export function matchesMissingProviderFilter(game: Game, filter: MissingProviderFilter) {
  if (filter === 'all') return true;
  if (filter === 'external_id') return !hasAnyExternalId(game);
  if (filter === 'vndb') return !hasExternalIdValue(game.vndbId);
  if (filter === 'bangumi') return !hasExternalIdValue(game.bangumiId);
  if (filter === 'dlsite') return !hasExternalIdValue(game.dlsiteId);
  if (filter === 'fanza') return !hasExternalIdValue(game.fanzaId);
  return !hasExternalIdValue(game.ymgalId);
}
