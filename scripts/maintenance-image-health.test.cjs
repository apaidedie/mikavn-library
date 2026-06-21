const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

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
  const fn = new Function('module', 'exports', transpiled);
  fn(module, module.exports);
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
      retryPayload: null,
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

test('image health commands are registered and exposed through api', () => {
  const lib = fs.readFileSync('src-tauri/src/lib.rs', 'utf8');
  const commands = fs.readFileSync('src-tauri/src/commands/diagnostics.rs', 'utf8');
  const api = fs.readFileSync('src/services/api.ts', 'utf8');
  const types = fs.readFileSync('src/types/archive.ts', 'utf8');

  assert.match(lib, /commands::diagnostics::get_image_health_report/);
  assert.match(lib, /commands::diagnostics::quarantine_orphan_images/);
  assert.match(commands, /pub fn get_image_health_report/);
  assert.match(commands, /pub fn quarantine_orphan_images/);
  assert.match(api, /getImageHealthReport/);
  assert.match(api, /quarantineOrphanImages/);
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
});

test('maintenance image health ui explains safe quarantine workflow', () => {
  const panel = fs.readFileSync('src/pages/Maintenance/MaintenanceImageAuditPanel.tsx', 'utf8');
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
  const panel = fs.readFileSync('src/pages/Maintenance/MaintenanceImageAuditPanel.tsx', 'utf8');

  assert.match(panel, /manifest\.json/);
  assert.match(panel, /按清单找回/);
  assert.match(panel, /恢复/);
});

test('maintenance image health ui exposes cache issue samples and reveal actions', () => {
  const panel = fs.readFileSync('src/pages/Maintenance/MaintenanceImageAuditPanel.tsx', 'utf8');
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
  const panel = fs.readFileSync('src/pages/Maintenance/MaintenanceImageAuditPanel.tsx', 'utf8');

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
  const panel = fs.readFileSync('src/pages/Maintenance/MaintenanceImageAuditPanel.tsx', 'utf8');
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

test('maintenance image health ui links broken image references to audit details', () => {
  const panel = fs.readFileSync('src/pages/Maintenance/MaintenanceImageAuditPanel.tsx', 'utf8');

  assert.match(panel, /canInspectBrokenRefs/);
  assert.match(panel, /查看失效引用/);
  assert.match(panel, /缺失引用、失效引用和外部旧路径需要进入明细审计逐条确认/);
  assert.match(panel, /onLoadAudit/);
});

test('maintenance image health ui exposes one-click safe cleanup wording', () => {
  const panel = fs.readFileSync('src/pages/Maintenance/MaintenanceImageAuditPanel.tsx', 'utf8');
  const actions = fs.readFileSync('src/pages/Maintenance/useMaintenanceInspectionActions.ts', 'utf8');

  assert.match(panel, /一键安全整理/);
  assert.match(panel, /只处理未被数据库引用的孤儿缓存/);
  assert.match(panel, /缺封面和失效引用会保留给补图或明细审计/);
  assert.match(panel, /canSafeCleanup/);
  assert.match(panel, /onQuarantineOrphans/);
  assert.match(actions, /formatImageQuarantineCompletionMessage/);
  assert.doesNotMatch(panel, /一键永久删除/);
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

test('maintenance image health ui treats app-data legacy imports as informational', () => {
  const panel = fs.readFileSync('src/pages/Maintenance/MaintenanceImageAuditPanel.tsx', 'utf8');

  assert.match(panel, /旧导入缓存/);
  assert.match(panel, /当前不计入失效引用/);
  assert.doesNotMatch(panel, /label="Playnite 旧导入" tone=\{\(summary\?\.legacyAppDataImportRefs \?\? 0\) > 0 \? 'warn' : 'ok'\}/);
});

test('maintenance image health ui shows every health recommendation', () => {
  const panel = fs.readFileSync('src/pages/Maintenance/MaintenanceImageAuditPanel.tsx', 'utf8');

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

  assert.equal(message, '安全整理完成：已移动 12 个孤儿图片到隔离区；跳过 2 个；复查剩余 3 个孤儿图片。');
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
    '没有可补全的媒体缺图；没有可整理的孤儿图片。',
  );
  assert.equal(
    getImageHealthActionHint({ report: duplicateOnlyReport, loading: false }),
    '重复内容缓存需要先查看样本并确认引用；没有需要逐条审计的失效引用；没有可补全的媒体缺图；没有可整理的孤儿图片。',
  );
});

test('maintenance image health ui renders the action availability hint', () => {
  const panel = fs.readFileSync('src/pages/Maintenance/MaintenanceImageAuditPanel.tsx', 'utf8');

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

test('maintenance description history only loads games for legacy task logs', () => {
  const actions = fs.readFileSync('src/pages/Maintenance/useMaintenanceHistoryActions.ts', 'utf8');
  const rust = fs.readFileSync('src-tauri/src/services/metadata_description_images.rs', 'utf8');
  const mock = fs.readFileSync('src/services/mockStoreArtworkRepair.ts', 'utf8');

  assert.match(actions, /descriptionImageRepairLogsNeedSourceLookup/);
  assert.match(actions, /const details = await Promise\.all\(tasks\.map\(async \(task\) => api\.getTaskDetail\(task\.id\)\)\)/);
  assert.match(actions, /const needsSourceLookup = details\.some\(\(detail\) => descriptionImageRepairLogsNeedSourceLookup\(detail\.logs\)\)/);
  assert.match(actions, /needsSourceLookup\s*\?\s*await api\.listGames\(\{ sortBy: 'updated_at', sortDirection: 'desc' \}\)\s*:\s*\[\]/);
  assert.match(rust, /"已修复：\{\} \[\{\}\]，\{\} \{\}，插入 \{\} 张图片。"/);
  assert.match(mock, /`已修复：\$\{candidate\.title\} \[\$\{candidate\.gameId\}\]，\$\{candidate\.provider\} \$\{candidate\.providerId\}，插入 1 张图片。`/);
});
