import type { Game, UpdateGameInput } from '@/types/game';
import type { AdvancedSearchInput, AdvancedSearchResult, ApplyMetadataFields, BatchMatchJob, BatchMatchStatus, FieldLock, MatchSuggestion, MetadataProvider, MetadataSearchResponse, NormalizedMetadata, SearchClause, SearchQueryValidation } from '@/types/metadata';
import { mockMetadata } from './mockStoreFixtures';
import { ensureGameDefaults } from './mockStoreGames';
import { BATCH_KEY, readSettings } from './mockStoreStorage';
import { makeTask } from './mockStoreTasks';

export function cleanTitle(value: string) {
  return value
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[【「『（《〈][^】」』）》〉]*[】」』）》〉]/g, ' ')
    .replace(/(?:汉化硬盘版|汉化版|硬盘版|绿色版|中文版|DL版|パッケージ版)/g, ' ')
    .replace(/v(?:er)?\.?\s*[\d.]+[a-z]?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function score(query: string, title: string) {
  const normalize = (text: string) => text.toLowerCase().replace(/[\s○×★☆◆◇■□▲△▼▽♀♂♪♡♥！!？?…．.、，,：:；;]/g, '');
  const q = normalize(query);
  const t = normalize(title);
  if (!q || !t) return 0;
  if (q === t) return 1;
  if (t.includes(q)) return 0.7 + 0.3 * (q.length / Math.max(t.length, 1));
  const chars = [...new Set(q.split(''))];
  return (chars.filter((char) => t.includes(char)).length / chars.length) * 0.6;
}

export function parseMockSearch(query: string): SearchClause[] {
  return query
    .match(/"[^"]+"|'[^']+'|\S+/g)?.map((raw) => raw.replace(/^['"]|['"]$/g, '')).filter((token) => token.toUpperCase() !== 'OR' && token.toUpperCase() !== 'AND')
    .map((raw): SearchClause => {
      const negated = raw.startsWith('-');
      const token = negated ? raw.slice(1) : raw;
      const comparison = token.match(/^([a-z_]+)(>=|<=|>|<|=)(.+)$/i);
      if (comparison) return { kind: 'comparison', field: normalizeMockSearchField(comparison[1]), operator: comparison[2], value: comparison[3], negated };
      const field = token.match(/^([a-z_]+):(.+)$/i);
      if (field) return { kind: 'field', field: normalizeMockSearchField(field[1]), operator: null, value: field[2], negated };
      return { kind: 'term', field: null, operator: null, value: token, negated };
    }) ?? [];
}

function normalizeMockSearchField(field: string) {
  const normalized = field.toLowerCase();
  if (normalized === 'developer') return 'dev';
  if (normalized === 'released' || normalized === 'release' || normalized === 'date') return 'released';
  if (normalized === 'played' || normalized === 'last_played') return 'played';
  if (normalized === 'metadata') return 'meta';
  if (['tag', 'genre', 'dev', 'publisher', 'brand', 'status', 'path', 'meta', 'collection', 'age', 'rating', 'playtime'].includes(normalized)) return normalized;
  return 'unsupported';
}

export function mockMatchesClause(game: Game, clause: SearchClause) {
  const value = clause.value.toLowerCase();
  if (clause.kind === 'comparison') {
    const expected = Number.parseFloat(value.replace(/[hm]$/, ''));
    const actual = clause.field === 'rating' ? game.rating ?? -1 : clause.field === 'playtime' ? game.totalPlaySeconds / (value.endsWith('m') ? 60 : 3600) : 0;
    switch (clause.operator) {
      case '>=': return actual >= expected;
      case '<=': return actual <= expected;
      case '>': return actual > expected;
      case '<': return actual < expected;
      default: return actual === expected;
    }
  }
  const fields = [game.title, game.originalTitle, game.developer, game.publisher, game.brand, game.description, game.notes, game.installPath, game.pathStatus, ...game.aliases, ...game.tags, ...game.genres].filter(Boolean).join(' ').toLowerCase();
  if (clause.kind === 'term') return fields.includes(value);
  switch (clause.field) {
    case 'tag': return game.tags.some((item) => item.toLowerCase().includes(value));
    case 'genre': return game.genres.some((item) => item.toLowerCase().includes(value));
    case 'dev': return [game.developer, game.brand].some((item) => item?.toLowerCase().includes(value));
    case 'publisher': return Boolean(game.publisher?.toLowerCase().includes(value));
    case 'brand': return Boolean(game.brand?.toLowerCase().includes(value));
    case 'status': return game.playStatus === value;
    case 'path': return game.pathStatus === value || game.installPath.toLowerCase().includes(value);
    case 'meta': return value === 'complete' ? hasCompleteMetadata(game) : true;
    case 'age': return Boolean(game.ageRating?.toLowerCase().includes(value));
    default: return fields.includes(value);
  }
}

export function externalIdCount(game: Game) {
  return [game.vndbId, game.bangumiId, game.dlsiteId, game.fanzaId, game.ymgalId].filter((value) => value?.trim()).length;
}

export function hasMissingAnyExternalId(game: Game) {
  return [game.vndbId, game.bangumiId, game.dlsiteId, game.fanzaId, game.ymgalId].some((value) => !value?.trim());
}

export function hasCompleteMetadata(game: Game) {
  const hasDeveloper = Boolean(game.developer?.trim() || game.brand?.trim());
  return Boolean(game.description?.trim() && game.releaseDate?.trim() && hasDeveloper && game.coverImage?.trim() && externalIdCount(game) > 0);
}

export function hasMockDescriptionImage(value?: string | null) {
  return Boolean(value?.match(/!\[[^\]]*\]\([^)]+\)|<img\b|\[img\]|https?:\/\/\S+\.(?:png|jpe?g|webp|gif)/i));
}

