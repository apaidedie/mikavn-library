const now = new Date().toISOString();
const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
const hero = '/src/assets/hero.png';
const richDescription = `末世旅途题材的短篇视觉小说。这里用于成熟 V1 页面 QA。\n\n![作品介绍图](${hero})\n\n图片下方的正文也应该继续显示。`;
const games = [
  {
    id: 'qa-1', title: '星之终途', originalTitle: '終のステラ', aliases: ['[汉化硬盘版] 星之终途 v1.02'], developer: 'Key', publisher: 'Visual Arts', brand: 'Key', releaseDate: '2022-09-30', description: richDescription, notes: '攻略进度：已通关第一章。', tags: ['全年龄', '科幻', '短篇'], genres: ['Visual Novel'], rating: 88, ageRating: '全年龄', playStatus: 'playing', favorite: true, hidden: false, installPath: 'D:\\Games\\VN\\星之终途', executablePath: 'D:\\Games\\VN\\星之终途\\stella.exe', workingDirectory: 'D:\\Games\\VN\\星之终途', launchArgs: null, pathStatus: 'unknown', lastPathCheckedAt: null, coverImage: hero, bannerImage: hero, backgroundImage: hero, vndbId: 'v29443', bangumiId: null, dlsiteId: 'RJ01000000', fanzaId: null, ymgalId: null, totalPlaySeconds: 12600, lastPlayedAt: now, createdAt: now, updatedAt: now,
  },
  {
    id: 'qa-2', title: '天使☆騒々 RE-BOOT!', originalTitle: null, aliases: ['天使騒々'], developer: 'Yuzusoft', publisher: null, brand: 'ゆずソフト', releaseDate: '2023-04-28', description: '路径异常样例，用于检查 warning 和修复入口。', notes: '', tags: ['恋爱', '校园'], genres: ['Visual Novel'], rating: 82, ageRating: 'R18', playStatus: 'planned', favorite: false, hidden: false, installPath: 'D:\\Games\\VN\\天使騒々', executablePath: 'D:\\Games\\VN\\天使騒々\\game.exe', workingDirectory: 'D:\\Games\\VN\\天使騒々', launchArgs: null, pathStatus: 'broken', lastPathCheckedAt: now, coverImage: null, bannerImage: null, backgroundImage: null, vndbId: null, bangumiId: null, dlsiteId: null, fanzaId: null, ymgalId: null, totalPlaySeconds: 0, lastPlayedAt: null, createdAt: now, updatedAt: now,
  },
];
const descriptionRepairGame = {
  ...games[1],
  id: 'qa-description-repair',
  title: '简介图片修复候选',
  originalTitle: '紹介画像修復候補',
  aliases: [],
  description: 'DLsite 来源条目，当前简介里没有图片，用于维护中心修复入口 QA。',
  dlsiteId: 'RJ01000001',
  fanzaId: null,
  installPath: 'D:\\Games\\VN\\简介图片修复候选',
  executablePath: 'D:\\Games\\VN\\简介图片修复候选\\game.exe',
  workingDirectory: 'D:\\Games\\VN\\简介图片修复候选',
};
const fanzaDescriptionRepairGame = {
  ...descriptionRepairGame,
  id: 'qa-description-repair-fanza',
  title: 'FANZA 简介图修复候选',
  originalTitle: 'FANZA 紹介画像修復候補',
  description: `FANZA 来源条目，已有简介图片，用于结果筛选 QA。\n\n![简介图片](${hero})`,
  dlsiteId: null,
  fanzaId: 'd_123456',
  installPath: 'D:\\Games\\VN\\FANZA简介图修复候选',
  executablePath: 'D:\\Games\\VN\\FANZA简介图修复候选\\game.exe',
  workingDirectory: 'D:\\Games\\VN\\FANZA简介图修复候选',
};
const duplicateExternalIdGame = {
  ...games[1],
  id: 'qa-duplicate-id',
  title: '星之终途 重复记录',
  originalTitle: '終のステラ duplicate',
  aliases: [],
  description: '重复外部 ID 审查候选。',
  vndbId: 'v29443',
  dlsiteId: null,
  fanzaId: null,
  installPath: 'D:\\Games\\VN\\星之终途-重复记录',
  executablePath: 'D:\\Games\\VN\\星之终途-重复记录\\stella.exe',
  workingDirectory: 'D:\\Games\\VN\\星之终途-重复记录',
};
const duplicateAuditGames = [
  { ...games[0], bangumiId: 'bgm-29443' },
  games[1],
  { ...duplicateExternalIdGame, bangumiId: 'bgm-29443' },
];
const secondaryExternalIdCompleteGame = {
  ...games[1],
  id: 'qa-secondary-id-complete',
  title: '二级 ID 完整条目',
  originalTitle: 'Secondary ID Complete',
  developer: 'Secondary Provider Studio',
  brand: 'Secondary Provider Studio',
  releaseDate: '2024-01-26',
  description: '只有 Bangumi 外部 ID，但基础元数据齐全。',
  coverImage: hero,
  bannerImage: hero,
  backgroundImage: hero,
  vndbId: null,
  bangumiId: 'bgm-secondary-complete',
  dlsiteId: null,
  fanzaId: null,
  ymgalId: null,
  pathStatus: 'ok',
};
const artworkRepairGame = {
  ...games[1],
  id: 'qa-artwork-repair',
  title: '媒体图片补全候选',
  originalTitle: 'Artwork Repair Candidate',
  aliases: [],
  description: '已有 VNDB ID，但缺封面和背景，用于维护中心补图入口 QA。',
  vndbId: 'v29443',
  dlsiteId: null,
  fanzaId: null,
  coverImage: null,
  backgroundImage: null,
  installPath: 'D:\\Games\\VN\\媒体图片补全候选',
  executablePath: 'D:\\Games\\VN\\媒体图片补全候选\\game.exe',
  workingDirectory: 'D:\\Games\\VN\\媒体图片补全候选',
};
const brokenMediaReferenceGame = {
  ...games[0],
  id: 'qa-broken-media-ref',
  title: '图片引用异常候选',
  originalTitle: 'Image Reference Audit Candidate',
  description: '用于详情页图片引用审计 QA。\n\n![坏简介图](missing-description.jpg)',
  bannerImage: hero,
  installPath: 'D:\\Games\\VN\\图片引用异常候选',
  executablePath: 'D:\\Games\\VN\\图片引用异常候选\\game.exe',
  workingDirectory: 'D:\\Games\\VN\\图片引用异常候选',
};
const brokenMediaReferenceAsset = { id: 'qa-broken-media-asset', gameId: 'qa-broken-media-ref', assetType: 'audit_only', uri: 'D:\\Playnite\\library\\files\\missing-banner.jpg', source: 'mock', isPrimary: false, createdAt: now, updatedAt: now };
const tasks = [
  { id: 'qa-task-failed', taskType: 'library.scan', status: 'failed', progress: 1, message: '扫描失败：路径不存在', error: 'PATH_NOT_FOUND: D:\\Missing', retryPayload: JSON.stringify({ path: 'D:\\Missing', recursive: true }), retryable: true, createdAt: now, updatedAt: now },
  { id: 'qa-task-running', taskType: 'metadata.batch_match', status: 'running', progress: 0.42, message: '正在匹配 2 个游戏', error: null, retryPayload: JSON.stringify({ gameIds: ['qa-1', 'qa-2'] }), retryable: true, createdAt: tenMinutesAgo, updatedAt: now },
  { id: 'qa-task-maintenance-failed', taskType: 'metadata.artwork_repair', status: 'failed', progress: 1, message: '媒体补图失败：来源无响应', error: 'PROVIDER_TIMEOUT: VNDB', retryPayload: JSON.stringify({ providers: ['all'], fields: ['cover', 'banner', 'background'], limit: 20 }), retryable: true, createdAt: tenMinutesAgo, updatedAt: now },
];
const descriptionImageRepairFailedTask = {
  id: 'qa-task-description-image-failed', taskType: 'metadata.description_image_repair', status: 'failed', progress: 1, message: '简介图片修复失败：DLsite 暂不可用', error: 'PROVIDER_TIMEOUT: DLsite', retryPayload: JSON.stringify({ provider: 'all', limit: 20, maxImages: 3 }), retryable: true, createdAt: tenMinutesAgo, updatedAt: now,
};
const fanzaDescriptionImageRepairTask = {
  id: 'qa-task-description-image-fanza', taskType: 'metadata.description_image_repair', status: 'completed', progress: 1, message: '简介图片修复完成：更新 1 个条目，插入 1 张图片，跳过 0 个，失败 0 个。', error: null, retryPayload: JSON.stringify({ provider: 'fanza', limit: 20, maxImages: 3 }), retryable: true, createdAt: tenMinutesAgo, updatedAt: now,
};
const taskLogs = {
  'qa-task-failed': [
    { id: 'log-1', taskId: 'qa-task-failed', level: 'info', message: '开始扫描 D:\\Missing', createdAt: now },
    { id: 'log-2', taskId: 'qa-task-failed', level: 'error', message: '路径不存在，等待用户重试。', createdAt: now },
  ],
  'qa-task-running': [{ id: 'log-3', taskId: 'qa-task-running', level: 'info', message: 'VNDB 查询完成。', createdAt: now }],
  'qa-task-maintenance-failed': [{ id: 'log-4', taskId: 'qa-task-maintenance-failed', level: 'error', message: '媒体补图失败：来源无响应。', createdAt: now }],
  'qa-task-description-image-failed': [
    { id: 'log-description-image-1', taskId: 'qa-task-description-image-failed', level: 'info', message: '准备处理 dlsite:RJ01000001', createdAt: now },
    { id: 'log-description-image-2', taskId: 'qa-task-description-image-failed', level: 'error', message: 'DLsite 暂不可用，等待重试。', createdAt: now },
  ],
  'qa-task-description-image-fanza': [
    { id: 'log-description-image-fanza-1', taskId: 'qa-task-description-image-fanza', level: 'info', message: '已修复：fanza d_123456，插入 1 张图片。', createdAt: now },
  ],
};
const savePaths = [{ id: 'qa-save-path', gameId: 'qa-1', label: '默认存档', path: 'D:\\Games\\VN\\星之终途\\save', createdAt: now }];
const saveBackups = [{ id: 'qa-save-backup', gameId: 'qa-1', savePathId: 'qa-save-path', label: '手动备份', sourcePath: savePaths[0].path, backupPath: 'mock://save-backups/qa-1/manual', protection: false, createdAt: now }];
const collections = [{ id: 'qa-col-1', name: 'Key 短篇', description: 'Key short VNs', color: 'sky', gameCount: 1, createdAt: now, updatedAt: now }];
const collectionGames = [{ collectionId: 'qa-col-1', gameId: 'qa-1', addedAt: now }];
const assets = [
  { id: 'qa-asset-cover', gameId: 'qa-1', assetType: 'cover', uri: hero, source: 'mock', isPrimary: true, createdAt: now, updatedAt: now },
  { id: 'qa-asset-shot', gameId: 'qa-1', assetType: 'screenshot', uri: hero, source: 'mock', isPrimary: false, createdAt: now, updatedAt: now },
];
const savedSearches = [{ id: 'qa-search-1', name: '高分全年龄', query: 'tag:全年龄 rating>=80', description: null, createdAt: now, updatedAt: now }];
const libraryRoots = [{ id: 'qa-root-1', path: 'D:\\Games\\VN', label: 'VN Library', recursive: true, enabled: true, createdAt: now, updatedAt: now }];
const settings = {
  provider_vndb_enabled: 'true',
  provider_bangumi_enabled: 'true',
  provider_dlsite_enabled: 'true',
  provider_fanza_enabled: 'true',
  provider_ymgal_enabled: 'true',
  ui_accent_color: 'vnite',
  ui_theme_mode: 'dark',
  privacy_hide_hidden: 'false',
  privacy_blur_covers: 'false',
  privacy_filter_reports: 'true',
  save_auto_backup_before_launch: 'false',
  save_auto_backup_after_exit: 'false',
  tray_enabled: 'true',
};

