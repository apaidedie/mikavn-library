import type { AddGameInput, Game } from '@/types/game';
import { sampleHeroUrl } from './mockStoreFixtures';

export function cleanList(values?: string[]) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

export function makeGame(input: AddGameInput): Game {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    originalTitle: input.originalTitle?.trim() || null,
    aliases: cleanList(input.aliases),
    developer: input.developer?.trim() || null,
    publisher: input.publisher?.trim() || null,
    brand: input.brand?.trim() || null,
    releaseDate: input.releaseDate?.trim() || null,
    description: input.description?.trim() || null,
    notes: input.notes?.trim() || null,
    tags: cleanList(input.tags),
    genres: cleanList(input.genres),
    rating: input.rating ?? null,
    ageRating: input.ageRating?.trim() || null,
    playStatus: input.playStatus ?? 'planned',
    favorite: Boolean(input.favorite),
    hidden: Boolean(input.hidden),
    installPath: input.installPath.trim(),
    executablePath: input.executablePath?.trim() || null,
    workingDirectory: input.workingDirectory?.trim() || input.installPath.trim(),
    launchArgs: input.launchArgs?.trim() || null,
    pathStatus: 'unknown',
    lastPathCheckedAt: null,
    coverImage: input.coverImage?.trim() || null,
    bannerImage: input.bannerImage?.trim() || null,
    backgroundImage: input.backgroundImage?.trim() || null,
    vndbId: input.vndbId?.trim() || null,
    bangumiId: input.bangumiId?.trim() || null,
    dlsiteId: input.dlsiteId?.trim() || null,
    fanzaId: input.fanzaId?.trim() || null,
    ymgalId: input.ymgalId?.trim() || null,
    totalPlaySeconds: 0,
    lastPlayedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function ensureGameDefaults(game: Game): Game {
  const sampleMedia = game.id === 'sample-1' ? sampleHeroUrl : null;
  return {
    ...game,
    notes: game.notes ?? null,
    pathStatus: game.pathStatus ?? 'unknown',
    lastPathCheckedAt: game.lastPathCheckedAt ?? null,
    coverImage: game.coverImage ?? sampleMedia,
    bannerImage: game.bannerImage ?? sampleMedia,
    backgroundImage: game.backgroundImage ?? sampleMedia,
  };
}
