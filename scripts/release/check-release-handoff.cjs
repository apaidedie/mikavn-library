const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REQUIRED_FILES = [
  'mikavn-library.exe',
  'MikaVN.Library_0.1.1_x64-setup.exe',
  'SHA256SUMS.txt',
  'RELEASE_VALIDATION_REPORT.md',
  'MANUAL_RISK_PASS_CHECKLIST.md',
];

const REQUIRED_REPORT_TOKENS = [
  'npm run release:validate:core',
  'npm run smoke:browser',
  'npm run smoke:large',
  'npm run tauri:build',
  'npm run smoke:install',
  'npm run smoke:portable-data',
  'npm run smoke:real-data:readonly',
  'npm run smoke:desktop',
  'npm run release:handoff:check',
  'npm run release:signing:check',
  'npm run release:signing:require',
  'MANUAL_RISK_PASS_CHECKLIST.md',
  'Launch profiles',
  'Destructive-adjacent flows',
  'Privacy and logs',
  'Search UX',
];

const REQUIRED_CHECKLIST_TOKENS = [
  'Direct executable launch',
  '.lnk',
  'Custom command launch',
  'Locale Emulator-style wrapper launch',
  'Elevated launch success',
  'Elevated launch cancellation',
  'Database restore scheduling',
  'Safe archive import',
  'Full archive restore',
  'Save mirror restore',
  'Tag deletion',
  'Game record deletion',
  'Diagnostic log preview',
  'Task logs',
  'Screenshots/reports',
  'Quick title/keyword search',
  'Report shortcut search',
  'Advanced grammar disclosure',
  'Saved search',
];

function defaultReleaseDir() {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  return path.join(repoRoot, 'output', 'release', `${packageJson.version}-windows-x64`);
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function parseSha256Sums(contents) {
  const entries = new Map();
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = /^([a-fA-F0-9]{64})\s+\*?(.+)$/.exec(trimmed);
    if (!match) throw new Error(`invalid SHA256SUMS line: ${line}`);
    entries.set(match[2], match[1].toLowerCase());
  }
  return entries;
}

function requireTokens(contents, tokens, label) {
  const missing = tokens.filter((token) => !contents.includes(token));
  if (missing.length > 0) {
    throw new Error(`${label} is missing required token: ${missing.join(', ')}`);
  }
}

function signingStatusFromReport(report) {
  if (/NotSigned/.test(report) && /release:signing:require/.test(report)) {
    return 'documented-unsigned';
  }
  if (/release:signing:require[`*: ]+passed/i.test(report) || /signed.*true/i.test(report)) {
    return 'documented-signed';
  }
  throw new Error('release validation report must document signing status');
}

function checkReleaseHandoff(options = {}) {
  const releaseDir = path.resolve(options.releaseDir || process.env.MIKAVN_RELEASE_HANDOFF_DIR || defaultReleaseDir());
  if (!fs.existsSync(releaseDir) || !fs.statSync(releaseDir).isDirectory()) {
    throw new Error(`release handoff directory not found: ${releaseDir}`);
  }

  const requiredFiles = REQUIRED_FILES.map((fileName) => {
    const filePath = path.join(releaseDir, fileName);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      throw new Error(`release handoff is missing required file: ${fileName}`);
    }
    return { fileName, filePath, sizeBytes: fs.statSync(filePath).size };
  });

  const sums = parseSha256Sums(fs.readFileSync(path.join(releaseDir, 'SHA256SUMS.txt'), 'utf8'));
  const artifacts = requiredFiles
    .filter((item) => item.fileName.endsWith('.exe'))
    .map((item) => {
      const expected = sums.get(item.fileName);
      if (!expected) throw new Error(`SHA256SUMS.txt is missing ${item.fileName}`);
      const actual = sha256File(item.filePath);
      if (actual !== expected) {
        throw new Error(`checksum mismatch for ${item.fileName}: ${actual} !== ${expected}`);
      }
      return { fileName: item.fileName, sizeBytes: item.sizeBytes, sha256: actual };
    });

  const report = fs.readFileSync(path.join(releaseDir, 'RELEASE_VALIDATION_REPORT.md'), 'utf8');
  requireTokens(report, REQUIRED_REPORT_TOKENS, 'release validation report');
  const signingStatus = signingStatusFromReport(report);

  const checklist = fs.readFileSync(path.join(releaseDir, 'MANUAL_RISK_PASS_CHECKLIST.md'), 'utf8');
  requireTokens(checklist, REQUIRED_CHECKLIST_TOKENS, 'manual risk checklist');

  return {
    releaseDir,
    artifacts,
    requiredFiles,
    signingStatus,
    manualRiskStatus: 'checklist-required',
  };
}

if (require.main === module) {
  try {
    const result = checkReleaseHandoff();
    console.log(JSON.stringify({
      releaseDir: result.releaseDir,
      artifacts: result.artifacts,
      requiredFiles: result.requiredFiles.length,
      signingStatus: result.signingStatus,
      manualRiskStatus: result.manualRiskStatus,
    }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = { checkReleaseHandoff };
