const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_SOURCE_BUDGETS = [
  {
    filePath: path.resolve(__dirname, '..', '..', 'src', 'services', 'mockStore.ts'),
    maxBytes: 108 * 1024,
    maxLines: 2250,
  },
  {
    filePath: path.resolve(__dirname, '..', '..', 'src', 'pages', 'Maintenance', 'MaintenancePage.tsx'),
    maxBytes: 85 * 1024,
    maxLines: 430,
  },
  {
    filePath: path.resolve(__dirname, '..', '..', 'src', 'pages', 'Library', 'GameDetail.tsx'),
    maxBytes: 48 * 1024,
    maxLines: 1000,
  },
  {
    filePath: path.resolve(__dirname, '..', '..', 'src', 'pages', 'Library', 'LibraryPage.tsx'),
    maxBytes: 44 * 1024,
    maxLines: 520,
  },
  {
    filePath: path.resolve(__dirname, '..', '..', 'src', 'pages', 'Library', 'GameForm.tsx'),
    maxBytes: 32 * 1024,
    maxLines: 430,
  },
  {
    filePath: path.resolve(__dirname, '..', '..', 'src', 'pages', 'Tasks', 'TasksPage.tsx'),
    maxBytes: 32 * 1024,
    maxLines: 460,
  },
  {
    filePath: path.resolve(__dirname, '..', '..', 'src', 'pages', 'Scanner', 'ScannerPage.tsx'),
    maxBytes: 32 * 1024,
    maxLines: 440,
  },
  {
    filePath: path.resolve(__dirname, '..', '..', 'src', 'pages', 'Metadata', 'BatchMetadataPage.tsx'),
    maxBytes: 32 * 1024,
    maxLines: 425,
  },
  {
    filePath: path.resolve(__dirname, '..', '..', 'src', 'pages', 'Settings', 'SettingsPage.tsx'),
    maxBytes: 44 * 1024,
    maxLines: 820,
  },
  {
    filePath: path.resolve(__dirname, '..', '..', 'src-tauri', 'src', 'services', 'archives.rs'),
    maxBytes: 70 * 1024,
    maxLines: 1950,
  },
  {
    filePath: path.resolve(__dirname, '..', '..', 'src-tauri', 'src', 'services', 'diagnostics.rs'),
    maxBytes: 52 * 1024,
    maxLines: 1525,
  },
  {
    filePath: path.resolve(__dirname, '..', '..', 'src-tauri', 'src', 'db', 'game_merge_ext.rs'),
    maxBytes: 44 * 1024,
    maxLines: 1200,
  },
  {
    filePath: path.resolve(__dirname, '..', '..', 'src-tauri', 'src', 'services', 'saves.rs'),
    maxBytes: 40 * 1024,
    maxLines: 1220,
  },
  {
    filePath: path.resolve(__dirname, '..', '..', 'src-tauri', 'src', 'services', 'scanner.rs'),
    maxBytes: 38 * 1024,
    maxLines: 1150,
  },
  {
    filePath: path.resolve(__dirname, '..', '..', 'scripts', 'playwright', 'page-qa-runner.cjs'),
    maxBytes: 128 * 1024,
    maxLines: 1350,
  },
  {
    filePath: path.resolve(__dirname, '..', '..', 'scripts', 'playwright', 'page-qa-fixtures.cjs'),
    maxBytes: 32 * 1024,
    maxLines: 260,
  },
];

function countLines(contents) {
  if (contents.length === 0) return 0;
  return contents
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n$/, '')
    .split('\n').length;
}

function displayPath(rootDir, filePath) {
  const relativePath = path.relative(rootDir, filePath);
  if (!relativePath || relativePath.startsWith('..')) {
    return path.basename(filePath);
  }
  return relativePath.replace(/\\/g, '/');
}

function checkSourceSize(options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, '..', '..');
  const budgets = options.budgets || DEFAULT_SOURCE_BUDGETS;
  const checkedFiles = budgets.map((budget) => {
    const filePath = path.isAbsolute(budget.filePath)
      ? budget.filePath
      : path.resolve(rootDir, budget.filePath);
    const contents = fs.readFileSync(filePath, 'utf8');
    return {
      filePath,
      displayPath: displayPath(rootDir, filePath),
      sizeBytes: Buffer.byteLength(contents, 'utf8'),
      lineCount: countLines(contents),
      maxBytes: budget.maxBytes,
      maxLines: budget.maxLines,
    };
  });

  const oversizedFiles = checkedFiles.filter((file) => file.sizeBytes > file.maxBytes || file.lineCount > file.maxLines);
  if (oversizedFiles.length > 0) {
    const summary = oversizedFiles
      .map((file) => {
        const reasons = [];
        if (file.sizeBytes > file.maxBytes) {
          reasons.push(`${file.sizeBytes} bytes > ${file.maxBytes} bytes`);
        }
        if (file.lineCount > file.maxLines) {
          reasons.push(`${file.lineCount} lines > ${file.maxLines} lines`);
        }
        return `${file.displayPath} ${reasons.join(', ')}`;
      })
      .join('; ');
    throw new Error(`source files exceed size budget: ${summary}`);
  }

  return { checkedFiles, oversizedFiles };
}

if (require.main === module) {
  try {
    const result = checkSourceSize();
    console.log(JSON.stringify({
      checkedFiles: result.checkedFiles.map((file) => ({
        filePath: file.displayPath,
        sizeBytes: file.sizeBytes,
        lineCount: file.lineCount,
        maxBytes: file.maxBytes,
        maxLines: file.maxLines,
      })),
    }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = { DEFAULT_SOURCE_BUDGETS, checkSourceSize };