export function metadataStatusMatches(game: Game, status?: string) {
  if (!status || status === 'all') return true;
  const complete = hasCompleteMetadata(game);
  if (status === 'complete') return complete;
  if (status === 'missing_description') return !game.description?.trim();
  if (status === 'missing_cover') return !game.coverImage?.trim();
  if (status === 'missing_banner') return !game.bannerImage?.trim();
  if (status === 'missing_background') return !game.backgroundImage?.trim();
  if (status === 'missing_artwork') return !game.coverImage?.trim() || !game.bannerImage?.trim() || !game.backgroundImage?.trim();
  if (status === 'missing_description_image') return Boolean((game.dlsiteId?.trim() || game.fanzaId?.trim()) && !hasMockDescriptionImage(game.description));
  if (status === 'missing_external_id') return externalIdCount(game) === 0;
  if (status === 'missing_any_external_id') return hasMissingAnyExternalId(game);
  if (status === 'needs_metadata') return !complete;
  return true;
}

type MockStoreMetadataDependencies = {
  readGames: () => Game[];
  getGame: (id: string) => Promise<Game>;
  updateGame: (id: string, input: UpdateGameInput) => Promise<Game>;
  listFieldLocks: (gameId: string) => Promise<FieldLock[]>;
};

export function createMockStoreMetadata({ readGames, getGame, updateGame, listFieldLocks }: MockStoreMetadataDependencies) {
  const searchMetadata = (query: string, providers: MetadataProvider[]): Promise<MetadataSearchResponse> => {
    const cleanedQuery = cleanTitle(query);
    const variants = [...new Set([query, cleanedQuery].filter(Boolean))];
    const settings = readSettings();
    const activeProviders = providers.filter((provider) => settings[`provider_${provider}_enabled`] !== 'false');
    const results = mockMetadata
      .filter((item) => activeProviders.includes(item.provider))
      .map((item) => ({ ...item, relevanceScore: Math.max(item.relevanceScore, score(cleanedQuery || query, item.title) + (item.fromVndbSniff ? 0.1 : 0)) }))
      .sort((a, b) => Number(b.fromVndbSniff) - Number(a.fromVndbSniff) || b.relevanceScore - a.relevanceScore);
    return Promise.resolve({ query, cleanedQuery, variants, results, errors: [] });
  };

  const validateSearchQuery = (query: string): Promise<SearchQueryValidation> => {
    const clauses = parseMockSearch(query);
    const errors = clauses.filter((clause) => clause.field === 'unsupported').map((clause) => `unsupported search field: ${clause.value}`);
    return Promise.resolve({ valid: errors.length === 0, errors, clauses: clauses.filter((clause) => clause.field !== 'unsupported') });
  };

  const searchGamesAdvanced = (input: AdvancedSearchInput): Promise<AdvancedSearchResult> => {
    const clauses = parseMockSearch(input.query);
    const errors = clauses.filter((clause) => clause.field === 'unsupported').map((clause) => `unsupported search field: ${clause.value}`);
    let games = readGames().map(ensureGameDefaults);
    if (errors.length === 0 && clauses.length > 0) {
      games = games.filter((game) => clauses.every((clause) => {
        const matched = mockMatchesClause(game, clause);
        return clause.negated ? !matched : matched;
      }));
    }
    const total = games.length;
    const limit = Math.max(1, Math.min(input.limit ?? 100, 500));
    return Promise.resolve({ query: input.query, cleanedQuery: input.query.trim(), total, games: games.slice(0, limit), clauses: clauses.filter((clause) => clause.field !== 'unsupported'), errors });
  };

  const matchMetadataForGame = async (gameId: string): Promise<MatchSuggestion> => {
    const game = await getGame(gameId);
    const response = await searchMetadata(cleanTitle(game.title), ['vndb', 'dlsite', 'fanza']);
    const selected = response.results.find((item) => item.fromVndbSniff) ?? response.results.find((item) => item.relevanceScore >= 0.3) ?? null;
    return {
      gameId,
      originalTitle: game.title,
      cleanedTitle: response.cleanedQuery,
      selected,
      candidates: response.results,
      status: selected ? 'success' : response.results.length ? 'review' : 'no_result',
      reason: selected ? null : '候选分数低于自动匹配阈值',
    };
  };

  const applyMetadataToGame = async (gameId: string, metadata: NormalizedMetadata, fields: ApplyMetadataFields, forceLocked = false): Promise<Game> => {
    const locks = forceLocked ? [] : await listFieldLocks(gameId);
    const locked = new Set(locks.filter((lock) => lock.lockedByUser).map((lock) => lock.fieldName));
    const input: UpdateGameInput = {};
    const has = (field: ApplyMetadataFields[number]) => fields.includes(field) && !locked.has(field);
    if (has('title')) input.title = metadata.title;
    if (has('originalTitle')) input.originalTitle = metadata.originalTitle ?? metadata.title;
    if (has('description')) input.description = metadata.description ?? undefined;
    if (has('releaseDate')) input.releaseDate = metadata.releaseDate ?? undefined;
    if (has('developer')) input.developer = metadata.developers[0];
    if (has('publisher')) input.publisher = metadata.publishers[0];
    if (has('tags')) input.tags = metadata.tags;
    if (has('genres')) input.genres = metadata.genres;
    if (has('coverImage')) input.coverImage = metadata.images[0];
    if (has('externalIds')) {
      input.vndbId = metadata.externalIds.vndb ?? undefined;
      input.bangumiId = metadata.externalIds.bangumi ?? undefined;
      input.dlsiteId = metadata.externalIds.dlsite ?? undefined;
      input.fanzaId = metadata.externalIds.fanza ?? undefined;
      input.ymgalId = metadata.externalIds.ymgal ?? undefined;
    }
    if (has('ageRating')) input.ageRating = metadata.ageRating ?? undefined;
    return updateGame(gameId, input);
  };

  const batchMatchMetadata = async (gameIds: string[]): Promise<BatchMatchJob> => {
    const now = new Date().toISOString();
    const task = makeTask({
      taskType: 'metadata.batch_match',
      status: 'completed',
      progress: 1,
      message: `批量匹配完成：${gameIds.length} 个条目`,
      retryPayload: JSON.stringify({ gameIds }),
      retryable: true,
    });
    const job: BatchMatchJob = { id: crypto.randomUUID(), taskId: task.id, status: 'completed', total: gameIds.length, completed: gameIds.length, createdAt: now, updatedAt: now };
    const results = await Promise.all(gameIds.map(async (gameId) => {
      const suggestion = await matchMetadataForGame(gameId);
      return {
        id: crypto.randomUUID(),
        jobId: job.id,
        gameId,
        originalTitle: suggestion.originalTitle,
        cleanedTitle: suggestion.cleanedTitle,
        selectedProvider: suggestion.selected?.provider ?? null,
        selectedId: suggestion.selected?.id ?? null,
        selectedScore: suggestion.selected?.relevanceScore ?? null,
        status: suggestion.status,
        reason: suggestion.reason,
        candidates: suggestion.candidates,
        createdAt: new Date().toISOString(),
      };
    }));
    localStorage.setItem(BATCH_KEY, JSON.stringify({ job, results }));
    return job;
  };

  return {
    searchMetadata,
    validateSearchQuery,
    searchGamesAdvanced,
    matchMetadataForGame,
    applyMetadataToGame,
    batchMatchMetadata,

    getBatchMatchStatus(jobId: string): Promise<BatchMatchStatus> {
      const raw = localStorage.getItem(BATCH_KEY);
      if (!raw) {
        const now = new Date().toISOString();
        return Promise.resolve({ job: { id: jobId, status: 'missing', total: 0, completed: 0, createdAt: now, updatedAt: now }, results: [] });
      }
      return Promise.resolve(JSON.parse(raw) as BatchMatchStatus);
    },

    cancelBatchMatch(jobId: string) {
      const raw = localStorage.getItem(BATCH_KEY);
      if (raw) {
        const status = JSON.parse(raw) as BatchMatchStatus;
        status.job = { ...status.job, id: jobId, status: 'cancelled', updatedAt: new Date().toISOString() };
        localStorage.setItem(BATCH_KEY, JSON.stringify(status));
      }
      return Promise.resolve();
    },
  };
}
