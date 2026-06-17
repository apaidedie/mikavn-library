import type { Game, GameAsset } from '@/types/game';
import { ASSETS_KEY, readJson, writeJson } from './mockStoreStorage';

export function readAssets() {
  return readJson<GameAsset[]>(ASSETS_KEY, []);
}

export function writeAssets(assets: GameAsset[]) {
  writeJson(ASSETS_KEY, assets);
}

export function syncGameCompatibilityAssets(game: Game) {
  const now = new Date().toISOString();
  const existing = readAssets().filter((asset) => asset.gameId !== game.id || asset.source !== 'games');
  const assets: GameAsset[] = [
    ['cover', game.coverImage],
    ['banner', game.bannerImage],
    ['background', game.backgroundImage],
  ].flatMap(([assetType, uri]) => uri ? [{
    id: crypto.randomUUID(),
    gameId: game.id,
    assetType: assetType as string,
    uri: String(uri),
    source: 'games',
    isPrimary: true,
    createdAt: now,
    updatedAt: now,
  }] : []);
  writeAssets([...assets, ...existing]);
}
