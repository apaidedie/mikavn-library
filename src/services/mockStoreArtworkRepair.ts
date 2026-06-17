import type { Game } from '@/types/game';
import type { ArtworkRepairDiagnosis, ArtworkRepairOptions, ArtworkRepairPreview, DescriptionImageRepairOptions } from '@/types/metadata';
import { hasMockDescriptionImage } from './mockStoreMetadata';

export function mockDescriptionImageCandidates(games: Game[], options: DescriptionImageRepairOptions = {}) {
  const provider = String(options.provider ?? 'all').toLowerCase();
  const limit = Math.max(1, Math.min(Number(options.limit ?? 20) || 20, 200));
  return games
    .filter((game) => game.description?.trim() && !hasMockDescriptionImage(game.description))
    .flatMap((game) => {
      if ((provider === 'all' || provider === 'dlsite') && game.dlsiteId) {
        return [{ gameId: game.id, title: game.title, provider: 'dlsite', providerId: game.dlsiteId }];
      }
      if ((provider === 'all' || provider === 'fanza') && game.fanzaId) {
        return [{ gameId: game.id, title: game.title, provider: 'fanza', providerId: game.fanzaId }];
      }
      return [];
    })
    .slice(0, limit);
}

function normalizeMockArtworkFields(fields: ArtworkRepairOptions['fields'] = null) {
  const raw = (fields ?? []).map((field) => String(field).trim().toLowerCase()).filter(Boolean);
  if (raw.length === 0 || raw.includes('all')) return ['cover', 'banner', 'background'];
  return [...new Set(raw.filter((field) => field === 'cover' || field === 'banner' || field === 'background'))];
}

function normalizeMockArtworkProviders(providers: ArtworkRepairOptions['providers'] = null) {
  const raw = (providers ?? []).map((provider) => String(provider).trim().toLowerCase()).filter(Boolean);
  if (raw.length === 0 || raw.includes('all')) return ['vndb', 'dlsite', 'fanza'];
  return [...new Set(raw.filter((provider) => provider === 'vndb' || provider === 'dlsite' || provider === 'fanza'))];
}

export function mockArtworkRepairPreview(games: Game[], options: ArtworkRepairOptions = {}): ArtworkRepairPreview {
  const fields = normalizeMockArtworkFields(options.fields);
  const providers = normalizeMockArtworkProviders(options.providers);
  const limit = Math.max(1, Math.min(Number(options.limit ?? 20) || 20, 200));
  const candidates = games.flatMap((game) => {
    const missingFields = fields.filter((field) => {
      if (field === 'cover') return !game.coverImage?.trim();
      if (field === 'banner') return !game.bannerImage?.trim();
      return !game.backgroundImage?.trim();
    });
    if (missingFields.length === 0) return [];
    const refs = providers.flatMap((provider) => {
      const providerId = provider === 'vndb' ? game.vndbId : provider === 'dlsite' ? game.dlsiteId : game.fanzaId;
      return providerId ? [{ provider, providerId }] : [];
    });
    if (refs.length === 0) return [];
    return [{ gameId: game.id, title: game.title, missingFields, providers: refs }];
  });
  return {
    candidates: candidates.slice(0, limit),
    totalCandidates: candidates.length,
    totalMissingFields: candidates.reduce((count, candidate) => count + candidate.missingFields.length, 0),
  };
}

export function mockArtworkRepairDiagnosis(games: Game[], options: ArtworkRepairOptions = {}): ArtworkRepairDiagnosis {
  const fields = normalizeMockArtworkFields(options.fields);
  const providers = normalizeMockArtworkProviders(options.providers);
  const limit = Math.max(1, Math.min(Number(options.limit ?? 50) || 50, 200));
  const missingGames = games.flatMap((game) => {
    const missingFields = fields.filter((field) => {
      if (field === 'cover') return !game.coverImage?.trim();
      if (field === 'banner') return !game.bannerImage?.trim();
      return !game.backgroundImage?.trim();
    });
    if (missingFields.length === 0) return [];
    const refs = providers.flatMap((provider) => {
      const providerId = provider === 'vndb' ? game.vndbId : provider === 'dlsite' ? game.dlsiteId : game.fanzaId;
      return providerId ? [{ provider, providerId }] : [];
    });
    const repairable = refs.length > 0;
    return [{
      gameId: game.id,
      title: game.title,
      missingFields,
      providers: refs,
      providerResults: refs.map((ref) => ({ provider: ref.provider, providerId: ref.providerId, status: 'has_image', reason: null, imageUrl: `mock://metadata/${game.id}/${ref.provider}-artwork.webp` })),
      status: repairable ? 'repairable' : 'missing_external_id',
      reason: repairable ? '找到可用于补全的远程主图' : '没有可用的 VNDB/DLsite/FANZA 外部 ID',
    }];
  });
  const items = missingGames.slice(0, limit);
  return {
    items,
    totalMissingGames: missingGames.length,
    totalMissingFields: missingGames.reduce((count, item) => count + item.missingFields.length, 0),
    diagnosedGames: items.length,
    repairableCount: items.filter((item) => item.status === 'repairable').length,
    missingExternalIdCount: items.filter((item) => item.status === 'missing_external_id').length,
    noRemoteImageCount: items.filter((item) => item.status === 'no_remote_image').length,
    providerErrorCount: items.filter((item) => item.status === 'provider_error').length,
    truncated: missingGames.length > items.length,
  };
}
