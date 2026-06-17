import type { Game } from '@/types/game';
import type { SearchClause } from '@/types/metadata';

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
  if (status === 'needs_metadata') return !complete;
  return true;
}
