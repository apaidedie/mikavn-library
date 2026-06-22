const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REQUIRED_REPORT_TOKENS = [
  'npm run release:validate:core',
  'npm run smoke:browser',
  'npm run smoke:large',
  'Large library performance warnings',
  'npm run tauri:build',
  'npm run smoke:install',
  'npm run smoke:portable-data',
  'npm run smoke:real-data:readonly',
  'npm run smoke:real-install:update',
  'Target install directory',
  'Post-install SQLite `quick_check`: ok',
  'Real installed exe',
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
  'Evidence:',
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

const REQUIRED_PASSED_COMMANDS = [
  'npm run release:validate:core',
  'npm run smoke:browser',
  'npm run smoke:large',
  'npm run smoke:install',
  'npm run smoke:portable-data',
  'npm run smoke:real-data:readonly',
  'npm run smoke:real-install:update',
  'npm run smoke:desktop',
  'npm run release:handoff:check',
];

function defaultReleaseDir() {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const { version } = readReleaseMetadata(repoRoot);
  return path.join(repoRoot, 'output', 'release', `${version}-windows-x64`);
}

function readReleaseMetadata(repoRoot = path.resolve(__dirname, '..', '..')) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const tauriConfig = JSON.parse(fs.readFileSync(path.join(repoRoot, 'src-tauri', 'tauri.conf.json'), 'utf8'));
  return {
    productName: tauriConfig.productName || 'MikaVN Library',
    version: packageJson.version,
  };
}

function requiredReleaseFiles(repoRoot = path.resolve(__dirname, '..', '..')) {
  const { productName, version } = readReleaseMetadata(repoRoot);
  return [
    'mikavn-library.exe',
    `${productName}_${version}_x64-setup.exe`,
    'SHA256SUMS.txt',
    'RELEASE_VALIDATION_REPORT.md',
    'MANUAL_RISK_PASS_CHECKLIST.md',
  ];
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

function commandMarkedPassed(report, command) {
  const escaped = command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`\`${escaped}\`\\s*:\\s*(?:passed|PASS|ok|OK)\\b`, 'i'),
    new RegExp(`^\\s*-?\\s*${escaped}\\s*:\\s*(?:passed|PASS|ok|OK)\\b`, 'im'),
  ];
  return patterns.some((pattern) => pattern.test(report));
}

function requirePassedCommands(report) {
  for (const command of REQUIRED_PASSED_COMMANDS) {
    if (!commandMarkedPassed(report, command)) throw new Error(`release validation report must mark required command as passed: ${command}`);
  }
}

function buildModeFromReport(report) {
  if (commandMarkedPassed(report, 'npm run tauri:build')) return 'updater-capable';
  if (commandMarkedPassed(report, 'npm run tauri:build:local')) return 'local-unsigned';
  throw new Error('release validation report must mark npm run tauri:build or npm run tauri:build:local as passed');
}

function largeLibraryWarningCountFromReport(report) {
  const match = /Large library performance warnings:\s*(\d+)\b/i.exec(report);
  if (!match) {
    throw new Error('release validation report must record a numeric large library performance warning count');
  }
  return Number(match[1]);
}

function manualRiskChecklistSummary(checklist) {
  const checkboxMatches = [...checklist.matchAll(/^\s*-\s*\[( |x|X)\]\s+(.+?)\s*$/gm)];
  const checkedItems = [];
  const pendingItems = [];
  for (const match of checkboxMatches) {
    const { item, evidence } = splitManualRiskChecklistItem(match[2]);
    if (match[1].toLowerCase() === 'x') {
      if (!evidence) {
        throw new Error(`checked manual risk checklist item must include evidence: ${item}`);
      }
      checkedItems.push(item);
    } else {
      pendingItems.push(item);
    }
  }
  const total = checkboxMatches.length;
  const checked = checkedItems.length;
  return {
    total,
    checked,
    pending: total - checked,
    checkedItems,
    pendingItems,
  };
}

