const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadDiagnosticRedaction() {
  const sourcePath = path.join(__dirname, '..', 'src', 'utils', 'diagnosticRedaction.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const module = { exports: {} };
  const fn = new Function('module', 'exports', transpiled);
  fn(module, module.exports);
  return module.exports;
}

function loadDescriptionImageRepairResultPanel() {
  const sourcePath = path.join(__dirname, '..', 'src', 'pages', 'Maintenance', 'DescriptionImageRepairResultPanel.tsx');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null, Fragment: 'Fragment' };
    if (specifier === '@/components/ui/badge') return { Badge: () => null };
    if (specifier === '@/components/ui/button') return { Button: () => null };
    if (specifier === '@/components/ui/page') return { SoftRow: () => null };
    if (specifier === '@/utils/taskLabels') {
      return {
        taskLabel: (value) => value,
        taskStatusClass: () => '',
        taskStatusLabel: (value) => value,
      };
    }
    if (specifier === '@/utils/time') return { formatDateTime: (value) => value };
    throw new Error(`Unexpected require: ${specifier}`);
  };
  const fn = new Function('module', 'exports', 'require', transpiled);
  fn(module, module.exports, localRequire);
  return module.exports;
}

function loadMaintenanceImageHealthModel() {
  const sourcePath = path.join(__dirname, '..', 'src', 'pages', 'Maintenance', 'maintenanceImageHealthModel.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier === '@/utils/diagnosticRedaction') return loadDiagnosticRedaction();
    throw new Error(`Unexpected require: ${specifier}`);
  };
  const fn = new Function('module', 'exports', 'require', transpiled);
  fn(module, module.exports, localRequire);
  return module.exports;
}

