const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadImageSrc() {
  const sourcePath = path.join(__dirname, '..', 'src', 'utils', 'imageSrc.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const module = { exports: {} };
  const fn = new Function('module', 'exports', 'require', transpiled);
  global.window = { __TAURI_INTERNALS__: {} };
  try {
    fn(module, module.exports, (specifier) => {
      if (specifier === '@tauri-apps/api/core') {
        return { convertFileSrc: (value) => `asset://${value}` };
      }
      return require(specifier);
    });
  } finally {
    delete global.window;
  }
  return module.exports;
}

test('imageSrc uses MikaVN image protocol for local Windows app-data images in Tauri', () => {
  const { imageSrc } = loadImageSrc();

  assert.equal(
    imageSrc('E:\\MikaVN Library\\app-data\\images\\VN Cover 01.jpg'),
    'http://mikavn-image.localhost/E%3A%5CMikaVN%20Library%5Capp-data%5Cimages%5CVN%20Cover%2001.jpg',
  );
});

test('imageSrc lets Tauri asset protocol handle external local image paths', () => {
  const { imageSrc } = loadImageSrc();

  assert.equal(
    imageSrc('C:\\Users\\Asus\\Pictures\\VN Cover 01.jpg'),
    'asset://C:\\Users\\Asus\\Pictures\\VN Cover 01.jpg',
  );
});

test('imageSrc keeps web-safe image URLs unchanged', () => {
  const { imageSrc } = loadImageSrc();

  assert.equal(imageSrc('https://example.com/cover.jpg'), 'https://example.com/cover.jpg');
  assert.equal(imageSrc('data:image/png;base64,abc'), 'data:image/png;base64,abc');
});
