const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function callReadInitialView(savedView) {
  const sourcePath = path.join(__dirname, '..', 'src', 'app', 'appNavigation.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const previousWindow = global.window;
  global.window = {
    localStorage: {
      getItem(key) {
        return key === 'mikavn.currentView' ? savedView : null;
      },
    },
  };

  try {
    const module = { exports: {} };
    const requireMock = (id) => {
      if (id === 'lucide-react') return {};
      return require(id);
    };
    const fn = new Function('module', 'exports', 'require', transpiled);
    fn(module, module.exports, requireMock);
    return module.exports.readInitialView();
  } finally {
    global.window = previousWindow;
  }
}

test('readInitialView opens the personal dashboard when no saved view exists', () => {
  assert.equal(callReadInitialView(null), 'dashboard');
});

test('readInitialView restores valid saved views', () => {
  assert.equal(callReadInitialView('scanner'), 'scanner');
});

test('readInitialView falls back to the dashboard for invalid saved views', () => {
  assert.equal(callReadInitialView('legacy-unknown-view'), 'dashboard');
});
