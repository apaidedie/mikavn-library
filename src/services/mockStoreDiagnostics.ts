import type { AppDataDiagnostics, DatabaseBackupCleanupPolicy, DatabaseBackupCleanupReport, DiagnosticExportReport, ImageHealthReport, ImageHealthReportOptions, ImageQuarantineReport, ImageReferenceAudit, ImageReferenceAuditOptions, LogRecord, LogRetentionPolicy, TrayStatus } from '@/types/archive';
import type { Game } from '@/types/game';
import type { SaveBackup } from '@/types/saves';
import { sampleHeroUrl } from './mockStoreFixtures';
import { readAssets } from './mockStoreAssets';
import { mockImageReferenceAudit } from './mockStoreImages';
import { externalIdCount, hasCompleteMetadata, hasMockDescriptionImage } from './mockStoreMetadata';
import { mockDuplicateExternalIdPreview } from './mockStoreDuplicates';
import { ensureGameDefaults } from './mockStoreGames';
import { SAVE_BACKUPS_KEY, readJson, readSettings } from './mockStoreStorage';
import { readTasks } from './mockStoreTasks';

const MOCK_APP_DATA_DIR = 'E:\\MikaVN Library\\app-data';
const MOCK_IMAGE_DIR = `${MOCK_APP_DATA_DIR}\\images`;

function mockAppDataPath(...parts: string[]) {
  return [MOCK_APP_DATA_DIR, ...parts].join('\\');
}

