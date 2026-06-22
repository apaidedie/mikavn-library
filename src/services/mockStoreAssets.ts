import type { AssetDownloadInput, AssetImportInput, AssetInput, Game, GameAsset, UpdateGameInput } from '@/types/game';
import { ensureGameDefaults } from './mockStoreGames';
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

type MockStoreAssetDependencies = {
  readGames: () => Game[];
  getGame: (id: string) => Promise<Game>;
  updateGame: (id: string, input: UpdateGameInput) => Promise<Game>;
};

function assetField(assetType: string) {
  return assetType === 'cover' ? 'coverImage' : assetType === 'banner' ? 'bannerImage' : assetType === 'background' ? 'backgroundImage' : null;
}

export function createMockStoreAssets({ readGames, getGame, updateGame }: MockStoreAssetDependencies) {
  const upsertGameAsset = (gameId: string, input: AssetInput): Promise<GameAsset> => {
    const uri = input.uri.trim();
    if (!uri) return Promise.reject(new Error('Asset uri is required'));
    const assetType = input.assetType.trim() || 'cover';
    const now = new Date().toISOString();
    const assets = readAssets().filter((asset) => !(asset.gameId === gameId && asset.assetType === assetType && asset.uri === uri));
    const nextAssets = input.isPrimary !== false ? assets.map((asset) => asset.gameId === gameId && asset.assetType === assetType ? { ...asset, isPrimary: false } : asset) : assets;
    const asset: GameAsset = {
      id: crypto.randomUUID(),
      gameId,
      assetType,
      uri,
      source: input.source?.trim() || 'manual',
      isPrimary: input.isPrimary !== false,
      createdAt: now,
      updatedAt: now,
    };
    writeAssets([asset, ...nextAssets]);
    if (asset.isPrimary) {
      const field = assetField(assetType);
      if (field) void updateGame(gameId, { [field]: uri } as UpdateGameInput);
    }
    return Promise.resolve(asset);
  };

  return {
    listGameAssets(gameId: string) {
      const game = readGames().map(ensureGameDefaults).find((item) => item.id === gameId);
      if (game) syncGameCompatibilityAssets(game);
      return Promise.resolve(readAssets().filter((asset) => asset.gameId === gameId).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || b.updatedAt.localeCompare(a.updatedAt)));
    },

    upsertGameAsset,

    removeGameAsset(id: string) {
      const asset = readAssets().find((item) => item.id === id);
      if (!asset) return Promise.reject(new Error('Asset not found'));
      writeAssets(readAssets().filter((item) => item.id !== id));
      const field = assetField(asset.assetType);
      if (field && asset.isPrimary) {
        return updateGame(asset.gameId, { [field]: '' } as UpdateGameInput);
      }
      return getGame(asset.gameId);
    },

    setPrimaryAsset(id: string) {
      const asset = readAssets().find((item) => item.id === id);
      if (!asset) return Promise.reject(new Error('Asset not found'));
      writeAssets(readAssets().map((item) => item.gameId === asset.gameId && item.assetType === asset.assetType ? { ...item, isPrimary: item.id === id, updatedAt: new Date().toISOString() } : item));
      const field = assetField(asset.assetType);
      return field ? updateGame(asset.gameId, { [field]: asset.uri } as UpdateGameInput) : getGame(asset.gameId);
    },

    importGameAssetFromPath(gameId: string, input: AssetImportInput) {
      return upsertGameAsset(gameId, { assetType: input.assetType, uri: input.sourcePath, source: 'user', isPrimary: input.isPrimary });
    },

    downloadGameAsset(gameId: string, input: AssetDownloadInput) {
      return upsertGameAsset(gameId, { assetType: input.assetType, uri: input.url, source: 'download', isPrimary: input.isPrimary });
    },

  };
}
