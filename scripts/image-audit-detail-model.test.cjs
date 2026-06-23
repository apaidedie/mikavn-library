const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '..');
const modelPath = path.join(repoRoot, 'src', 'pages', 'Maintenance', 'imageAuditDetailModel.ts');

function loadModel() {
  const source = fs.readFileSync(modelPath, 'utf8');
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

function item(overrides) {
  return {
    gameId: 'game-a',
    gameTitle: '星之终途',
    sourceKind: 'game',
    sourceLabel: '封面',
    fieldName: 'coverImage',
    value: String.raw`E:\missing\cover.jpg`,
    resolvedPath: String.raw`E:\missing\cover.jpg`,
    status: 'missing',
    issues: ['missing'],
    ...overrides,
  };
}

test('image audit detail model matches localized issue labels and recommendations', () => {
  const { matchesImageAuditItem } = loadModel();
  const cDriveItem = item({
    sourceLabel: '背景',
    fieldName: 'backgroundImage',
    value: String.raw`C:\Users\alice\Pictures\bg.png`,
    resolvedPath: String.raw`C:\Users\alice\Pictures\bg.png`,
    status: 'warning',
    issues: ['c_drive'],
  });

  assert.equal(matchesImageAuditItem(cDriveItem, 'C 盘', 'all'), true);
  assert.equal(matchesImageAuditItem(cDriveItem, '完全不存在的关键词', 'all'), false);
  assert.equal(matchesImageAuditItem(cDriveItem, '复制到 MikaVN 图片缓存', 'all'), true);
  assert.equal(matchesImageAuditItem(cDriveItem, '背景字段', 'all'), true);
  assert.equal(matchesImageAuditItem(cDriveItem, '', 'c_drive'), true);
  assert.equal(matchesImageAuditItem(cDriveItem, '', 'missing'), false);
});

test('image audit detail model summarizes source and game issue distribution', () => {
  const { summarizeImageAuditGames, summarizeImageAuditSources } = loadModel();
  const items = [
    item({ gameId: 'game-a', gameTitle: '星之终途', fieldName: 'coverImage', sourceLabel: '封面', issues: ['missing'] }),
    item({ gameId: 'game-a', gameTitle: '星之终途', fieldName: 'backgroundImage', sourceLabel: '背景', issues: ['c_drive'] }),
    item({ gameId: 'game-b', gameTitle: '水仙', fieldName: 'description', sourceKind: 'description', sourceLabel: '简介', issues: ['playnite'] }),
    item({ gameId: 'game-c', gameTitle: '无问题', issues: [] }),
  ];

  assert.deepEqual(summarizeImageAuditSources(items).map((summary) => ({
    key: summary.key,
    label: summary.label,
    issueCount: summary.issueCount,
    missingCount: summary.missingCount,
    cDriveCount: summary.cDriveCount,
    playniteCount: summary.playniteCount,
  })), [
    { key: 'background', label: '背景', issueCount: 1, missingCount: 0, cDriveCount: 1, playniteCount: 0 },
    { key: 'cover', label: '封面', issueCount: 1, missingCount: 1, cDriveCount: 0, playniteCount: 0 },
    { key: 'description', label: '简介图片', issueCount: 1, missingCount: 0, cDriveCount: 0, playniteCount: 1 },
  ]);

  assert.deepEqual(summarizeImageAuditGames(items).map((summary) => ({
    gameId: summary.gameId,
    title: summary.title,
    issueCount: summary.issueCount,
    sourceLabels: summary.sourceLabels,
    issues: summary.issues,
  })), [
    { gameId: 'game-a', title: '星之终途', issueCount: 2, sourceLabels: ['封面', '背景'], issues: ['missing', 'c_drive'] },
    { gameId: 'game-b', title: '水仙', issueCount: 1, sourceLabels: ['简介图片'], issues: ['playnite'] },
  ]);
});

test('image audit detail panel delegates pure derivation to model', () => {
  const panel = fs.readFileSync(path.join(repoRoot, 'src', 'pages', 'Maintenance', 'ImageAuditDetailPanel.tsx'), 'utf8');

  assert.match(panel, /from '\.\/imageAuditDetailModel'/);
  assert.doesNotMatch(panel, /export function summarizeImageAuditSources/);
  assert.doesNotMatch(panel, /export function summarizeImageAuditGames/);
  assert.doesNotMatch(panel, /export function matchesImageAuditItem/);
});
