const crypto = require('crypto');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const REQUIRED_REPORT_TOKENS = [
  'npm run release:validate:core',
  'npm run build',
  'npm run test:diagnostic-export',
  'startup self-check warning notice',
  'npm run smoke:browser',
  'npm run smoke:large',
  'Large library performance warnings',
  'Topbar quick search',
  'npm run tauri:build',
  'npm run smoke:install',
  'npm run smoke:portable-data',
  'npm run smoke:real-data:readonly',
  'npm run smoke:real-install:update',
  'verified database backup',
  'Lower-version updater rehearsal',
  'previous version',
  'current version',
  'Target install directory',
  'Post-install SQLite `quick_check`: ok',
  'Real installed exe',
  'npm run smoke:desktop',
  'npm run release:handoff:check',
  'Signing Certificate Preflight',
  'npm run release:signing:certificate:check',
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
  'npm run build',
  'npm run test:diagnostic-export',
  'npm run smoke:browser',
  'npm run smoke:large',
  'npm run smoke:install',
  'npm run smoke:portable-data',
  'npm run smoke:real-data:readonly',
  'npm run smoke:real-install:update',
  'npm run smoke:desktop',
  'npm run release:handoff:check',
  'npm run release:signing:certificate:check',
];

const GITHUB_REPO = 'apaidedie/mikavn-library';

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

function requireFile(releaseDir, fileName, label) {
  const filePath = path.join(releaseDir, fileName);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`release handoff is missing ${label}: ${fileName}`);
  }
  return { fileName, filePath, sizeBytes: fs.statSync(filePath).size };
}

function checkedSha256(filePath, fileName, sums) {
  const expected = sums.get(fileName);
  if (!expected) throw new Error(`SHA256SUMS.txt is missing ${fileName}`);
  const actual = sha256File(filePath);
  if (actual !== expected) {
    throw new Error(`checksum mismatch for ${fileName}: ${actual} !== ${expected}`);
  }
  return actual;
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

function topbarQuickSearchMsFromReport(report) {
  const match = /Topbar quick search:\s*([\d,]+)\s*ms\b/i.exec(report);
  if (!match) {
    throw new Error('release validation report must record a numeric topbar quick search timing');
  }
  return Number(match[1].replace(/,/g, ''));
}

function parseSemanticVersion(value, label) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(value).trim());
  if (!match) throw new Error(`release validation report must record a semantic ${label}: ${value}`);
  return {
    normalized: `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`,
    parts: [Number(match[1]), Number(match[2]), Number(match[3])],
  };
}

function compareSemanticVersions(left, right) {
  for (let index = 0; index < left.parts.length; index += 1) {
    if (left.parts[index] < right.parts[index]) return -1;
    if (left.parts[index] > right.parts[index]) return 1;
  }
  return 0;
}

function resolveReleaseEvidencePath(releaseDir, evidencePath, label) {
  const cleaned = String(evidencePath || '')
    .trim()
    .replace(/^`+|`+$/g, '')
    .replace(/[.;]+$/g, '')
    .trim();
  if (!cleaned) throw new Error(`release validation report must record ${label} evidence file`);
  if (path.isAbsolute(cleaned)) throw new Error(`${label} evidence file must be relative to the release handoff directory`);
  const releaseRoot = path.resolve(releaseDir);
  const filePath = path.resolve(releaseRoot, cleaned);
  if (filePath !== releaseRoot && !filePath.startsWith(`${releaseRoot}${path.sep}`)) {
    throw new Error(`${label} evidence file must stay within the release handoff directory`);
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`${label} evidence file not found: ${cleaned}`);
  }
  return {
    evidenceFile: cleaned.replace(/\\/g, '/'),
    evidenceFilePath: filePath,
  };
}

