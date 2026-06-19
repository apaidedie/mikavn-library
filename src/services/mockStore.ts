import type { AddGameInput, Game, GameFilter, PlayStatus, UpdateGameInput } from '@/types/game';
import type { FieldLock } from '@/types/metadata';
import type { TaskRecord } from '@/types/task';
import { createMockStoreArtworkRepair } from './mockStoreArtworkRepair';
import { createMockStoreAi } from './mockStoreAi';
import { createMockStoreArchives } from './mockStoreArchives';
import { sampleGames } from './mockStoreFixtures';
import { createMockStoreAssets, readAssets, syncGameCompatibilityAssets, writeAssets } from './mockStoreAssets';
import { createMockStoreCollections, readCollectionLinks, writeCollectionLinks } from './mockStoreCollections';
import { createMockStoreDuplicates } from './mockStoreDuplicates';
import { cleanList, ensureGameDefaults, makeGame } from './mockStoreGames';
import { createMockStoreDiagnostics } from './mockStoreDiagnostics';
import { createMockStoreLaunchProfiles } from './mockStoreLaunchProfiles';
import { createMockStoreGamePaths } from './mockStoreGamePaths';
import { createMockStoreMetadataRecords } from './mockStoreMetadataRecords';
import { createMockStoreMetadata, metadataStatusMatches } from './mockStoreMetadata';
import { createMockStorePlaySessions } from './mockStorePlaySessions';
import { createMockStoreReports } from './mockStoreReports';
import { createMockStoreSavedSearches } from './mockStoreSavedSearches';
import { createMockStoreScanner } from './mockStoreScanner';
import { createMockStoreSaves } from './mockStoreSaves';
import { createMockStoreSettings } from './mockStoreSettings';
import { FIELD_LOCKS_KEY, STORAGE_KEY, readJson } from './mockStoreStorage';
import { createMockStoreTags } from './mockStoreTags';
import { createMockStoreTaskQueries } from './mockStoreTasks';

function readGames() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleGames));
    return sampleGames;
  }

  try {
    return JSON.parse(raw) as Game[];
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleGames));
    return sampleGames;
  }
}

