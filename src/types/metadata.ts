import type { Game } from './game';

export type MetadataProvider = 'vndb' | 'dlsite' | 'fanza';

export type ExternalIds = {
  vndb?: string | null;
  bangumi?: string | null;
  dlsite?: string | null;
  fanza?: string | null;
  ymgal?: string | null;
};

export type MetadataSearchResult = {
  provider: MetadataProvider;
  id: string;
  title: string;
  url: string;
  imageUrl?: string | null;
  description?: string | null;
  releaseDate?: string | null;
  developers: string[];
  tags: string[];
  externalIds: ExternalIds;
  relevanceScore: number;
  fromVndbSniff: boolean;
};

export type MetadataSearchResponse = {
  query: string;
  cleanedQuery: string;
  variants: string[];
  results: MetadataSearchResult[];
  errors: string[];
};

export type NormalizedMetadata = {
  provider: MetadataProvider | string;
  id: string;
  title: string;
  originalTitle?: string | null;
  aliases: string[];
  description?: string | null;
  releaseDate?: string | null;
  developers: string[];
  publishers: string[];
  tags: string[];
  genres: string[];
  images: string[];
  externalIds: ExternalIds;
  ageRating?: string | null;
};

export type MatchSuggestion = {
  gameId: string;
  originalTitle: string;
  cleanedTitle: string;
  selected?: MetadataSearchResult | null;
  candidates: MetadataSearchResult[];
  status: 'success' | 'review' | 'no_result' | 'error' | string;
  reason?: string | null;
};

export type BatchMatchJob = {
  id: string;
  taskId?: string | null;
  status: string;
  total: number;
  completed: number;
  createdAt: string;
  updatedAt: string;
};

export type BatchMatchResult = {
  id: string;
  jobId: string;
  gameId: string;
  originalTitle: string;
  cleanedTitle?: string | null;
  selectedProvider?: MetadataProvider | string | null;
  selectedId?: string | null;
  selectedScore?: number | null;
  status: string;
  reason?: string | null;
  candidates: MetadataSearchResult[];
  createdAt: string;
};

export type BatchMatchStatus = {
  job: BatchMatchJob;
  results: BatchMatchResult[];
};

export type DescriptionImageRepairOptions = {
  provider?: 'all' | MetadataProvider | string | null;
  limit?: number | null;
  maxImages?: number | null;
  retryAttempted?: boolean | null;
};

export type DescriptionImageRepairCandidate = {
  gameId: string;
  title: string;
  provider: string;
  providerId: string;
};

export type DescriptionImageRepairPreview = {
  candidates: DescriptionImageRepairCandidate[];
  totalCandidates: number;
};

export type ArtworkRepairOptions = {
  providers?: Array<string | MetadataProvider> | null;
  fields?: Array<'cover' | 'banner' | 'background' | 'all' | string> | null;
  limit?: number | null;
  retryAttempted?: boolean | null;
};

export type ArtworkProviderRef = {
  provider: string;
  providerId: string;
};

export type ArtworkRepairCandidate = {
  gameId: string;
  title: string;
  missingFields: string[];
  providers: ArtworkProviderRef[];
};

export type ArtworkRepairPreview = {
  candidates: ArtworkRepairCandidate[];
  totalCandidates: number;
  totalMissingFields: number;
};

export type ArtworkProviderDiagnosis = {
  provider: string;
  providerId: string;
  status: 'has_image' | 'no_image' | 'error' | string;
  reason?: string | null;
  imageUrl?: string | null;
};

export type ArtworkRepairDiagnosisItem = {
  gameId: string;
  title: string;
  missingFields: string[];
  providers: ArtworkProviderRef[];
  providerResults: ArtworkProviderDiagnosis[];
  status: 'repairable' | 'missing_external_id' | 'no_remote_image' | 'provider_error' | string;
  reason: string;
};