function taskDetail(logMessages) {
  return {
    task: {
      id: 'task-1',
      taskType: 'metadata.description_image_repair',
      status: 'completed',
      progress: 1,
      message: '简介图片修复完成',
      error: null,
      retryable: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    logs: logMessages.map((message, index) => ({
      id: `log-${index}`,
      taskId: 'task-1',
      level: 'info',
      message,
      createdAt: '2026-01-01T00:00:00.000Z',
    })),
  };
}

function readMaintenanceImageAuditPanelSource() {
  return fs.readFileSync('src/pages/Maintenance/MaintenanceImageAuditPanel.tsx', 'utf8');
}

function readImageHealthSummaryPanelSource() {
  return fs.readFileSync('src/pages/Maintenance/ImageHealthSummaryPanel.tsx', 'utf8');
}

function readImageHealthSamplePanelsSource() {
  return fs.readFileSync('src/pages/Maintenance/ImageHealthSamplePanels.tsx', 'utf8');
}

function readImageHealthUiSource() {
  return `${readMaintenanceImageAuditPanelSource()}\n${readImageHealthSummaryPanelSource()}\n${readImageHealthSamplePanelsSource()}`;
}

test('maintenance image health summary rendering is split from the audit shell', () => {
  const panel = readMaintenanceImageAuditPanelSource();
  const summary = readImageHealthSummaryPanelSource();

  assert.match(panel, /import \{ ImageHealthSummaryPanel \}/);
  assert.match(panel, /<ImageHealthSummaryPanel/);
  assert.doesNotMatch(panel, /function ImageHealthSummaryPanel/);
  assert.match(summary, /function ImageHealthSummaryPanel/);
  assert.match(summary, /整理全部安全项/);
  assert.match(summary, /ImageHealthSamplePanels/);
});

test('maintenance image health sample rendering is split from the summary panel', () => {
  const summary = readImageHealthSummaryPanelSource();
  const samples = readImageHealthSamplePanelsSource();

  assert.match(summary, /import \{ ImageHealthSamplePanels \}/);
  assert.match(summary, /<ImageHealthSamplePanels/);
  assert.doesNotMatch(summary, /function ImageHealthFileSamples/);
  assert.doesNotMatch(summary, /function ImageHealthDuplicateContentSamples/);
  assert.match(samples, /export function ImageHealthSamplePanels/);
  assert.match(samples, /function ImageHealthDuplicateContentSamples/);
  assert.match(samples, /joinImageCachePath/);
});

test('image health commands are registered and exposed through api', () => {
  const lib = fs.readFileSync('src-tauri/src/lib.rs', 'utf8');
  const commands = fs.readFileSync('src-tauri/src/commands/diagnostics.rs', 'utf8');
  const api = fs.readFileSync('src/services/api.ts', 'utf8');
  const types = fs.readFileSync('src/types/archive.ts', 'utf8');

  assert.match(lib, /commands::diagnostics::get_image_health_report/);
  assert.match(lib, /commands::diagnostics::quarantine_orphan_images/);
  assert.match(lib, /commands::diagnostics::quarantine_duplicate_content_images/);
  assert.match(lib, /commands::diagnostics::quarantine_invalid_image_cache_files/);
  assert.match(lib, /commands::diagnostics::quarantine_oversized_image_cache_files/);
  assert.match(lib, /commands::diagnostics::quarantine_content_type_mismatch_files/);
  assert.match(commands, /pub fn get_image_health_report/);
  assert.match(commands, /pub fn quarantine_orphan_images/);
  assert.match(commands, /pub fn quarantine_duplicate_content_images/);
  assert.match(commands, /pub fn quarantine_invalid_image_cache_files/);
  assert.match(commands, /pub fn quarantine_oversized_image_cache_files/);
  assert.match(commands, /pub fn quarantine_content_type_mismatch_files/);
  assert.match(api, /getImageHealthReport/);
  assert.match(api, /quarantineOrphanImages/);
  assert.match(api, /quarantineDuplicateContentImages/);
  assert.match(api, /quarantineInvalidImageCacheFiles/);
  assert.match(api, /quarantineOversizedImageCacheFiles/);
  assert.match(api, /quarantineContentTypeMismatchFiles/);
  assert.match(types, /export type ImageHealthReport/);
  assert.match(types, /export type ImageQuarantineReport/);
  assert.match(types, /invalidImageFiles/);
  assert.match(types, /invalidImageRefs/);
  assert.match(types, /invalidImageSamples/);
  assert.match(types, /referenceSamples/);
  assert.match(types, /ImageCacheReferenceSample/);
  assert.match(types, /duplicateContentGroups/);
  assert.match(types, /duplicateContentSamples/);
  assert.match(types, /ImageDuplicateContentGroup/);
  assert.match(types, /oversizedImageRefs/);
  assert.match(types, /oversizedReferencedFileCount/);
});

test('maintenance image health ui explains safe quarantine workflow', () => {
  const panel = readImageHealthUiSource();
  const actions = fs.readFileSync('src/pages/Maintenance/useMaintenanceInspectionActions.ts', 'utf8');

  assert.match(actions, /imageHealth/);
  assert.match(actions, /getImageHealthReport/);
  assert.match(panel, /图片健康/);
  assert.match(panel, /孤儿图片/);
  assert.match(panel, /重复文件名/);
  assert.match(panel, /过大图片/);
  assert.match(panel, /无效图片/);
  assert.match(panel, /失效引用/);
  assert.match(panel, /空文件或损坏/);
  assert.match(panel, /隔离区/);
  assert.match(panel, /不会永久删除/);
  assert.doesNotMatch(panel, /永久删除孤儿图片/);
});

test('maintenance image health ui explains how to recover quarantined images', () => {
  const panel = readImageHealthUiSource();

  assert.match(panel, /manifest\.json/);
  assert.match(panel, /按清单找回/);
  assert.match(panel, /恢复/);
});

test('maintenance image quarantine result exposes recovery path actions', () => {
  const actions = fs.readFileSync('src/pages/Maintenance/useMaintenanceInspectionActions.ts', 'utf8');
  const status = fs.readFileSync('src/pages/Maintenance/MaintenanceStatusNotices.tsx', 'utf8');
  const page = fs.readFileSync('src/pages/Maintenance/MaintenancePage.tsx', 'utf8');

  assert.match(actions, /imageQuarantinePath/);
  assert.match(actions, /setImageQuarantinePath\(\{ quarantineDir: result\.quarantineDir, manifestPath: result\.manifestPath \}\)/);
  assert.match(actions, /revealImageQuarantineDir/);
  assert.match(actions, /copyImageQuarantineManifestPath/);
  assert.match(actions, /api\.revealPath\(imageQuarantinePath\.quarantineDir\)/);
  assert.match(actions, /navigator\.clipboard\.writeText\(imageQuarantinePath\.manifestPath\)/);
  assert.match(status, /imageQuarantinePath/);
  assert.match(status, /打开隔离区/);
  assert.match(status, /复制隔离清单路径/);
  assert.match(page, /imageQuarantinePath=\{inspectionActions\.imageQuarantinePath\}/);
  assert.match(page, /onRevealImageQuarantineDir=\{inspectionActions\.revealImageQuarantineDir\}/);
  assert.match(page, /onCopyImageQuarantineManifestPath=\{inspectionActions\.copyImageQuarantineManifestPath\}/);
});

test('maintenance image health ui exposes cache issue samples and reveal actions', () => {
  const panel = readImageHealthUiSource();
  const types = fs.readFileSync('src/types/archive.ts', 'utf8');
  const mock = fs.readFileSync('src/services/mockStoreDiagnostics.ts', 'utf8');

  assert.match(panel, /invalidImageSamples/);
  assert.match(panel, /contentTypeMismatchSamples/);
  assert.match(panel, /类型不匹配/);
  assert.match(types, /contentTypeMismatchFiles/);
  assert.match(types, /contentTypeMismatchSamples/);
  assert.match(mock, /contentTypeMismatchFileCount/);
  assert.match(panel, /referenceSamples/);
  assert.match(panel, /orphanSamples/);
  assert.match(panel, /oversizedSamples/);
  assert.match(panel, /duplicateNameSamples/);
  assert.match(panel, /图片样本/);
  assert.match(panel, /引用/);
  assert.match(panel, /定位/);
  assert.match(panel, /打开游戏/);
  assert.match(panel, /onOpenGame/);
  assert.match(panel, /onRevealPath/);
});

test('maintenance image health ui can reveal duplicate cache samples', () => {
  const panel = readImageHealthUiSource();

  assert.match(panel, /joinImageCachePath/);
  assert.match(panel, /rootPath=\{cache\.rootPath\}/);
  assert.match(panel, /onRevealPath=\{onRevealPath\}/);
  assert.match(panel, /定位重复/);
  assert.match(panel, /重复文件名需要人工确认内容是否相同/);
  assert.match(panel, /重复内容/);
  assert.match(panel, /duplicateContentSamples/);
  assert.match(panel, /contentHash/);
  assert.match(panel, /内容相同/);
});

test('maintenance image health ui links missing artwork findings to repair actions', () => {
  const panel = readImageHealthUiSource();
  const content = fs.readFileSync('src/pages/Maintenance/MaintenancePageContent.tsx', 'utf8');

  assert.match(panel, /missingCoverGames/);
  assert.match(panel, /missingArtworkGames/);
  assert.match(panel, /缺封面/);
  assert.match(panel, /媒体图不完整/);
  assert.match(panel, /诊断缺图/);
  assert.match(panel, /开始补图/);
  assert.match(panel, /onDiagnoseArtwork/);
  assert.match(panel, /onStartArtworkRepair/);
  assert.match(content, /onDiagnoseArtwork=\{inspectionActions\.loadArtworkDiagnosis\}/);
  assert.match(content, /onStartArtworkRepair=\{queueActions\.startArtworkRepair\}/);
});

test('artwork repair candidate discovery uses lightweight backend rows', () => {
  const service = fs.readFileSync('src-tauri/src/services/metadata_artwork_repair.rs', 'utf8');
  const metadataDb = fs.readFileSync('src-tauri/src/db/metadata_ext.rs', 'utf8');

  assert.doesNotMatch(service, /db\.list_games\(GameFilter/);
  assert.match(service, /ArtworkRepairCandidateRow/);
  assert.match(service, /list_artwork_repair_candidate_rows/);
  assert.match(service, /list_artwork_provider_id_rows/);
  assert.match(metadataDb, /pub fn list_artwork_repair_candidate_rows/);
  assert.match(metadataDb, /SELECT id, title, cover_image, banner_image, background_image FROM games/);
  assert.match(metadataDb, /pub fn list_artwork_provider_id_rows/);
  assert.match(metadataDb, /FROM external_ids/);
});

test('maintenance image health ui links broken image references to audit details', () => {
  const panel = readImageHealthUiSource();

  assert.match(panel, /canInspectBrokenRefs/);
  assert.match(panel, /查看失效引用/);
  assert.match(panel, /缺失引用、失效引用和外部旧路径需要进入明细审计逐条确认/);
  assert.match(panel, /onLoadAudit/);
});

test('maintenance image health ui exposes one-click safe cleanup wording', () => {
  const panel = readImageHealthUiSource();
  const actions = fs.readFileSync('src/pages/Maintenance/useMaintenanceInspectionActions.ts', 'utf8');
  const content = fs.readFileSync('src/pages/Maintenance/MaintenancePageContent.tsx', 'utf8');

  assert.match(panel, /一键安全整理/);
  assert.match(panel, /整理孤儿图片/);
  assert.match(panel, /整理重复内容/);
  assert.match(panel, /整理无效图片/);
  assert.match(panel, /整理过大图片/);
  assert.match(panel, /整理类型不匹配/);
  assert.match(panel, /整理全部安全项/);
  assert.match(panel, /只处理未被数据库引用的孤儿缓存/);
  assert.match(panel, /只隔离重复内容中的未引用副本/);
  assert.match(panel, /只隔离未被数据库引用的无效图片/);
  assert.match(panel, /只隔离未被数据库引用的过大图片/);
  assert.match(panel, /只隔离未被数据库引用的类型不匹配图片/);
  assert.match(panel, /缺封面和失效引用会保留给补图或明细审计/);
  assert.match(panel, /canSafeCleanup/);
  assert.match(panel, /canCleanupDuplicateContent/);
  assert.match(panel, /canCleanupInvalidImages/);
  assert.match(panel, /canCleanupOversizedImages/);
  assert.match(panel, /Math\.max\(0, summary\.oversizedFiles - summary\.oversizedImageRefs\) > 0/);
  assert.match(panel, /canCleanupContentTypeMismatch/);
  assert.match(panel, /canCleanupSafeCacheIssues/);
  assert.match(panel, /onQuarantineOrphans/);
  assert.match(panel, /onQuarantineDuplicateContent/);
  assert.match(panel, /onQuarantineInvalidImages/);
  assert.match(panel, /onQuarantineOversizedImages/);
  assert.match(panel, /onQuarantineContentTypeMismatch/);
  assert.match(panel, /onQuarantineSafeCacheIssues/);
  assert.match(actions, /quarantineSafeCacheIssues/);
  assert.match(content, /onQuarantineSafeCacheIssues=\{inspectionActions\.quarantineSafeCacheIssues\}/);
  assert.match(actions, /formatImageQuarantineCompletionMessage/);
  assert.doesNotMatch(panel, /一键永久删除/);
});

test('maintenance image health ui surfaces cache storage size and safe reclaim size', () => {
  const panel = readImageHealthUiSource();

  assert.match(panel, /缓存体积/);
  assert.match(panel, /formatBytes\(cache\?\.totalBytes \?\? 0\)/);
  assert.match(panel, /孤儿体积/);
  assert.match(panel, /formatBytes\(cache\?\.orphanBytes \?\? 0\)/);
  assert.match(panel, /可安全整理的孤儿缓存体积/);
});

test('image health summary can be copied as a compact diagnostic text', () => {
  const { formatImageHealthSummaryMarkdown } = loadMaintenanceImageHealthModel();
  const message = formatImageHealthSummaryMarkdown({
    generatedAt: '2026-06-22T12:00:00.000Z',
    summary: {
      totalImageRefs: 25,
      issueImageRefs: 4,
      missingLocalRefs: 2,
      cDriveRefs: 1,
      playniteRefs: 1,
      legacyAppDataImportRefs: 3,
      externalLegacyRefs: 1,
      imageFiles: 100,
      orphanFiles: 7,
      duplicateFileNameGroups: 2,
      duplicateContentGroups: 3,
      oversizedFiles: 5,
      oversizedImageRefs: 2,
      invalidImageFiles: 4,
      invalidImageRefs: 1,
      contentTypeMismatchFiles: 6,
      contentTypeMismatchRefs: 2,
      missingCoverGames: 8,
      missingArtworkGames: 9,
    },
    cache: { rootPath: 'E:\\MikaVN Library\\app-data\\images' },
    recommendations: ['先查看失效引用。', '再整理未引用缓存。'],
  });

  assert.match(message, /MikaVN 图片健康摘要/);
  assert.match(message, /生成时间：2026-06-22T12:00:00.000Z/);
  assert.match(message, /缓存目录：E:\\MikaVN Library\\app-data\\images/);
  assert.match(message, /图片引用：25 条，问题 4 条/);
  assert.match(message, /缺失引用：2/);
  assert.match(message, /旧导入缓存：3（已在 app-data\/images 内，不计入失效引用；路径规范化需先完成数据库备份。）/);
  assert.match(message, /孤儿图片：7/);
  assert.match(message, /重复内容：3 组/);
  assert.match(message, /过大图片：5 个，其中仍被引用 2 个/);
  assert.match(message, /无效图片：4 个，其中仍被引用 1 个/);
  assert.match(message, /类型不匹配：6 个，其中仍被引用 2 个/);
  assert.match(message, /缺封面游戏：8/);
  assert.match(message, /媒体图不完整游戏：9/);
  assert.match(message, /1\. 先查看失效引用。/);
  assert.match(message, /2\. 再整理未引用缓存。/);
});

test('image health summary redacts copied cache paths and recommendation secrets', () => {
  const { formatImageHealthSummaryMarkdown } = loadMaintenanceImageHealthModel();
  const message = formatImageHealthSummaryMarkdown({
    generatedAt: '2026-06-22T12:00:00.000Z',
    summary: {
      totalImageRefs: 1,
      issueImageRefs: 1,
      missingLocalRefs: 1,
      cDriveRefs: 1,
      playniteRefs: 0,
      legacyAppDataImportRefs: 0,
      externalLegacyRefs: 0,
      imageFiles: 1,
      orphanFiles: 0,
      duplicateFileNameGroups: 0,
      duplicateContentGroups: 0,
      oversizedFiles: 0,
      oversizedImageRefs: 0,
      invalidImageFiles: 0,
      invalidImageRefs: 0,
      contentTypeMismatchFiles: 0,
      contentTypeMismatchRefs: 0,
      missingCoverGames: 1,
      missingArtworkGames: 1,
    },
    cache: { rootPath: String.raw`C:\Users\alice\AppData\Local\MikaVN\images` },
    recommendations: ['检查 token:abc password=hunter2 API_KEY=secret 后再导出。'],
  });

  assert.match(message, /\[redacted\]/);
  assert.match(message, /C:\\Users\\\[user\]\\AppData/);
  assert.doesNotMatch(message, /abc|hunter2|secret|alice/);
});

test('image health model formats referenced and safely cleanable cache counts', () => {
  const { formatImageHealthReferenceSplit } = loadMaintenanceImageHealthModel();

  assert.equal(formatImageHealthReferenceSplit(8, 3), '未引用可整理 5 · 仍被引用 3');
  assert.equal(formatImageHealthReferenceSplit(2, 5), '未引用可整理 0 · 仍被引用 5');
  assert.equal(formatImageHealthReferenceSplit(undefined, undefined), '未引用可整理 0 · 仍被引用 0');
});

test('maintenance image health ui distinguishes referenced cache issues from safe cleanup counts', () => {
  const panel = readImageHealthUiSource();

  assert.match(panel, /formatImageHealthReferenceSplit/);
  assert.match(panel, /formatImageHealthReferenceSplit\(summary\?\.oversizedFiles, summary\?\.oversizedImageRefs\)/);
  assert.match(panel, /formatImageHealthReferenceSplit\(summary\?\.invalidImageFiles, summary\?\.invalidImageRefs\)/);
  assert.match(panel, /formatImageHealthReferenceSplit\(summary\?\.contentTypeMismatchFiles, summary\?\.contentTypeMismatchRefs\)/);
});

test('maintenance image health ui can copy the current health summary', () => {
  const panel = readImageHealthUiSource();
  const actions = fs.readFileSync('src/pages/Maintenance/useMaintenanceInspectionActions.ts', 'utf8');
  const content = fs.readFileSync('src/pages/Maintenance/MaintenancePageContent.tsx', 'utf8');

  assert.match(panel, /复制健康摘要/);
  assert.match(panel, /onCopyImageHealthSummary/);
  assert.match(panel, /disabled=\{!canCopyHealthSummary\}/);
  assert.match(actions, /copyImageHealthSummary/);
  assert.match(actions, /formatImageHealthSummaryMarkdown\(imageHealth\)/);
  assert.match(actions, /navigator\.clipboard\.writeText/);
  assert.match(actions, /已复制图片健康摘要。/);
  assert.match(content, /onCopyImageHealthSummary=\{inspectionActions\.copyImageHealthSummary\}/);
});

test('maintenance image health batch cleanup confirms once and calls only safe cache quarantine APIs', () => {
  const actions = fs.readFileSync('src/pages/Maintenance/useMaintenanceInspectionActions.ts', 'utf8');
  const batchStart = actions.indexOf('const quarantineSafeCacheIssues');
  const batchEnd = actions.indexOf('const resetImageAuditFilters');
  const batchSource = actions.slice(batchStart, batchEnd);

  assert.ok(batchStart > -1, 'batch safe cleanup action must exist');
  assert.match(batchSource, /window\.confirm/);
  assert.match(batchSource, /if \(!confirmed\) return/);
  assert.match(batchSource, /未被数据库引用/);
  assert.match(batchSource, /孤儿图片：\$\{formatCount\(orphanCount\)\}/);
  assert.match(batchSource, /重复内容：\$\{formatCount\(duplicateGroupCount\)\} 组/);
  assert.match(batchSource, /无效图片：\$\{formatCount\(invalidUnreferencedCount\)\}/);
  assert.match(batchSource, /过大图片：\$\{formatCount\(oversizedUnreferencedCount\)\}/);
  assert.match(batchSource, /类型不匹配：\$\{formatCount\(mismatchUnreferencedCount\)\}/);
  assert.match(batchSource, /api\.quarantineOrphanImages/);
  assert.match(batchSource, /api\.quarantineDuplicateContentImages/);
  assert.match(batchSource, /api\.quarantineInvalidImageCacheFiles/);
  assert.match(batchSource, /api\.quarantineOversizedImageCacheFiles/);
  assert.match(batchSource, /api\.quarantineContentTypeMismatchFiles/);
  assert.match(batchSource, /api\.getImageHealthReport\(\{ sampleLimit: 100 \}\)/);
  assert.match(batchSource, /formatImageSafeCacheBatchCompletionMessage/);
  assert.doesNotMatch(batchSource, /repairArtwork/);
  assert.doesNotMatch(batchSource, /repairDescriptionImages/);
});

test('maintenance image health quarantine requires explicit confirmation before moving files', () => {
  const actions = fs.readFileSync('src/pages/Maintenance/useMaintenanceInspectionActions.ts', 'utf8');
  const confirmIndex = actions.indexOf('window.confirm');
  const quarantineIndex = actions.indexOf('api.quarantineOrphanImages');

  assert.ok(confirmIndex > -1, 'quarantine action must ask for confirmation first');
  assert.ok(quarantineIndex > -1, 'quarantine action must still call the quarantine api');
  assert.ok(confirmIndex < quarantineIndex, 'confirmation must happen before files are moved');
  assert.match(actions, /移动到隔离区/);
  assert.match(actions, /不会永久删除/);
  assert.match(actions, /manifest\.json/);
  assert.match(actions, /if \(!confirmed\) return/);
});

test('maintenance duplicate content quarantine requires explicit confirmation before moving files', () => {
  const actions = fs.readFileSync('src/pages/Maintenance/useMaintenanceInspectionActions.ts', 'utf8');
  const confirmIndex = actions.indexOf('重复内容缓存');
  const quarantineIndex = actions.indexOf('api.quarantineDuplicateContentImages');

  assert.ok(confirmIndex > -1, 'duplicate cleanup action must explain duplicate content first');
  assert.ok(quarantineIndex > -1, 'duplicate cleanup action must call the duplicate quarantine api');
  assert.ok(confirmIndex < quarantineIndex, 'confirmation copy must appear before files are moved');
  assert.match(actions, /保留被数据库引用的图片/);
  assert.match(actions, /至少保留一个未引用副本/);
});

test('maintenance invalid image quarantine requires explicit confirmation before moving files', () => {
  const actions = fs.readFileSync('src/pages/Maintenance/useMaintenanceInspectionActions.ts', 'utf8');
  const confirmIndex = actions.indexOf('未被数据库引用的无效图片');
  const quarantineIndex = actions.indexOf('api.quarantineInvalidImageCacheFiles');

  assert.ok(confirmIndex > -1, 'invalid cleanup action must explain unreferenced invalid files first');
  assert.ok(quarantineIndex > -1, 'invalid cleanup action must call the invalid quarantine api');
  assert.ok(confirmIndex < quarantineIndex, 'confirmation copy must appear before files are moved');
  assert.match(actions, /仍被引用的无效图片会保留/);
});

test('maintenance oversized image quarantine requires explicit confirmation before moving files', () => {
  const actions = fs.readFileSync('src/pages/Maintenance/useMaintenanceInspectionActions.ts', 'utf8');
  const confirmIndex = actions.indexOf('未被数据库引用的过大图片');
  const quarantineIndex = actions.indexOf('api.quarantineOversizedImageCacheFiles');

  assert.ok(confirmIndex > -1, 'oversized cleanup action must explain unreferenced large files first');
  assert.ok(quarantineIndex > -1, 'oversized cleanup action must call the oversized quarantine api');
  assert.ok(confirmIndex < quarantineIndex, 'confirmation copy must appear before files are moved');
  assert.match(actions, /仍被引用的过大图片会保留/);
  assert.match(actions, /const oversizedUnreferencedCount = Math\.max\(0, \(imageHealth\?\.summary\.oversizedFiles \?\? 0\) - \(imageHealth\?\.summary\.oversizedImageRefs \?\? 0\)\)/);
  assert.match(actions, /formatCount\(oversizedUnreferencedCount\)/);
});

test('maintenance content type mismatch quarantine requires explicit confirmation before moving files', () => {
  const actions = fs.readFileSync('src/pages/Maintenance/useMaintenanceInspectionActions.ts', 'utf8');
  const confirmIndex = actions.indexOf('未被数据库引用的类型不匹配图片');
  const quarantineIndex = actions.indexOf('api.quarantineContentTypeMismatchFiles');

  assert.ok(confirmIndex > -1, 'content-type mismatch cleanup action must explain unreferenced files first');
  assert.ok(quarantineIndex > -1, 'content-type mismatch cleanup action must call the quarantine api');
  assert.ok(confirmIndex < quarantineIndex, 'confirmation copy must appear before files are moved');
  assert.match(actions, /仍被引用的类型不匹配图片会保留/);
});

test('maintenance image health ui treats app-data legacy imports as informational', () => {
  const panel = readImageHealthUiSource();

  assert.match(panel, /旧导入缓存/);
  assert.match(panel, /当前不计入失效引用/);
  assert.match(panel, /路径规范化会改数据库/);
  assert.match(panel, /先完成数据库备份/);
  assert.doesNotMatch(panel, /label="Playnite 旧导入" tone=\{\(summary\?\.legacyAppDataImportRefs \?\? 0\) > 0 \? 'warn' : 'ok'\}/);
});

test('maintenance image health ui shows every health recommendation', () => {
  const panel = readImageHealthUiSource();

  assert.match(panel, /report\.recommendations\.map/);
  assert.match(panel, /health-recommendation/);
  assert.doesNotMatch(panel, /report\.recommendations\[0\]/);
});

test('image quarantine completion message includes skipped and refreshed orphan counts', () => {
  const { formatImageQuarantineCompletionMessage } = loadMaintenanceImageHealthModel();
  const message = formatImageQuarantineCompletionMessage(
    { movedFiles: 12, skippedFiles: 2 },
    { summary: { orphanFiles: 3 } },
  );

  assert.equal(message, '安全整理完成：已移动 12 个孤儿图片到隔离区；跳过 2 个；复查剩余 3 个孤儿图片。隔离区 manifest.json 可用于按原路径找回。');
});

test('duplicate content quarantine completion message reports refreshed duplicate groups', () => {
  const { formatImageDuplicateContentQuarantineCompletionMessage } = loadMaintenanceImageHealthModel();
  const message = formatImageDuplicateContentQuarantineCompletionMessage(
    { movedFiles: 8, skippedFiles: 1 },
    { summary: { duplicateContentGroups: 2 } },
  );

  assert.equal(message, '重复内容整理完成：已移动 8 个未引用副本到隔离区；跳过 1 个；复查剩余 2 组重复内容。隔离区 manifest.json 可用于按原路径找回。');
});

test('invalid image quarantine completion message reports refreshed invalid files', () => {
  const { formatImageInvalidQuarantineCompletionMessage } = loadMaintenanceImageHealthModel();
  const message = formatImageInvalidQuarantineCompletionMessage(
    { movedFiles: 5, skippedFiles: 1 },
    { summary: { invalidImageFiles: 3, invalidImageRefs: 2 } },
  );

  assert.equal(message, '无效图片整理完成：已移动 5 个未引用坏图到隔离区；跳过 1 个；复查剩余 1 个未引用坏图。隔离区 manifest.json 可用于按原路径找回。');
});

test('oversized image quarantine completion message reports refreshed oversized files', () => {
  const { formatImageOversizedQuarantineCompletionMessage } = loadMaintenanceImageHealthModel();
  const message = formatImageOversizedQuarantineCompletionMessage(
    { movedFiles: 7, skippedFiles: 1 },
    { summary: { oversizedFiles: 4, oversizedImageRefs: 3 } },
  );

  assert.equal(message, '过大图片整理完成：已移动 7 个未引用大图到隔离区；跳过 1 个；复查剩余 1 个未引用大图。隔离区 manifest.json 可用于按原路径找回。');
});

test('content type mismatch quarantine completion message reports refreshed mismatches', () => {
  const { formatImageContentTypeMismatchQuarantineCompletionMessage } = loadMaintenanceImageHealthModel();
  const message = formatImageContentTypeMismatchQuarantineCompletionMessage(
    { movedFiles: 3, skippedFiles: 1 },
    { summary: { contentTypeMismatchFiles: 2, contentTypeMismatchRefs: 1 } },
  );

  assert.equal(message, '类型不匹配整理完成：已移动 3 个未引用错配图片到隔离区；跳过 1 个；复查剩余 1 个未引用错配图片。隔离区 manifest.json 可用于按原路径找回。');
});

test('safe cache batch completion message summarizes moved files and refreshed issues', () => {
  const { formatImageSafeCacheBatchCompletionMessage } = loadMaintenanceImageHealthModel();
  const message = formatImageSafeCacheBatchCompletionMessage(
    [
      { movedFiles: 2, skippedFiles: 0 },
      { movedFiles: 3, skippedFiles: 1 },
      { movedFiles: 0, skippedFiles: 2 },
    ],
    { summary: { orphanFiles: 1, duplicateContentGroups: 2, invalidImageFiles: 4, invalidImageRefs: 1, oversizedFiles: 5, oversizedImageRefs: 4, contentTypeMismatchFiles: 3, contentTypeMismatchRefs: 1 } },
  );

  assert.equal(message, '批量安全整理完成：已移动 5 个未引用缓存文件到隔离区；跳过 3 个；复查剩余孤儿 1 个、重复内容 2 组、未引用坏图 3 个、未引用大图 1 个、未引用类型不匹配 2 个。隔离区 manifest.json 可用于按原路径找回。');
});

test('image health action hint explains disabled maintenance actions', () => {
  const { getImageHealthActionHint } = loadMaintenanceImageHealthModel();
  const cleanReport = {
    summary: {
      orphanFiles: 0,
      missingLocalRefs: 0,
      invalidImageRefs: 0,
      cDriveRefs: 0,
      playniteRefs: 0,
      externalLegacyRefs: 0,
      missingArtworkGames: 0,
    },
  };
  const brokenOnlyReport = {
    summary: {
      orphanFiles: 0,
      missingLocalRefs: 2,
      invalidImageRefs: 0,
      cDriveRefs: 0,
      playniteRefs: 0,
      externalLegacyRefs: 0,
      missingArtworkGames: 0,
    },
  };
  const duplicateOnlyReport = {
    summary: {
      orphanFiles: 0,
      missingLocalRefs: 0,
      invalidImageRefs: 0,
      cDriveRefs: 0,
      playniteRefs: 0,
      externalLegacyRefs: 0,
      missingArtworkGames: 0,
      duplicateContentGroups: 2,
    },
  };
  const referencedOversizedOnlyReport = {
    summary: {
      orphanFiles: 0,
      missingLocalRefs: 0,
      invalidImageRefs: 0,
      cDriveRefs: 0,
      playniteRefs: 0,
      externalLegacyRefs: 0,
      missingArtworkGames: 0,
      oversizedFiles: 2,
      oversizedImageRefs: 2,
    },
  };
  const referencedContentTypeMismatchOnlyReport = {
    summary: {
      orphanFiles: 0,
      missingLocalRefs: 0,
      invalidImageRefs: 0,
      cDriveRefs: 0,
      playniteRefs: 0,
      externalLegacyRefs: 0,
      missingArtworkGames: 0,
      contentTypeMismatchFiles: 2,
      contentTypeMismatchRefs: 2,
    },
  };
  const orphanOnlyReport = {
    summary: {
      orphanFiles: 2,
      missingLocalRefs: 0,
      invalidImageRefs: 0,
      cDriveRefs: 0,
      playniteRefs: 0,
      externalLegacyRefs: 0,
      missingArtworkGames: 0,
    },
  };
  const artworkOnlyReport = {
    summary: {
      orphanFiles: 0,
      missingLocalRefs: 0,
      invalidImageRefs: 0,
      cDriveRefs: 0,
      playniteRefs: 0,
      externalLegacyRefs: 0,
      missingArtworkGames: 3,
    },
  };

  assert.equal(
    getImageHealthActionHint({ report: null, loading: false }),
    '先检查图片健康后，再查看失效引用、诊断缺图或安全整理孤儿图片。',
  );
  assert.equal(
    getImageHealthActionHint({ report: cleanReport, loading: false }),
    '当前图片健康检查没有发现需要处理的图片问题。',
  );
  assert.equal(
    getImageHealthActionHint({ report: brokenOnlyReport, loading: false }),
    '可查看失效引用；没有可补全的媒体缺图；没有可整理的孤儿图片。',
  );
  assert.equal(
    getImageHealthActionHint({ report: orphanOnlyReport, loading: false }),
    '可整理孤儿图片；没有需要逐条审计的失效引用；没有可补全的媒体缺图。',
  );
  assert.equal(
    getImageHealthActionHint({ report: artworkOnlyReport, loading: false }),
    '可诊断或补全媒体缺图；没有需要逐条审计的失效引用；没有可整理的孤儿图片。',
  );
  assert.equal(
    getImageHealthActionHint({ report: duplicateOnlyReport, loading: false }),
    '可整理重复内容中的未引用副本；没有需要逐条审计的失效引用；没有可补全的媒体缺图；没有可整理的孤儿图片。',
  );
  assert.equal(
    getImageHealthActionHint({ report: referencedOversizedOnlyReport, loading: false }),
    '过大图片仍被数据库引用，需压缩、重新抓取或人工确认；没有需要逐条审计的失效引用；没有可补全的媒体缺图；没有可整理的孤儿图片。',
  );
  assert.equal(
    getImageHealthActionHint({ report: referencedContentTypeMismatchOnlyReport, loading: false }),
    '类型不匹配图片仍被数据库引用，需重新抓取或人工确认；没有需要逐条审计的失效引用；没有可补全的媒体缺图；没有可整理的孤儿图片。',
  );
});

test('maintenance image health ui renders the action availability hint', () => {
  const panel = readImageHealthUiSource();

  assert.match(panel, /getImageHealthActionHint/);
  assert.match(panel, /data-image-health-action-hint/);
  assert.match(panel, /\{actionHint\}/);
});

test('description image repair history parses self-contained logs without a game index', () => {
  const { descriptionImageRepairLogsNeedSourceLookup, summarizeDescriptionImageRepairTask } = loadDescriptionImageRepairResultPanel();
  const detail = taskDetail(['已修复：简介图片修复候选 [game-description]，dlsite RJ01000001，插入 2 张图片。']);

  assert.equal(descriptionImageRepairLogsNeedSourceLookup(detail.logs), false);
  const summary = summarizeDescriptionImageRepairTask(detail, []);

  assert.equal(summary.updated.length, 1);
  assert.equal(summary.updated[0].title, '简介图片修复候选');
  assert.equal(summary.updated[0].gameId, 'game-description');
  assert.equal(summary.updated[0].provider, 'dlsite');
  assert.equal(summary.updated[0].providerId, 'RJ01000001');
  assert.equal(summary.updated[0].imageCount, 2);
});

test('description image repair history still resolves legacy provider-only logs from a game index', () => {
  const { descriptionImageRepairLogsNeedSourceLookup, summarizeDescriptionImageRepairTask } = loadDescriptionImageRepairResultPanel();
  const detail = taskDetail(['已修复：dlsite RJ01000001，插入 1 张图片。']);
  const games = [{ id: 'game-description', title: '简介图片修复候选', dlsiteId: 'RJ01000001', fanzaId: null }];

  assert.equal(descriptionImageRepairLogsNeedSourceLookup(detail.logs), true);
  const summary = summarizeDescriptionImageRepairTask(detail, games);

  assert.equal(summary.updated[0].title, '简介图片修复候选');
  assert.equal(summary.updated[0].gameId, 'game-description');
});

test('description image repair history collects unique legacy source lookups', () => {
  const { collectDescriptionImageRepairSourceLookups } = loadDescriptionImageRepairResultPanel();
  const lookups = collectDescriptionImageRepairSourceLookups(taskDetail([
    '已修复：dlsite RJ01000001，插入 1 张图片。',
    '跳过：fanza:ABC_123，已有简介图片。',
    '简介图片修复候选：dlsite:RJ01000001，fanza:ABC_456',
    '已修复：自包含标题 [game-description]，dlsite RJ999999，插入 1 张图片。',
  ]).logs);

  assert.deepEqual(lookups, [
    { provider: 'dlsite', providerId: 'RJ01000001' },
    { provider: 'fanza', providerId: 'ABC_123' },
    { provider: 'fanza', providerId: 'ABC_456' },
  ]);
});

test('description image repair candidate discovery uses lightweight backend rows', () => {
  const service = fs.readFileSync('src-tauri/src/services/metadata_description_images.rs', 'utf8');
  const metadataDb = fs.readFileSync('src-tauri/src/db/metadata_ext.rs', 'utf8');

  assert.doesNotMatch(service, /db\.list_games\(GameFilter/);
  assert.doesNotMatch(service, /db\.list_external_ids\(game\.id\.clone\(\)\)/);
  assert.match(service, /DescriptionImageRepairCandidateRow/);
  assert.match(service, /list_description_image_repair_candidate_rows/);
  assert.match(service, /list_description_image_provider_id_rows/);
  assert.match(metadataDb, /pub fn list_description_image_repair_candidate_rows/);
  assert.match(metadataDb, /SELECT id, title, description FROM games/);
  assert.match(metadataDb, /pub fn list_description_image_provider_id_rows/);
  assert.match(metadataDb, /FROM external_ids/);
});

test('maintenance description history only loads games for legacy task logs', () => {
  const actions = fs.readFileSync('src/pages/Maintenance/useMaintenanceHistoryActions.ts', 'utf8');
  const rust = fs.readFileSync('src-tauri/src/services/metadata_description_images.rs', 'utf8');
  const mock = fs.readFileSync('src/services/mockStoreArtworkRepair.ts', 'utf8');

  assert.match(actions, /collectDescriptionImageRepairSourceLookups/);
  assert.match(actions, /const details = await Promise\.all\(tasks\.map\(async \(task\) => api\.getTaskDetail\(task\.id\)\)\)/);
  assert.match(actions, /const sourceLookups = uniqueDescriptionSourceLookups\(details\.flatMap\(\(detail\) => collectDescriptionImageRepairSourceLookups\(detail\.logs\)\)\)/);
  assert.match(actions, /externalProvider: lookup\.provider/);
  assert.match(actions, /externalId: lookup\.providerId/);
  assert.match(actions, /limit: 5/);
  assert.doesNotMatch(actions, /api\.listGames\(\{ sortBy: 'updated_at', sortDirection: 'desc' \}\)/);
  assert.match(rust, /"已修复：\{\} \[\{\}\]，\{\} \{\}，插入 \{\} 张图片。"/);
  assert.match(mock, /`已修复：\$\{candidate\.title\} \[\$\{candidate\.gameId\}\]，\$\{candidate\.provider\} \$\{candidate\.providerId\}，插入 1 张图片。`/);
});