function readJsonEvidence(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${label} evidence file is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function validateLowerVersionUpdaterRehearsalEvidence(filePath, expected) {
  const evidence = readJsonEvidence(filePath, 'lower-version updater rehearsal');
  const evidencePrevious = parseSemanticVersion(evidence.previousVersion, 'lower-version updater rehearsal evidence previousVersion');
  const evidenceCurrent = parseSemanticVersion(evidence.currentVersion, 'lower-version updater rehearsal evidence currentVersion');
  if (evidencePrevious.normalized !== expected.previousVersion) {
    throw new Error(`lower-version updater rehearsal evidence previousVersion must match report: ${evidencePrevious.normalized} !== ${expected.previousVersion}`);
  }
  if (evidenceCurrent.normalized !== expected.currentVersion) {
    throw new Error(`lower-version updater rehearsal evidence currentVersion must match report: ${evidenceCurrent.normalized} !== ${expected.currentVersion}`);
  }
  if (evidence.restartVerified !== true) {
    throw new Error('lower-version updater rehearsal evidence must record restartVerified true');
  }
  if (evidence.appDataVerified !== true) {
    throw new Error('lower-version updater rehearsal evidence must record appDataVerified true');
  }
  if (String(evidence.databaseQuickCheck || '').toLowerCase() !== 'ok') {
    throw new Error('lower-version updater rehearsal evidence must record databaseQuickCheck ok');
  }
}

function lowerVersionUpdaterRehearsalFromReport(report, expectedCurrentVersion, releaseDir) {
  const lineMatch = /^.*Lower-version updater rehearsal:\s*passed\.[^\r\n]*$/im.exec(report);
  const line = lineMatch?.[0] ?? '';
  const match = /Lower-version updater rehearsal:\s*passed\.[^\r\n]*previous version:\s*(v?\d+\.\d+\.\d+)[^\r\n]*current version:\s*(v?\d+\.\d+\.\d+)/i.exec(line);
  if (!match) {
    throw new Error('release validation report must record lower-version updater rehearsal previous and current semantic versions');
  }
  const normalizedLine = line.toLowerCase();
  if (!normalizedLine.includes('restart') || !normalizedLine.includes('app-data')) {
    throw new Error('release validation report must record lower-version updater rehearsal restart and app-data verification');
  }
  if (!normalizedLine.includes('quick_check') || !/\b(ok|passed)\b/.test(normalizedLine)) {
    throw new Error('release validation report must record lower-version updater rehearsal SQLite quick_check ok');
  }
  const previousVersion = parseSemanticVersion(match[1], 'previous version');
  const currentVersion = parseSemanticVersion(match[2], 'current version');
  const expectedCurrent = parseSemanticVersion(expectedCurrentVersion, 'current release version');
  if (currentVersion.normalized !== expectedCurrent.normalized) {
    throw new Error(`lower-version updater rehearsal current version must match release version: ${currentVersion.normalized} !== ${expectedCurrent.normalized}`);
  }
  if (compareSemanticVersions(previousVersion, currentVersion) >= 0) {
    throw new Error(`lower-version updater rehearsal previous version must be lower than current version: ${previousVersion.normalized} >= ${currentVersion.normalized}`);
  }
  const evidenceMatch = /\bEvidence:\s*([^\r\n]+?)\s*$/i.exec(line);
  if (!evidenceMatch) {
    throw new Error('release validation report must record lower-version updater rehearsal evidence file');
  }
  const { evidenceFile, evidenceFilePath } = resolveReleaseEvidencePath(releaseDir, evidenceMatch[1], 'lower-version updater rehearsal');
  validateLowerVersionUpdaterRehearsalEvidence(evidenceFilePath, {
    previousVersion: previousVersion.normalized,
    currentVersion: currentVersion.normalized,
  });
  return {
    previousVersion: previousVersion.normalized,
    currentVersion: currentVersion.normalized,
    evidenceFile,
  };
}

function cleanRiskCode(value) {
  return value
    .trim()
    .replace(/^`+|`+$/g, '')
    .replace(/[.;]+$/g, '')
    .trim();
}

function signingCertificatePreflightFromReport(report) {
  const riskMatch = /Signing certificate preflight risks:\s*([^\r\n]+)/i.exec(report);
  if (riskMatch) {
    const preflightRisks = riskMatch[1]
      .split(',')
      .map(cleanRiskCode)
      .filter(Boolean);
    return {
      publicReleaseCertificateCandidates: preflightRisks.includes('no-trusted-code-signing-certificate') ? 0 : null,
      preflightRisks,
    };
  }

  const candidatesMatch = /Public release certificate candidates:\s*(\d+)\b/i.exec(report);
  if (candidatesMatch) {
    const publicReleaseCertificateCandidates = Number(candidatesMatch[1]);
    return {
      publicReleaseCertificateCandidates,
      preflightRisks: publicReleaseCertificateCandidates > 0 ? [] : ['no-trusted-code-signing-certificate'],
    };
  }

  throw new Error('release validation report must record signing certificate preflight risks or a public release certificate candidate count');
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

function blockingReleaseRisks({
  signingStatus,
  signingCertificatePreflight,
  manualRiskChecklist,
  buildMode,
  largeLibraryPerformanceWarnings = 0,
}) {
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
  if (
    signingCertificatePreflight.preflightRisks.includes('no-trusted-code-signing-certificate')
    || signingCertificatePreflight.publicReleaseCertificateCandidates === 0
  ) {
    risks.push({
      code: 'no-trusted-code-signing-certificate',
      message: 'Signing certificate preflight did not find a trusted public release code-signing certificate candidate.',
      preflightRisks: signingCertificatePreflight.preflightRisks,
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

function requireUpdaterArtifacts({ releaseDir, installerName, sums }) {
  const signatureArtifact = requireFile(releaseDir, `${installerName}.sig`, 'required updater artifact');
  const latestArtifact = requireFile(releaseDir, 'latest.json', 'required updater artifact');
  const signatureSha256 = checkedSha256(signatureArtifact.filePath, signatureArtifact.fileName, sums);
  const latestSha256 = checkedSha256(latestArtifact.filePath, latestArtifact.fileName, sums);
  const signature = fs.readFileSync(signatureArtifact.filePath, 'utf8').trim();
  let metadata;
  try {
    metadata = JSON.parse(fs.readFileSync(latestArtifact.filePath, 'utf8'));
  } catch (error) {
    throw new Error(`updater metadata artifact is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (metadata.platforms?.['windows-x86_64']?.signature !== signature) {
    throw new Error('updater metadata signature does not match installer .sig artifact');
  }
  const metadataUrl = String(metadata.platforms?.['windows-x86_64']?.url || '');
  const acceptableInstallerNames = [
    installerName,
    encodeURIComponent(installerName),
    installerName.replace(/\s+/g, '.'),
  ];
  if (!acceptableInstallerNames.some((name) => metadataUrl.includes(name))) {
    throw new Error(`updater metadata URL must reference installer artifact: ${installerName}`);
  }

  return [
    { ...signatureArtifact, sha256: signatureSha256 },
    { ...latestArtifact, sha256: latestSha256 },
  ];
}

function requireNoBlockingReleaseRisks(risks) {
  if (risks.length === 0) return;
  throw new Error(`release handoff has blocking public release risk(s): ${risks.map((risk) => risk.code).join(', ')}`);
}

function normalizePublicAssetDigest(value) {
  const digest = String(value || '').trim().toLowerCase();
  return digest.startsWith('sha256:') ? digest.slice('sha256:'.length) : digest;
}

function readPublicReleaseAssetsFromGitHub(version) {
  const result = childProcess.spawnSync('gh', [
    'release',
    'view',
    `v${version}`,
    '--repo',
    GITHUB_REPO,
    '--json',
    'assets',
  ], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || '').trim();
    throw new Error(`failed to read GitHub release assets for v${version}: ${message || `exit ${result.status}`}`);
  }
  const parsed = JSON.parse(result.stdout);
  return parsed.assets || [];
}

function expectedPublicReleaseArtifacts({ releaseDir, installerName }) {
  return [
    installerName,
    `${installerName}.sig`,
    'latest.json',
    'SHA256SUMS.txt',
    'RELEASE_VALIDATION_REPORT.md',
    'MANUAL_RISK_PASS_CHECKLIST.md',
  ].map((fileName) => {
    const filePath = path.join(releaseDir, fileName);
    return {
      fileName,
      sizeBytes: fs.statSync(filePath).size,
      sha256: sha256File(filePath),
    };
  });
}

function publicReleaseAssetRisks({ releaseDir, installerName, publicReleaseAssets }) {
  const byName = new Map(publicReleaseAssets.map((asset) => [asset.name, asset]));
  const risks = [];
  for (const expected of expectedPublicReleaseArtifacts({ releaseDir, installerName })) {
    const actual = byName.get(expected.fileName);
    if (!actual) {
      risks.push({
        code: 'public-release-asset-missing',
        message: `GitHub Release is missing public asset ${expected.fileName}.`,
        fileName: expected.fileName,
      });
      continue;
    }
    if (Number(actual.size) !== expected.sizeBytes) {
      risks.push({
        code: 'public-release-asset-size-mismatch',
        message: `GitHub Release asset size drifted for ${expected.fileName}.`,
        fileName: expected.fileName,
        expectedSizeBytes: expected.sizeBytes,
        actualSizeBytes: Number(actual.size),
      });
    }
    const actualDigest = normalizePublicAssetDigest(actual.digest);
    if (!actualDigest || actualDigest !== expected.sha256) {
      risks.push({
        code: 'public-release-asset-digest-mismatch',
        message: `GitHub Release asset digest drifted for ${expected.fileName}.`,
        fileName: expected.fileName,
        expectedSha256: expected.sha256,
        actualSha256: actualDigest || null,
      });
    }
  }
  return risks;
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

  const requiredFiles = requiredReleaseFiles().map((fileName) => requireFile(releaseDir, fileName, 'required file'));

  const sums = parseSha256Sums(fs.readFileSync(path.join(releaseDir, 'SHA256SUMS.txt'), 'utf8'));
  const artifacts = requiredFiles
    .filter((item) => item.fileName.endsWith('.exe'))
    .map((item) => {
      const actual = checkedSha256(item.filePath, item.fileName, sums);
      return { fileName: item.fileName, sizeBytes: item.sizeBytes, sha256: actual };
    });

  const report = fs.readFileSync(path.join(releaseDir, 'RELEASE_VALIDATION_REPORT.md'), 'utf8');
  requireTokens(report, REQUIRED_REPORT_TOKENS, 'release validation report');
  requirePassedCommands(report);
  const buildMode = buildModeFromReport(report);
  const signingStatus = signingStatusFromReport(report);
  const signingCertificatePreflight = signingCertificatePreflightFromReport(report);
  const largeLibraryPerformanceWarnings = largeLibraryWarningCountFromReport(report);
  const topbarQuickSearchMs = topbarQuickSearchMsFromReport(report);
  const lowerVersionUpdaterRehearsal = lowerVersionUpdaterRehearsalFromReport(report, readReleaseMetadata().version, releaseDir);
  const installerArtifact = artifacts.find((artifact) => artifact.fileName.endsWith('_x64-setup.exe'));
  const updaterArtifacts = buildMode === 'updater-capable'
    ? requireUpdaterArtifacts({
      releaseDir,
      installerName: installerArtifact.fileName,
      sums,
    })
    : [];

  const checklist = fs.readFileSync(path.join(releaseDir, 'MANUAL_RISK_PASS_CHECKLIST.md'), 'utf8');
  requireTokens(checklist, REQUIRED_CHECKLIST_TOKENS, 'manual risk checklist');
  const manualRiskChecklist = manualRiskChecklistSummary(checklist);
  const manualRiskStatus = manualRiskChecklist.pending === 0 ? 'passed' : 'checklist-pending';
  const blockingRisks = blockingReleaseRisks({
    signingStatus,
    signingCertificatePreflight,
    manualRiskChecklist,
    buildMode,
    largeLibraryPerformanceWarnings,
  });
  if (options.requirePublicReady && blockingRisks.length === 0) {
    let publicReleaseAssets;
    try {
      publicReleaseAssets = options.publicReleaseAssets || readPublicReleaseAssetsFromGitHub(readReleaseMetadata().version);
      blockingRisks.push(...publicReleaseAssetRisks({
        releaseDir,
        installerName: installerArtifact.fileName,
        publicReleaseAssets,
      }));
    } catch (error) {
      blockingRisks.push({
        code: 'public-release-assets-unavailable',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  if (options.requirePublicReady) requireNoBlockingReleaseRisks(blockingRisks);

  return {
    releaseDir,
    artifacts,
    updaterArtifacts,
    requiredFiles,
    buildMode,
    signingStatus,
    signingCertificatePreflight,
    largeLibraryPerformanceWarnings,
    topbarQuickSearchMs,
    lowerVersionUpdaterRehearsal,
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
      updaterArtifacts: result.updaterArtifacts,
      requiredFiles: result.requiredFiles.length,
      buildMode: result.buildMode,
      signingStatus: result.signingStatus,
      signingCertificatePreflight: result.signingCertificatePreflight,
      largeLibraryPerformanceWarnings: result.largeLibraryPerformanceWarnings,
      topbarQuickSearchMs: result.topbarQuickSearchMs,
      lowerVersionUpdaterRehearsal: result.lowerVersionUpdaterRehearsal,
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