export type ArtworkRepairDiagnosis = {
  items: ArtworkRepairDiagnosisItem[];
  totalMissingGames: number;
  totalMissingFields: number;
  diagnosedGames: number;
  repairableCount: number;
  missingExternalIdCount: number;
  noRemoteImageCount: number;
  providerErrorCount: number;
  truncated: boolean;
};

export type DuplicateExternalIdAuditOptions = {
  providers?: Array<string | MetadataProvider> | null;
  limit?: number | null;
  retryAttempted?: boolean | null;
};

export type DuplicateExternalIdGame = {
  gameId: string;
  title: string;
  installPath: string;
  sources: string[];
};

export type DuplicateExternalIdGroup = {
  provider: string;
  externalId: string;
  gameCount: number;
  games: DuplicateExternalIdGame[];
};

export type DuplicateExternalIdPreview = {
  groups: DuplicateExternalIdGroup[];
  totalGroups: number;
  totalGames: number;
};

export type DuplicateGameMergeOptions = {
  targetGameId: string;
  sourceGameIds: string[];
};

export type DuplicateGameMergeExternalId = {
  provider: string;
  externalId: string;
};

export type DuplicateGameMergeGameSummary = {
  gameId: string;
  title: string;
  installPath: string;
  externalIds: DuplicateGameMergeExternalId[];
  totalPlaySeconds: number;
  lastPlayedAt?: string | null;
};

export type DuplicateGameMergeMovedCounts = {
  sourceGames: number;
  playSessions: number;
  launchProfiles: number;
  savePaths: number;
  saveBackups: number;
  externalIds: number;
  collectionLinks: number;
  assets: number;
  tags: number;
  fieldLocks: number;
  metadataMatchResults: number;
};

export type DuplicateGameMergePreview = {
  target: DuplicateGameMergeGameSummary;
  sources: DuplicateGameMergeGameSummary[];
  sharedExternalIds: DuplicateGameMergeExternalId[];
  movedCounts: DuplicateGameMergeMovedCounts;
  warnings: string[];
};

export type DuplicateGameMergeResult = {
  mergedGame: Game;
  deletedSourceGameIds: string[];
  movedCounts: DuplicateGameMergeMovedCounts;
  warnings: string[];
};

export type AiRecognitionResult = {
  title: string;
  rawText: string;
  confidence?: number | null;
};

export type AiConnectionTestResult = {
  ok: boolean;
  baseUrl: string;
  model: string;
  message: string;
};

export type FieldLock = {
  id: string;
  gameId: string;
  fieldName: ApplyMetadataFields[number] | string;
  lockedByUser: boolean;
  updatedAt: string;
};

export type MetadataSourceRecord = {
  id: string;
  provider: string;
  label: string;
  enabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
};

export type ExternalIdRecord = {
  id: string;
  gameId: string;
  provider: string;
  externalId: string;
  source?: string | null;
  confidence?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ApplyMetadataFields = Array<'title' | 'originalTitle' | 'description' | 'releaseDate' | 'developer' | 'publisher' | 'tags' | 'genres' | 'coverImage' | 'externalIds' | 'ageRating'>;

export type AppliedMetadataResult = Game;

export type SearchClause = {
  kind: 'term' | 'field' | 'comparison';
  field?: string | null;
  operator?: string | null;
  value: string;
  negated: boolean;
};

export type SearchQueryValidation = {
  valid: boolean;
  errors: string[];
  clauses: SearchClause[];
};

export type AdvancedSearchInput = {
  query: string;
  sortBy?: string | null;
  sortDirection?: 'asc' | 'desc' | string | null;
  limit?: number | null;
};

export type AdvancedSearchResult = {
  query: string;
  cleanedQuery: string;
  total: number;
  games: Game[];
  clauses: SearchClause[];
  errors: string[];
};

export type SavedSearch = {
  id: string;
  name: string;
  query: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SavedSearchInput = {
  name: string;
  query: string;
  description?: string | null;
};

export const PROVIDER_LABEL: Record<MetadataProvider, string> = {
  vndb: 'VNDB',
  dlsite: 'DLsite',
  fanza: 'FANZA',
};
