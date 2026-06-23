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

function loadGameDetailMediaModel() {
  const sourcePath = path.join(__dirname, '..', 'src', 'pages', 'Library', 'gameDetailMediaModel.ts');
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

function gameFixture() {
  return {
    id: 'game-1',
    title: '图片测试游戏',
    originalTitle: null,
    aliases: [],
    developer: '测试会社',
    publisher: null,
    brand: null,
    releaseDate: null,
    description: '简介 ![cg](E:\\MikaVN Library\\app-data\\images\\cg.jpg)',
    notes: null,
    tags: [],
    genres: [],
    rating: null,
    ageRating: null,
    playStatus: 'playing',
    favorite: false,
    hidden: false,
    installPath: 'E:\\Games\\VN',
    executablePath: 'E:\\Games\\VN\\game.exe',
    workingDirectory: null,
    launchArgs: null,
    pathStatus: 'ok',
    coverImage: 'E:\\MikaVN Library\\app-data\\images\\cover.jpg',
    bannerImage: '',
    backgroundImage: 'https://example.invalid/bg.jpg',
    vndbId: null,
    bangumiId: null,
    dlsiteId: null,
    fanzaId: null,
    ymgalId: null,
    totalPlaySeconds: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

test('game image diagnostic text captures fields audit counts and samples', () => {
  const { formatGameImageDiagnostic } = loadGameDetailMediaModel();
  const audit = {
    totalRefs: 3,
    issueCount: 2,
    localCount: 2,
    remoteCount: 1,
    missingCount: 1,
    cDriveCount: 0,
    playniteCount: 1,
    truncated: false,
    items: [
      {
        gameId: 'game-1',
        gameTitle: '图片测试游戏',
        sourceKind: 'game',
        sourceLabel: '游戏',
        fieldName: 'cover_image',
        value: 'E:\\MikaVN Library\\app-data\\images\\missing.jpg',
        resolvedPath: 'E:\\MikaVN Library\\app-data\\images\\missing.jpg',
        status: 'missing',
        issues: ['missing'],
      },
      {
        gameId: 'game-1',
        gameTitle: '图片测试游戏',
        sourceKind: 'game_assets',
        sourceLabel: '图库',
        fieldName: 'game_assets.uri',
        value: 'E:\\MikaVN Library\\app-data\\images\\playnite-import\\old.jpg',
        resolvedPath: 'E:\\MikaVN Library\\app-data\\images\\playnite-import\\old.jpg',
        status: 'warning',
        issues: ['playnite'],
      },
    ],
  };

  const text = formatGameImageDiagnostic(gameFixture(), audit);

  assert.match(text, /MikaVN 图片诊断/);
  assert.match(text, /游戏：图片测试游戏 \(game-1\)/);
  assert.match(text, /封面：E:\\MikaVN Library\\app-data\\images\\cover\.jpg/);
  assert.match(text, /横幅：\(空\)/);
  assert.match(text, /背景：https:\/\/example\.invalid\/bg\.jpg/);
  assert.match(text, /简介图片：1 张引用/);
  assert.match(text, /引用总数：3/);
  assert.match(text, /问题引用：2/);
  assert.match(text, /缺失：1/);
  assert.match(text, /Playnite：1/);
  assert.match(text, /问题样本/);
  assert.match(text, /封面 \[缺失\]/);
  assert.match(text, /图库 \[Playnite\]/);
  assert.match(text, /维护入口：维护中心 -> 图片健康 \/ 图片引用审计/);
});

test('game image diagnostic text redacts copied secrets and Windows user names', () => {
  const { formatGameImageDiagnostic } = loadGameDetailMediaModel();
  const game = {
    ...gameFixture(),
    installPath: String.raw`C:\Users\alice\Games\private-vn token:abc`,
    coverImage: String.raw`C:\Users\alice\AppData\Local\MikaVN\cover.jpg`,
  };
  const audit = {
    totalRefs: 1,
    issueCount: 1,
    localCount: 1,
    remoteCount: 0,
    missingCount: 1,
    cDriveCount: 1,
    playniteCount: 0,
    truncated: false,
    items: [
      {
        gameId: 'game-1',
        gameTitle: '图片测试游戏',
        sourceKind: 'game',
        sourceLabel: '游戏',
        fieldName: 'cover_image',
        value: String.raw`password=hunter2 C:\Users\bob\AppData\Local\MikaVN\missing.jpg`,
        resolvedPath: String.raw`C:/Users/bob/AppData/Roaming/MikaVN/missing.jpg?api_key=secret`,
        status: 'missing',
        issues: ['missing', 'c_drive'],
      },
    ],
  };

  const text = formatGameImageDiagnostic(game, audit);

  assert.match(text, /\[redacted\]/);
  assert.match(text, /C:\\Users\\\[user\]\\Games/);
  assert.match(text, /C:\/Users\/\[user\]\/AppData/);
  assert.doesNotMatch(text, /abc|hunter2|secret|alice|bob/);
});

test('description image rendering keeps text while limiting initial image nodes', () => {
  const { getVisibleDescriptionParts } = loadGameDetailMediaModel();
  const parts = [
    { type: 'text', value: '开头' },
    { type: 'image', src: 'one.jpg' },
    { type: 'text', value: '中间' },
    { type: 'image', src: 'two.jpg' },
    { type: 'image', src: 'three.jpg' },
    { type: 'text', value: '结尾' },
  ];

  const result = getVisibleDescriptionParts(parts, 2);

  assert.deepEqual(result.visibleParts, [
    { type: 'text', value: '开头' },
    { type: 'image', src: 'one.jpg' },
    { type: 'text', value: '中间' },
    { type: 'image', src: 'two.jpg' },
    { type: 'text', value: '结尾' },
  ]);
  assert.equal(result.renderedImageCount, 2);
  assert.equal(result.hiddenImageCount, 1);
  assert.equal(result.totalImageCount, 3);
});

test('description image rendering can opt in to all images', () => {
  const { getVisibleDescriptionParts } = loadGameDetailMediaModel();
  const parts = [
    { type: 'image', src: 'one.jpg' },
    { type: 'image', src: 'two.jpg' },
  ];

  const result = getVisibleDescriptionParts(parts, Number.POSITIVE_INFINITY);

  assert.equal(result.visibleParts.length, 2);
  assert.equal(result.renderedImageCount, 2);
  assert.equal(result.hiddenImageCount, 0);
  assert.equal(result.totalImageCount, 2);
});

test('game detail media UI exposes copyable image diagnostics', () => {
  const media = fs.readFileSync('src/pages/Library/GameDetailMedia.tsx', 'utf8');
  const overview = fs.readFileSync('src/pages/Library/GameDetailOverview.tsx', 'utf8');
  const detail = fs.readFileSync('src/pages/Library/GameDetail.tsx', 'utf8');
  const actions = fs.readFileSync('src/pages/Library/useGameDetailActions.ts', 'utf8');

  assert.match(media, /onCopyDiagnostics/);
  assert.match(media, /复制图片诊断/);
  assert.match(overview, /onCopyImageDiagnostic/);
  assert.match(overview, /onCopyDiagnostics=\{onCopyImageDiagnostic\}/);
  assert.match(detail, /onCopyImageDiagnostic=\{\(\) => void actions\.copyImageDiagnostic\(\)\}/);
  assert.match(actions, /formatGameImageDiagnostic\(game, imageAudit\)/);
  assert.match(actions, /navigator\.clipboard\.writeText\(diagnostic\)/);
  assert.match(actions, /已复制图片诊断信息/);
});