function writeGames(games: Game[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
}

function getMockGame(id: string) {
  const game = readGames().map(ensureGameDefaults).find((item) => item.id === id);
  return game ? Promise.resolve(game) : Promise.reject(new Error('Game not found'));
}

function addMockGame(input: AddGameInput): Promise<Game> {
  const games = readGames();
  const game = makeGame(input);
  writeGames([game, ...games]);
  syncGameCompatibilityAssets(game);
  return Promise.resolve(game);
}

function updateMockGame(id: string, input: UpdateGameInput): Promise<Game> {
  const games = readGames();
  let updated: Game | undefined;
  const next = games.map((game) => {
    if (game.id !== id) {
      return game;
    }

    updated = {
      ...game,
      ...input,
      aliases: input.aliases ? cleanList(input.aliases) : game.aliases,
      tags: input.tags ? cleanList(input.tags) : game.tags,
      genres: input.genres ? cleanList(input.genres) : game.genres,
      favorite: input.favorite ?? game.favorite,
      hidden: input.hidden ?? game.hidden,
      playStatus: (input.playStatus ?? game.playStatus) as PlayStatus,
      updatedAt: new Date().toISOString(),
    };
    return updated;
  });

  if (!updated) {
    return Promise.reject(new Error('Game not found'));
  }

  writeGames(next);
  syncGameCompatibilityAssets(updated);
  return Promise.resolve(updated);
}

const mockLaunchProfiles = createMockStoreLaunchProfiles(readGames);
const mockMetadataRecords = createMockStoreMetadataRecords(getMockGame);

export const mockStore = {
  ...createMockStoreDiagnostics(readGames),
  ...createMockStoreArchives({ readGames, writeGames }),
  ...createMockStoreSaves(readGames),
  ...createMockStoreCollections(readGames),
  ...createMockStoreTags(readGames, writeGames),
  ...createMockStoreAssets({ readGames, getGame: getMockGame, updateGame: updateMockGame }),
  ...createMockStoreSettings(),
  ...createMockStoreTaskQueries(),
  ...createMockStoreGamePaths({ getGame: getMockGame, updateGame: updateMockGame }),
  ...createMockStoreReports(readGames),
  ...createMockStoreSavedSearches(),
  ...createMockStoreAi(),
  ...createMockStoreArtworkRepair({ readGames, writeGames }),
  ...createMockStoreDuplicates({
    readGames,
    writeGames,
    readCollectionLinks,
    writeCollectionLinks,
    readAssets,
    writeAssets,
    syncGameCompatibilityAssets,
    readFieldLocks: () => readJson<Record<string, FieldLock[]>>(FIELD_LOCKS_KEY, {}),
  }),
  ...mockMetadataRecords,
  ...createMockStoreMetadata({
    readGames,
    getGame: getMockGame,
    updateGame: updateMockGame,
    listFieldLocks: mockMetadataRecords.listFieldLocks,
  }),
  ...mockLaunchProfiles,
  ...createMockStorePlaySessions({ readGames, writeGames, listLaunchProfiles: mockLaunchProfiles.listLaunchProfiles }),
  ...createMockStoreScanner({ readGames, addGame: addMockGame, updateGame: updateMockGame }),

  listGames(filter: GameFilter = {}) {
    const query = filter.query?.trim().toLocaleLowerCase() ?? '';
    const status = filter.status;
    const tag = filter.tag?.trim().toLocaleLowerCase();
    const developer = filter.developer?.trim().toLocaleLowerCase();
    const collectionGameIds = filter.collectionId ? new Set(readCollectionLinks().filter((link) => link.collectionId === filter.collectionId).map((link) => link.gameId)) : null;
    const sortBy = filter.sortBy ?? 'updated_at';
    const sortDirection = filter.sortDirection ?? 'desc';

    const games = readGames()
      .map(ensureGameDefaults)
      .filter((game) => {
        const text = [game.title, game.originalTitle, game.developer, game.brand, ...game.aliases, ...game.tags]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase();

        const matchesQuery = !query || text.includes(query);
        const matchesStatus = !status || status === 'all' || game.playStatus === status;
        const matchesTag = !tag || [...game.tags, ...game.genres].some((item) => item.toLocaleLowerCase() === tag);
        const matchesDeveloper = !developer || [game.developer, game.brand, game.publisher].some((item) => item?.toLocaleLowerCase() === developer);
        const matchesFavorite = filter.favorite == null || game.favorite === filter.favorite;
        const matchesHidden = filter.hidden == null || game.hidden === filter.hidden;
        const matchesMetadata = metadataStatusMatches(game, filter.metadataStatus);
        const matchesPathStatus = !filter.pathStatus || filter.pathStatus === 'all' || game.pathStatus === filter.pathStatus;
        const matchesCollection = !collectionGameIds || collectionGameIds.has(game.id);
        return matchesQuery && matchesStatus && matchesTag && matchesDeveloper && matchesFavorite && matchesHidden && matchesMetadata && matchesPathStatus && matchesCollection;
      })
      .sort((a, b) => {
        const pick = (game: Game) => {
          switch (sortBy) {
            case 'title':
              return game.title;
            case 'created_at':
              return game.createdAt;
            case 'last_played_at':
              return game.lastPlayedAt ?? '';
            case 'release_date':
              return game.releaseDate ?? '';
            case 'rating':
              return game.rating ?? -1;
            case 'updated_at':
            default:
              return game.updatedAt;
          }
        };

        const left = pick(a);
        const right = pick(b);
        const result = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right), 'zh-CN');
        return sortDirection === 'asc' ? result : -result;
      });

    return Promise.resolve(games);
  },

  getGame: getMockGame,

  addGame: addMockGame,

  updateGame: updateMockGame,

  deleteGameRecord(id: string) {
    writeGames(readGames().filter((game) => game.id !== id));
    writeCollectionLinks(readCollectionLinks().filter((link) => link.gameId !== id));
    return Promise.resolve();
  },

  async retryTask(id: string): Promise<TaskRecord> {
    const task = await this.getTask(id);
    if (!task.retryable || !task.retryPayload) return Promise.reject(new Error('Task is not retryable'));
    if (task.status !== 'failed' && task.status !== 'cancelled') return Promise.reject(new Error('Only failed or cancelled tasks can be retried'));
    const payload = JSON.parse(task.retryPayload) as Record<string, unknown>;
    if (task.taskType === 'library.scan') return this.startScanTask(String(payload.path ?? ''), Boolean(payload.recursive));
    if (task.taskType === 'database.backup') return this.backupDatabase(String(payload.path ?? ''));
    if (task.taskType === 'library.archive_export') return this.exportLibraryArchive({
      targetDir: String(payload.targetDir ?? ''),
      includeImages: Boolean(payload.includeImages),
      includeSaveBackups: Boolean(payload.includeSaveBackups),
    });
    if (task.taskType === 'library.archive_export_zip') return this.exportLibraryArchiveZip({
      targetDir: String(payload.targetDir ?? ''),
      includeImages: Boolean(payload.includeImages),
      includeSaveBackups: Boolean(payload.includeSaveBackups),
    });
    if (task.taskType === 'library.archive_import') return this.importLibraryArchive({
      archiveDir: String(payload.archiveDir ?? ''),
      includeImages: Boolean(payload.includeImages),
      includeSaveBackups: Boolean(payload.includeSaveBackups),
    });
    if (task.taskType === 'library.archive_restore') return this.restoreLibraryArchive({
      archiveDir: String(payload.archiveDir ?? ''),
      restoreImages: Boolean(payload.restoreImages),
      restoreSaveBackups: Boolean(payload.restoreSaveBackups),
    });
    if (task.taskType === 'save.backup') return this.createSaveBackupTask(String(payload.savePathId ?? ''), String(payload.label ?? ''));
    if (task.taskType === 'save.restore') return this.restoreSaveBackupTask(String(payload.backupId ?? ''), payload.mode === 'mirror' ? 'mirror' : 'merge');
    if (task.taskType === 'game.path_check') return this.checkGamePathsTask(String(payload.gameId ?? ''));
    if (task.taskType === 'metadata.batch_match') return this.batchMatchMetadata(Array.isArray(payload.gameIds) ? payload.gameIds.map(String) : []).then(({ taskId }) => this.getTask(String(taskId)));
    if (task.taskType === 'metadata.description_image_repair') return this.repairDescriptionImages({
      provider: String(payload.provider ?? 'all'),
      limit: Number(payload.limit ?? 20),
      maxImages: Number(payload.maxImages ?? payload.max_images ?? 3),
      retryAttempted: true,
    });
    if (task.taskType === 'metadata.artwork_repair') return this.repairArtwork({
      providers: Array.isArray(payload.providers) ? payload.providers.map(String) : ['all'],
      fields: Array.isArray(payload.fields) ? payload.fields.map(String) : ['cover', 'banner', 'background'],
      limit: Number(payload.limit ?? 20),
      retryAttempted: true,
    });
    if (task.taskType === 'metadata.duplicate_id_audit') return this.auditDuplicateExternalIds({
      providers: Array.isArray(payload.providers) ? payload.providers.map(String) : ['all'],
      limit: Number(payload.limit ?? 50),
      retryAttempted: true,
    });
    return Promise.reject(new Error('This task type does not support retry'));
  },

};
