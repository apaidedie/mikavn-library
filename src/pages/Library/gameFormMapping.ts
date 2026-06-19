import type { Game, GameFormInput, PlayStatus } from '@/types/game';
import { PROVIDER_LABEL, type MetadataSearchResult, type NormalizedMetadata } from '@/types/metadata';

export type MetadataMergeMode = 'fill-empty' | 'replace';

export type GameFormState = {
  title: string;
  originalTitle: string;
  aliases: string;
  developer: string;
  publisher: string;
  brand: string;
  releaseDate: string;
  description: string;
  notes: string;
  tags: string;
  genres: string;
  rating: string;
  ageRating: string;
  playStatus: string;
  installPath: string;
  executablePath: string;
  workingDirectory: string;
  launchArgs: string;
  coverImage: string;
  bannerImage: string;
  backgroundImage: string;
  vndbId: string;
  dlsiteId: string;
  fanzaId: string;
  bangumiId: string;
  ymgalId: string;
  favorite: boolean;
  hidden: boolean;
};

export function initialGameFormState(game?: Game | null): GameFormState {
  return {
    title: game?.title ?? '',
    originalTitle: game?.originalTitle ?? '',
    aliases: game?.aliases.join(', ') ?? '',
    developer: game?.developer ?? '',
    publisher: game?.publisher ?? '',
    brand: game?.brand ?? '',
    releaseDate: game?.releaseDate ?? '',
    description: game?.description ?? '',
    notes: game?.notes ?? '',
    tags: game?.tags.join(', ') ?? '',
    genres: game?.genres.join(', ') ?? '',
    rating: game?.rating?.toString() ?? '',
    ageRating: game?.ageRating ?? '',
    playStatus: game?.playStatus ?? 'planned',
    installPath: game?.installPath ?? '',
    executablePath: game?.executablePath ?? '',
    workingDirectory: game?.workingDirectory ?? '',
    launchArgs: game?.launchArgs ?? '',
    coverImage: game?.coverImage ?? '',
    bannerImage: game?.bannerImage ?? '',
    backgroundImage: game?.backgroundImage ?? '',
    vndbId: game?.vndbId ?? '',
    dlsiteId: game?.dlsiteId ?? '',
    fanzaId: game?.fanzaId ?? '',
    bangumiId: game?.bangumiId ?? '',
    ymgalId: game?.ymgalId ?? '',
    favorite: game?.favorite ?? false,
    hidden: game?.hidden ?? false,
  };
}

export function toGameFormInput(form: GameFormState, game?: Game | null): GameFormInput {
  return {
    title: form.title,
    originalTitle: form.originalTitle,
    aliases: splitList(form.aliases),
    developer: form.developer,
    publisher: form.publisher,
    brand: form.brand,
    releaseDate: form.releaseDate,
    description: form.description,
    notes: form.notes,
    tags: splitList(form.tags),
    genres: splitList(form.genres),
    rating: form.rating ? Number(form.rating) : null,
    ageRating: form.ageRating,
    playStatus: form.playStatus as PlayStatus,
    installPath: form.installPath,
    executablePath: form.executablePath,
    workingDirectory: form.workingDirectory,
    launchArgs: form.launchArgs,
    pathStatus: game?.pathStatus ?? 'unknown',
    lastPathCheckedAt: game?.lastPathCheckedAt ?? null,
    coverImage: form.coverImage,
    bannerImage: form.bannerImage,
    backgroundImage: form.backgroundImage,
    vndbId: form.vndbId,
    dlsiteId: form.dlsiteId,
    fanzaId: form.fanzaId,
    bangumiId: form.bangumiId,
    ymgalId: form.ymgalId,
    favorite: form.favorite,
    hidden: form.hidden,
  };
}

export function splitList(value: string) {
  return value.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
}

export function guessTitleFromPath(value: string) {
  const clean = value.trim();
  if (!clean) return '';
  const normalized = clean.replace(/\\/g, '/');
  const last = normalized.split('/').filter(Boolean).pop() ?? clean;
  const withoutExt = last.replace(/\.(exe|bat|cmd|lnk)$/i, '');
  const withoutDateCircle = withoutExt.replace(/^\[?\d{6}\]?\s*/g, '');
  return withoutDateCircle
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[【「『（《〈][^】」』）》〉]*[】」』）》〉]/g, ' ')
    .replace(/(?:汉化硬盘版|汉化版|硬盘版|绿色版|中文版|DL版|パッケージ版|Windows|Android|iOS|PC)/gi, ' ')
    .replace(/v(?:er)?\.?\s*[\d.]+[a-z]?/gi, ' ')
    .replace(/[_＿]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || withoutExt.trim();
}