function mockData(overrides = {}) {
  return {
    'mikavn-library.mock.games': overrides.games ?? games,
    'mikavn-library.mock.tasks': overrides.tasks ?? tasks,
    'mikavn-library.mock.taskLogs': overrides.taskLogs ?? taskLogs,
    'mikavn-library.mock.savePaths': overrides.savePaths ?? savePaths,
    'mikavn-library.mock.saveBackups': overrides.saveBackups ?? saveBackups,
    'mikavn-library.mock.collections': overrides.collections ?? collections,
    'mikavn-library.mock.collectionGames': overrides.collectionGames ?? collectionGames,
    'mikavn-library.mock.assets': overrides.assets ?? assets,
    'mikavn-library.mock.savedSearches': overrides.savedSearches ?? savedSearches,
    'mikavn-library.mock.libraryRoots': overrides.libraryRoots ?? libraryRoots,
    'mikavn-library.mock.settings': overrides.settings ?? settings,
  };
}

module.exports = {
  artworkRepairGame,
  assets,
  brokenMediaReferenceAsset,
  brokenMediaReferenceGame,
  descriptionImageRepairFailedTask,
  descriptionRepairGame,
  duplicateAuditGames,
  fanzaDescriptionImageRepairTask,
  fanzaDescriptionRepairGame,
  games,
  hero,
  mockData,
  secondaryExternalIdCompleteGame,
  settings,
  taskLogs,
  tasks,
};
