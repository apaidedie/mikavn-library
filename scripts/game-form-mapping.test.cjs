const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadGameFormMapping() {
  const sourcePath = path.join(__dirname, '..', 'src', 'pages', 'Library', 'gameFormMapping.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier === '@/types/metadata') {
      return { PROVIDER_LABEL: { vndb: 'VNDB', dlsite: 'DLsite', fanza: 'FANZA' } };
    }
    throw new Error(`Unexpected require: ${specifier}`);
  };
  const fn = new Function('module', 'exports', 'require', transpiled);
  fn(module, module.exports, localRequire);
  return module.exports;
}

function form(overrides) {
  return {
    title: overrides.title ?? 'Title',
    originalTitle: '',
    aliases: '',
    developer: overrides.developer ?? '',
    publisher: overrides.publisher ?? '',
    brand: '',
    releaseDate: overrides.releaseDate ?? '',
    description: '',
    notes: '',
    tags: overrides.tags ?? '',
    genres: '',
    rating: '',
    ageRating: '',
    playStatus: 'planned',
    installPath: '',
    executablePath: '',
    workingDirectory: '',
    launchArgs: '',
    coverImage: overrides.coverImage ?? '',
    bannerImage: '',
    backgroundImage: '',
    vndbId: overrides.vndbId ?? '',
    dlsiteId: overrides.dlsiteId ?? '',
    fanzaId: overrides.fanzaId ?? '',
    bangumiId: '',
    ymgalId: '',
    favorite: false,
    hidden: false,
  };
}

test('deriveGameFormMetadataBadges returns compact preview fields in display order', () => {
  const { deriveGameFormMetadataBadges } = loadGameFormMapping();

  assert.deepEqual(deriveGameFormMetadataBadges(form({
    developer: ' Studio ',
    releaseDate: '2026-06-18',
    vndbId: ' v123 ',
    dlsiteId: 'RJ010',
    fanzaId: 'FANZA-1',
  })), ['Studio', '2026-06-18', 'VNDB v123', 'DLsite RJ010', 'FANZA FANZA-1']);
});

test('deriveGameFormMetadataBadges omits blank metadata fields', () => {
  const { deriveGameFormMetadataBadges } = loadGameFormMapping();

  assert.deepEqual(deriveGameFormMetadataBadges(form({ developer: '', releaseDate: '', vndbId: '' })), []);
});
