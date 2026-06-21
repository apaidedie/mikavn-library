import type { Game } from '@/types/game';
import type { ApplyMetadataFields, BatchMatchResult, MetadataSearchResult, NormalizedMetadata } from '@/types/metadata';
import { PROVIDER_LABEL } from '@/types/metadata';

export type QueuePresetRequest = { key: number; query?: string; missingProvider?: string };
export type MissingProviderFilter = 'all' | 'external_id' | 'vndb' | 'bangumi' | 'dlsite' | 'fanza' | 'ymgal';
export type BatchMetadataQueueState = {
  incompleteGames: Game[];
  filteredGames: Game[];
  gapCounts: Record<MissingProviderFilter, number>;
};
export type BatchMetadataResultCounts = {
  success: number;
  review: number;
  noResult: number;
  error: number;
};
export type BatchMetadataResultState = {
  filteredResults: BatchMatchResult[];
  applicableResults: BatchMatchResult[];
  resultCounts: BatchMetadataResultCounts;
};
export type BatchMetadataQueueRenderWindow = {
  visibleGames: Game[];
  renderedCount: number;
  totalCount: number;
  hasMore: boolean;
};

export const defaultFields: ApplyMetadataFields = ['originalTitle', 'description', 'releaseDate', 'developer', 'tags', 'genres', 'coverImage', 'externalIds'];
export const mediaFields: ApplyMetadataFields = ['coverImage', 'externalIds'];
export const textFields: ApplyMetadataFields = ['originalTitle', 'description', 'releaseDate', 'developer', 'tags', 'genres'];
export const batchMetadataQueueInitialRenderCount = 160;
export const batchMetadataQueueRenderBatchSize = 160;

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

export function deriveBatchMetadataQueueState(games: Game[], filters: { query: string; missingProviderFilter: MissingProviderFilter }): BatchMetadataQueueState {
  const incompleteGames = games.filter(hasMissingExternalId);
  const queryText = filters.query.trim().toLowerCase();
  const filteredGames = incompleteGames.filter((game) => {
    const matchesQuery = !queryText || [game.title, game.originalTitle, game.developer, game.brand, game.publisher, game.installPath]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(queryText));
    return matchesQuery && matchesMissingProviderFilter(game, filters.missingProviderFilter);
  });

  return {
    incompleteGames,
    filteredGames,
    gapCounts: {
      all: incompleteGames.length,
      external_id: games.filter((game) => !hasAnyExternalId(game)).length,
      vndb: games.filter((game) => !hasExternalIdValue(game.vndbId)).length,
      bangumi: games.filter((game) => !hasExternalIdValue(game.bangumiId)).length,
      dlsite: games.filter((game) => !hasExternalIdValue(game.dlsiteId)).length,
      fanza: games.filter((game) => !hasExternalIdValue(game.fanzaId)).length,
      ymgal: games.filter((game) => !hasExternalIdValue(game.ymgalId)).length,
    },
  };
}

export function deriveBatchMetadataResultState(results: BatchMatchResult[], filters: { appliedIds: string[]; query: string; resultStatusFilter: string; selectedCandidates: Record<string, MetadataSearchResult>; writeFilter: string }): BatchMetadataResultState {
  const filteredResults = results.filter((result) => {
    const candidate = getBatchMetadataCandidate(result, filters.selectedCandidates);
    const matchesQuery = matchesBatchResultQuery(result, candidate, filters.query);
    const matchesStatus = filters.resultStatusFilter === 'all' || result.status === filters.resultStatusFilter;
    const matchesWrite = filters.writeFilter === 'all'
      || (filters.writeFilter === 'writable' && Boolean(candidate) && !filters.appliedIds.includes(result.id))
      || (filters.writeFilter === 'applied' && filters.appliedIds.includes(result.id))
      || (filters.writeFilter === 'needs_review' && !candidate);
    return matchesQuery && matchesStatus && matchesWrite;
  });

  return {
    filteredResults,
    applicableResults: filteredResults.filter((result) => Boolean(getBatchMetadataCandidate(result, filters.selectedCandidates)) && !filters.appliedIds.includes(result.id)),
    resultCounts: {
      success: results.filter((result) => result.status === 'success').length,
      review: results.filter((result) => result.status === 'review').length,
      noResult: results.filter((result) => result.status === 'no_result').length,
      error: results.filter((result) => result.status === 'error').length,
    },
  };
}

export function getBatchMetadataCandidate(result: BatchMatchResult, selectedCandidates: Record<string, MetadataSearchResult>) {
  return selectedCandidates[result.id] ?? result.candidates.find((item) => item.provider === result.selectedProvider && item.id === result.selectedId) ?? result.candidates[0] ?? null;
}

export function getBatchMetadataQueueRenderWindow(games: Game[], visibleCount: number): BatchMetadataQueueRenderWindow {
  const safeVisibleCount = Math.max(0, Math.min(games.length, Math.floor(visibleCount)));
  const visibleGames = games.slice(0, safeVisibleCount);
  return {
    visibleGames,
    renderedCount: visibleGames.length,
    totalCount: games.length,
    hasMore: visibleGames.length < games.length,
  };
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
