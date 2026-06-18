import type { Game } from '@/types/game';
import type { ArtworkRepairDiagnosis, ArtworkRepairOptions, ArtworkRepairPreview, DescriptionImageRepairOptions, DescriptionImageRepairPreview } from '@/types/metadata';
import type { TaskRecord } from '@/types/task';
import { sampleHeroUrl } from './mockStoreFixtures';
import { ensureGameDefaults } from './mockStoreGames';
import { hasMockDescriptionImage } from './mockStoreMetadata';
import { addTaskLog, makeTask } from './mockStoreTasks';

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

type MockStoreArtworkRepairDependencies = {
  readGames: () => Game[];
  writeGames: (games: Game[]) => void;
};

export function createMockStoreArtworkRepair({ readGames, writeGames }: MockStoreArtworkRepairDependencies) {
  return {
    previewDescriptionImageRepair(options: DescriptionImageRepairOptions = {}): Promise<DescriptionImageRepairPreview> {
      const candidates = mockDescriptionImageCandidates(readGames().map(ensureGameDefaults), options);
      return Promise.resolve({ candidates, totalCandidates: candidates.length });
    },

    async repairDescriptionImages(options: DescriptionImageRepairOptions = {}): Promise<TaskRecord> {
      const games = readGames().map(ensureGameDefaults);
      const candidates = mockDescriptionImageCandidates(games, options);
      if (candidates.length === 0) return Promise.reject(new Error('no description image repair candidates'));
      const updatedIds = new Set(candidates.map((candidate) => candidate.gameId));
      writeGames(games.map((game) => updatedIds.has(game.id) ? {
        ...game,
        description: `${game.description?.trim() ?? ''}\n\n![简介图片](${sampleHeroUrl})`,
        updatedAt: new Date().toISOString(),
      } : game));
      const task = makeTask({
        taskType: 'metadata.description_image_repair',
        status: 'completed',
        progress: 1,
        message: `浏览器预览已修复 ${candidates.length} 个条目的简介图片`,
        retryPayload: JSON.stringify({ provider: options.provider ?? 'all', limit: options.limit ?? 20, maxImages: options.maxImages ?? 3, retryAttempted: Boolean(options.retryAttempted) }),
        retryable: true,
      });
      addTaskLog(task.id, 'info', `简介图片修复候选：${candidates.map((candidate) => `${candidate.provider}:${candidate.providerId}`).join(', ')}`);
      return task;
    },

    previewArtworkRepair(options: ArtworkRepairOptions = {}): Promise<ArtworkRepairPreview> {
      return Promise.resolve(mockArtworkRepairPreview(readGames().map(ensureGameDefaults), options));
    },

    diagnoseArtworkRepair(options: ArtworkRepairOptions = {}): Promise<ArtworkRepairDiagnosis> {
      return Promise.resolve(mockArtworkRepairDiagnosis(readGames().map(ensureGameDefaults), options));
    },

    repairArtwork(options: ArtworkRepairOptions = {}): Promise<TaskRecord> {
      const games = readGames().map(ensureGameDefaults);
      const preview = mockArtworkRepairPreview(games, options);
      if (preview.totalCandidates === 0) return Promise.reject(new Error('no artwork repair candidates'));
      const updatedIds = new Map(preview.candidates.map((candidate) => [candidate.gameId, candidate.missingFields]));
      writeGames(games.map((game) => {
        const fields = updatedIds.get(game.id);
        if (!fields) return game;
        return {
          ...game,
          coverImage: fields.includes('cover') ? sampleHeroUrl : game.coverImage,
          bannerImage: fields.includes('banner') ? sampleHeroUrl : game.bannerImage,
          backgroundImage: fields.includes('background') ? sampleHeroUrl : game.backgroundImage,
          updatedAt: new Date().toISOString(),
        };
      }));
      const task = makeTask({
        taskType: 'metadata.artwork_repair',
        status: 'completed',
        progress: 1,
        message: `浏览器预览已补全 ${preview.totalCandidates} 个条目的媒体图片`,
        retryPayload: JSON.stringify({ providers: options.providers ?? ['all'], fields: options.fields ?? ['cover', 'banner', 'background'], limit: options.limit ?? 20, retryAttempted: Boolean(options.retryAttempted) }),
        retryable: true,
      });
      for (const candidate of preview.candidates) {
        addTaskLog(task.id, 'info', `已补全：${candidate.title} [${candidate.gameId}]，字段 ${candidate.missingFields.join('/')}`);
      }
      return Promise.resolve(task);
    },
  };
}