export function parentPath(value: string) {
  const index = Math.max(value.lastIndexOf('\\'), value.lastIndexOf('/'));
  return index > 0 ? value.slice(0, index) : '';
}

export function guessTitleSourceFromExecutable(executablePath: string, installPath: string) {
  const executableTitle = guessTitleFromPath(executablePath).toLowerCase();
  if (!executableTitle || ['game', 'start', 'launcher', 'launch', 'setup', 'config', 'update', 'uninstall'].includes(executableTitle)) {
    return installPath || executablePath;
  }
  return executablePath;
}

export function mergeListText(current: string, ...items: Array<string | null | undefined>) {
  const values = [
    ...splitList(current),
    ...items.map((item) => item?.trim()).filter((item): item is string => Boolean(item)),
  ];
  return [...new Set(values)].join(', ');
}

export function mergeMetadataIntoForm(current: GameFormState, metadata: NormalizedMetadata, guessedTitle: string, mode: MetadataMergeMode = 'fill-empty'): Partial<GameFormState> {
  const shouldUse = (value: string) => mode === 'replace' || !value.trim();
  return {
    title: shouldUse(current.title) ? metadata.title || guessedTitle : current.title,
    originalTitle: shouldUse(current.originalTitle) ? metadata.originalTitle || metadata.title || '' : current.originalTitle,
    aliases: mergeListText(current.aliases, guessedTitle, ...(metadata.aliases ?? [])),
    developer: shouldUse(current.developer) ? metadata.developers[0] || '' : current.developer,
    publisher: shouldUse(current.publisher) ? metadata.publishers[0] || '' : current.publisher,
    releaseDate: shouldUse(current.releaseDate) ? metadata.releaseDate || '' : current.releaseDate,
    description: shouldUse(current.description) ? metadata.description || '' : current.description,
    tags: mode === 'replace' ? mergeListText('', ...(metadata.tags ?? [])) : mergeListText(current.tags, ...(metadata.tags ?? [])),
    genres: mode === 'replace' ? mergeListText('', ...(metadata.genres?.length ? metadata.genres : ['Visual Novel'])) : mergeListText(current.genres, ...(metadata.genres?.length ? metadata.genres : ['Visual Novel'])),
    coverImage: shouldUse(current.coverImage) ? metadata.images[0] || '' : current.coverImage,
    vndbId: shouldUse(current.vndbId) ? metadata.externalIds.vndb || '' : current.vndbId,
    bangumiId: shouldUse(current.bangumiId) ? metadata.externalIds.bangumi || '' : current.bangumiId,
    dlsiteId: shouldUse(current.dlsiteId) ? metadata.externalIds.dlsite || '' : current.dlsiteId,
    fanzaId: shouldUse(current.fanzaId) ? metadata.externalIds.fanza || '' : current.fanzaId,
    ymgalId: shouldUse(current.ymgalId) ? metadata.externalIds.ymgal || '' : current.ymgalId,
  };
}

export function deriveGameFormMetadataBadges(form: Pick<GameFormState, 'developer' | 'releaseDate' | 'vndbId' | 'dlsiteId' | 'fanzaId'>) {
  return [
    form.developer.trim(),
    form.releaseDate.trim(),
    form.vndbId.trim() ? `VNDB ${form.vndbId.trim()}` : '',
    form.dlsiteId.trim() ? `DLsite ${form.dlsiteId.trim()}` : '',
    form.fanzaId.trim() ? `FANZA ${form.fanzaId.trim()}` : '',
  ].filter(Boolean);
}

export function candidateKey(candidate: MetadataSearchResult) {
  return `${candidate.provider}:${candidate.id}`;
}

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

export function providerLabel(value: string) {
  return value === 'vndb' || value === 'dlsite' || value === 'fanza' ? PROVIDER_LABEL[value] : value;
}