function blockingReleaseRisks({ signingStatus, manualRiskChecklist, buildMode, largeLibraryPerformanceWarnings = 0 }) {
  const risks = [];
  if (buildMode !== 'updater-capable') {
    risks.push({
      code: 'not-updater-capable',
      message: 'Release handoff was built with tauri:build:local; public in-app updates require npm run tauri:build updater artifacts.',
      buildMode,
    });
  }
  if (signingStatus === 'documented-unsigned') {
    risks.push({
      code: 'unsigned-windows-artifacts',
      message: 'Windows artifacts are documented as unsigned; public release should use a trusted signing certificate.',
    });
  }
  if (largeLibraryPerformanceWarnings > 0) {
    risks.push({
      code: 'large-library-performance-warnings',
      message: `Large-library smoke recorded ${largeLibraryPerformanceWarnings} performance warning(s); inspect the large-library report before public release.`,
      warningCount: largeLibraryPerformanceWarnings,
    });
  }
  if (manualRiskChecklist.pending > 0) {
    risks.push({
      code: 'manual-risk-checklist-pending',
      message: `Manual release risk checklist has ${manualRiskChecklist.pending} pending item(s).`,
      pendingItems: manualRiskChecklist.pendingItems,
    });
  }
  return risks;
}

function requireNoBlockingReleaseRisks(risks) {
  if (risks.length === 0) return;
  throw new Error(`release handoff has blocking public release risk(s): ${risks.map((risk) => risk.code).join(', ')}`);
}

function splitManualRiskChecklistItem(value) {
  const trimmed = value.trim();
  const match = /\s+(?:Evidence|证据)\s*[:：]\s*(.+)$/i.exec(trimmed);
  if (!match) return { item: trimmed, evidence: '' };
  return {
    item: trimmed.slice(0, match.index).trim(),
    evidence: match[1].trim(),
  };
}

function checkReleaseHandoff(options = {}) {
  const releaseDir = path.resolve(options.releaseDir || process.env.MIKAVN_RELEASE_HANDOFF_DIR || defaultReleaseDir());
  if (!fs.existsSync(releaseDir) || !fs.statSync(releaseDir).isDirectory()) {
    throw new Error(`release handoff directory not found: ${releaseDir}`);
  }

  const requiredFiles = requiredReleaseFiles().map((fileName) => {
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
  requirePassedCommands(report);
  const buildMode = buildModeFromReport(report);
  const signingStatus = signingStatusFromReport(report);
  const largeLibraryPerformanceWarnings = largeLibraryWarningCountFromReport(report);

  const checklist = fs.readFileSync(path.join(releaseDir, 'MANUAL_RISK_PASS_CHECKLIST.md'), 'utf8');
  requireTokens(checklist, REQUIRED_CHECKLIST_TOKENS, 'manual risk checklist');
  const manualRiskChecklist = manualRiskChecklistSummary(checklist);
  const manualRiskStatus = manualRiskChecklist.pending === 0 ? 'passed' : 'checklist-pending';
  const blockingRisks = blockingReleaseRisks({ signingStatus, manualRiskChecklist, buildMode, largeLibraryPerformanceWarnings });
  if (options.requirePublicReady) requireNoBlockingReleaseRisks(blockingRisks);

  return {
    releaseDir,
    artifacts,
    requiredFiles,
    buildMode,
    signingStatus,
    largeLibraryPerformanceWarnings,
    manualRiskStatus,
    manualRiskChecklist,
    blockingReleaseRisks: blockingRisks,
  };
}

if (require.main === module) {
  try {
    const result = checkReleaseHandoff({
      requirePublicReady: process.argv.includes('--require-public-ready'),
    });
    console.log(JSON.stringify({
      releaseDir: result.releaseDir,
      artifacts: result.artifacts,
      requiredFiles: result.requiredFiles.length,
      buildMode: result.buildMode,
      signingStatus: result.signingStatus,
      largeLibraryPerformanceWarnings: result.largeLibraryPerformanceWarnings,
      manualRiskStatus: result.manualRiskStatus,
      manualRiskChecklist: result.manualRiskChecklist,
      blockingReleaseRisks: result.blockingReleaseRisks,
    }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = { checkReleaseHandoff };