export function createMockStoreDiagnostics(readGames: () => Game[]) {
  return {
    getAppDataDiagnostics(): Promise<AppDataDiagnostics> {
      const games = readGames().map(ensureGameDefaults);
      const assets = readAssets();
      const imageRefs = games.flatMap((game) => [game.coverImage, game.bannerImage, game.backgroundImage]).filter(Boolean).length + assets.length;
      const externalIdLinkedCount = games.filter((game) => externalIdCount(game) > 0).length;
      const descriptionImageGames = games.filter((game) => hasMockDescriptionImage(game.description)).length;
      const providerGames = games.filter((game) => game.dlsiteId || game.fanzaId);
      const duplicateExternalIds = mockDuplicateExternalIdPreview(games);
      return Promise.resolve({
        appDataDir: MOCK_APP_DATA_DIR,
        dataDirSource: 'mock',
        database: {
          path: mockAppDataPath('mikavn.db'),
          exists: true,
          sizeBytes: 12 * 1024 * 1024,
          userVersion: 13,
          quickCheck: 'ok',
          quickCheckOk: true,
          foreignKeyIssues: 0,
          gameCount: games.length,
          assetCount: assets.length,
          imageRefsCount: imageRefs,
          localImageRefsCount: imageRefs,
          missingImageRefsCount: 0,
          cDriveImageRefsCount: 0,
          playniteImageRefsCount: 0,
          metadataCoverage: {
            completeGameCount: games.filter(hasCompleteMetadata).length,
            needsMetadataCount: games.filter((game) => !hasCompleteMetadata(game)).length,
            missingCoverCount: games.filter((game) => !game.coverImage).length,
            missingBannerCount: games.filter((game) => !game.bannerImage).length,
            missingBackgroundCount: games.filter((game) => !game.backgroundImage).length,
            missingDescriptionCount: games.filter((game) => !game.description?.trim()).length,
            missingExternalIdCount: games.length - externalIdLinkedCount,
            providerLinkedGameCount: externalIdLinkedCount,
            vndbGameCount: games.filter((game) => game.vndbId).length,
            dlsiteGameCount: games.filter((game) => game.dlsiteId).length,
            fanzaGameCount: games.filter((game) => game.fanzaId).length,
          },
          descriptionImages: {
            providerGamesCount: providerGames.length,
            providerGamesWithImagesCount: providerGames.filter((game) => hasMockDescriptionImage(game.description)).length,
            providerGamesWithoutImagesCount: providerGames.filter((game) => game.description?.trim() && !hasMockDescriptionImage(game.description)).length,
            providerGamesEmptyDescriptionCount: providerGames.filter((game) => !game.description?.trim()).length,
            allGamesWithImagesCount: descriptionImageGames,
            imageRefsCount: descriptionImageGames,
            localImageRefsCount: 0,
            missingLocalImageRefsCount: 0,
          },
          externalIds: {
            totalExternalIdCount: games.reduce((count, game) => count + externalIdCount(game), 0),
            vndbIdCount: games.filter((game) => game.vndbId).length,
            dlsiteIdCount: games.filter((game) => game.dlsiteId).length,
            fanzaIdCount: games.filter((game) => game.fanzaId).length,
            duplicateExternalIdGroupsCount: duplicateExternalIds.totalGroups,
            duplicateExternalIdGamesCount: duplicateExternalIds.totalGames,
            duplicateVndbIdGroupsCount: mockDuplicateExternalIdPreview(games, { providers: ['vndb'] }).totalGroups,
            duplicateDlsiteIdGroupsCount: mockDuplicateExternalIdPreview(games, { providers: ['dlsite'] }).totalGroups,
            duplicateFanzaIdGroupsCount: mockDuplicateExternalIdPreview(games, { providers: ['fanza'] }).totalGroups,
          },
          pathStatus: {
            okCount: games.filter((game) => game.pathStatus === 'ok').length,
            brokenCount: games.filter((game) => game.pathStatus === 'broken').length,
            incompleteCount: games.filter((game) => game.pathStatus === 'incomplete').length,
            uncheckedCount: games.filter((game) => !game.pathStatus || game.pathStatus === 'unknown').length,
          },
        },
        images: { path: MOCK_IMAGE_DIR, exists: true, fileCount: Math.max(assets.length, 1), totalBytes: Math.max(assets.length, 1) * 96 * 1024 },
        cache: { path: mockAppDataPath('cache'), exists: true, fileCount: 0, totalBytes: 0 },
        logs: { path: mockAppDataPath('logs'), exists: true, fileCount: readTasks().length, totalBytes: readTasks().length * 512 },
        saveBackups: { path: mockAppDataPath('save-backups'), exists: true, fileCount: readJson<SaveBackup[]>(SAVE_BACKUPS_KEY, []).length, totalBytes: readJson<SaveBackup[]>(SAVE_BACKUPS_KEY, []).length * 2048 },
        databaseBackups: {
          rootPath: MOCK_APP_DATA_DIR,
          fileCount: 2,
          totalBytes: 24 * 1024 * 1024,
          files: [
            { fileName: 'mikavn.before-playnite-import-20260603-120000.db', path: mockAppDataPath('mikavn.before-playnite-import-20260603-120000.db'), sizeBytes: 12 * 1024 * 1024, modifiedAt: new Date().toISOString() },
            { fileName: 'before-restore-20260603-130000.db', path: mockAppDataPath('database-restore-protection', 'before-restore-20260603-130000.db'), sizeBytes: 12 * 1024 * 1024, modifiedAt: new Date(Date.now() - 86400000).toISOString() },
          ],
        },
        warnings: [],
      });
    },

    auditImageReferences(options: ImageReferenceAuditOptions = {}): Promise<ImageReferenceAudit> {
      return Promise.resolve(mockImageReferenceAudit(options, {
        assets: readAssets(),
        games: readGames().map(ensureGameDefaults),
        imageDir: MOCK_IMAGE_DIR,
        sampleHeroUrl,
      }));
    },

    getImageHealthReport(_options: ImageHealthReportOptions = {}): Promise<ImageHealthReport> {
      const games = readGames().map(ensureGameDefaults);
      const assets = readAssets();
      const missingCoverGames = games.filter((game) => !game.coverImage?.trim()).length;
      const missingArtworkGames = games.filter((game) => !game.coverImage?.trim() || !game.bannerImage?.trim() || !game.backgroundImage?.trim()).length;
      const imageRefs = games.flatMap((game) => [game.coverImage, game.bannerImage, game.backgroundImage]).filter(Boolean).length + assets.length;
      return Promise.resolve({
        generatedAt: new Date().toISOString(),
        summary: {
          totalImageRefs: imageRefs,
          issueImageRefs: 2,
          missingLocalRefs: 1,
          cDriveRefs: 0,
          playniteRefs: 1,
          legacyAppDataImportRefs: 1,
          externalLegacyRefs: 0,
          imageFiles: Math.max(assets.length, 3),
          orphanFiles: 1,
          duplicateFileNameGroups: 1,
          oversizedFiles: 1,
          missingCoverGames,
          missingArtworkGames,
        },
        cache: {
          rootPath: MOCK_IMAGE_DIR,
          fileCount: Math.max(assets.length, 3),
          totalBytes: 8 * 1024 * 1024,
          referencedFileCount: Math.max(assets.length, 2),
          orphanFileCount: 1,
          orphanBytes: 128 * 1024,
          duplicateFileNameGroups: 1,
          oversizedFileCount: 1,
          oversizedBytes: 7 * 1024 * 1024,
          orphanSamples: [{ path: `${MOCK_IMAGE_DIR}\\old.jpg`, relativePath: 'old.jpg', sizeBytes: 128 * 1024 }],
          duplicateNameSamples: [{ fileName: 'cover.jpg', count: 2, samples: ['a\\cover.jpg', 'b\\cover.jpg'] }],
          oversizedSamples: [{ path: `${MOCK_IMAGE_DIR}\\large.jpg`, relativePath: 'large.jpg', sizeBytes: 7 * 1024 * 1024 }],
        },
        recommendations: ['先预览孤儿图片隔离；隔离不会永久删除文件。'],
      });
    },

    quarantineOrphanImages(_options: ImageHealthReportOptions = {}): Promise<ImageQuarantineReport> {
      return Promise.resolve({
        quarantineDir: mockAppDataPath('image-quarantine', 'preview'),
        manifestPath: mockAppDataPath('image-quarantine', 'preview', 'manifest.json'),
        movedFiles: 1,
        movedBytes: 128 * 1024,
        skippedFiles: 0,
        skipped: [],
      });
    },

    cleanupOldDatabaseBackups(policy: DatabaseBackupCleanupPolicy = {}): Promise<DatabaseBackupCleanupReport> {
      const retainCount = policy.retainCount ?? 10;
      const retainDays = policy.retainDays ?? 30;
      return Promise.resolve({
        scannedFiles: 2,
        removedFiles: 0,
        keptFiles: 2,
        removedBytes: 0,
        keptBytes: 24 * 1024 * 1024,
        retainCount,
        retainDays,
        removed: [],
      });
    },

    exportDiagnosticPackage(): Promise<DiagnosticExportReport> {
      return Promise.resolve({
        path: mockAppDataPath('diagnostic-exports', 'mikavn-diagnostics-mock.zip'),
        fileName: 'mikavn-diagnostics-mock.zip',
        sizeBytes: 32 * 1024,
        createdAt: new Date().toISOString(),
        includedFiles: ['manifest.json', 'diagnostics.json', 'summary.md', 'logs-preview.json', 'environment.json'],
        warnings: [],
      });
    },

    listDiagnosticLogs(limit = 30): Promise<LogRecord[]> {
      const tasks = readTasks().slice(0, limit);
      return Promise.resolve(tasks.map((task, index) => ({
        fileName: `mock-${index + 1}.log`,
        path: `localStorage://task/${task.id}`,
        sizeBytes: 256 + index * 24,
        modifiedAt: task.updatedAt,
        preview: [`${task.updatedAt} [INFO] ${task.taskType}: ${task.message ?? 'mock log'}`],
      })));
    },

    getLogRetention(): Promise<LogRetentionPolicy> {
      return Promise.resolve({ retainDays: 30, maxFiles: 60 });
    },

    pruneDiagnosticLogs(_policy: LogRetentionPolicy): Promise<number> {
      return Promise.resolve(0);
    },

    getTrayStatus(): Promise<TrayStatus> {
      const enabled = readSettings().tray_enabled !== 'false';
      return Promise.resolve({
        enabled,
        tooltip: 'MikaVN Library',
        closeBehavior: enabled ? 'hide_to_tray' : 'close',
        menuItems: enabled ? [
          { id: 'tray-open', label: '打开 MikaVN' },
          { id: 'tray-hide', label: '隐藏到托盘' },
          { id: 'tray-exit', label: '退出' },
        ] : [],
      });
    },
  };
}
