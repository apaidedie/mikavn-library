const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { checkReleaseHandoff } = require('./check-release-handoff.cjs');

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function sha256(contents) {
  return crypto.createHash('sha256').update(contents).digest('hex');
}

function createHandoff(overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mikavn-release-handoff-'));
  const version = overrides.version || JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8')).version;
  const installerName = overrides.installerName || `MikaVN Library_${version}_x64-setup.exe`;
  const releaseDir = path.join(root, 'output', 'release', `${version}-windows-x64`);
  const exe = Buffer.from('exe');
  const installer = Buffer.from('installer');
  const installerSignature = Buffer.from('installer-signature');
  const latestJson = Buffer.from(JSON.stringify({
    version: `v${version}`,
    platforms: {
      'windows-x86_64': {
        signature: installerSignature.toString('utf8'),
        url: `https://github.com/apaidedie/mikavn-library/releases/download/v${version}/${installerName}`,
      },
    },
  }, null, 2));
  const checksumEntries = [
    `${sha256(exe)}  mikavn-library.exe`,
    `${sha256(installer)}  ${installerName}`,
  ];
  writeFile(path.join(releaseDir, 'mikavn-library.exe'), exe);
  writeFile(path.join(releaseDir, installerName), installer);
  if (!overrides.localTauriBuildOnly && overrides.includeUpdaterArtifacts !== false) {
    writeFile(path.join(releaseDir, `${installerName}.sig`), installerSignature);
    writeFile(path.join(releaseDir, 'latest.json'), latestJson);
    checksumEntries.push(`${sha256(installerSignature)}  ${installerName}.sig`);
    checksumEntries.push(`${sha256(latestJson)}  latest.json`);
  }
  writeFile(path.join(releaseDir, 'SHA256SUMS.txt'), [...checksumEntries, ''].join('\n'));
  const reportLines = [
    '# MikaVN Library 0.1.1 Local Release Validation',
    '## Automated Checks',
    '- `npm run release:validate:core`: passed.',
    '- `npm run build`: passed.',
    '- `npm run test:diagnostic-export`: passed. Covers diagnostic export package, startup self-check warning notice, and dashboard error diagnostic export.',
    '- `npm run smoke:browser`: passed.',
    '- `npm run smoke:large`: passed.',
    '- Large library performance warnings: 0.',
    '- Topbar quick search: 210ms, budget 5,000ms.',
    overrides.localTauriBuildOnly ? '- `npm run tauri:build:local`: passed.' : '- `npm run tauri:build`: passed.',
    '- `npm run smoke:install`: passed.',
    '- `npm run smoke:portable-data`: passed.',
    '- `npm run smoke:real-data:readonly`: passed. `quick_check` ok; image header samples ok.',
    '- `npm run smoke:real-install:update`: passed. Real install counts preserved; verified database backup created under manual-install-smoke.',
    '- Lower-version updater rehearsal: passed. Installed previous version, updated through the in-app updater to current version, restarted, and verified app-data.',
    '- Target install directory: `E:\\MikaVN Library`.',
    '- Post-install SQLite `quick_check`: ok.',
    '- Real installed exe: `E:\\MikaVN Library\\mikavn-library.exe`.',
    '- `npm run smoke:desktop`: passed.',
    '- `npm run release:handoff:check`: passed.',
    '## Signing Certificate Preflight',
    '- `npm run release:signing:certificate:check`: passed.',
    ...(overrides.certificatePreflightLines || ['- Public release certificate candidates: 1.']),
    '## Signing Status',
    '- `npm run release:signing:check`: artifacts are `NotSigned`.',
    '- `npm run release:signing:require`: failed as expected because the artifacts are not signed with a valid trusted certificate.',
    '## Manual Risk Pass',
    'Use `MANUAL_RISK_PASS_CHECKLIST.md` in this directory to record the remaining human review.',
    '| Launch profiles | evidence | manual |',
    '| Destructive-adjacent flows | evidence | manual |',
    '| Privacy and logs | evidence | manual |',
    '| Search UX | evidence | manual |',
    ...(overrides.reportLines || []),
  ];
  writeFile(path.join(releaseDir, 'RELEASE_VALIDATION_REPORT.md'), reportLines.join('\n'));
  writeFile(path.join(releaseDir, 'MANUAL_RISK_PASS_CHECKLIST.md'), [
    '# MikaVN Library 0.1.1 Manual Risk Pass Checklist',
    'When checking an item, append `Evidence:` or `证据：` with the command, screenshot path, log path, or exact manual observation.',
    '## Launch Profiles',
    '- [ ] Direct executable launch.',
    '- [ ] `.lnk` shortcut launch.',
    '- [ ] Custom command launch.',
    '- [ ] Locale Emulator-style wrapper launch.',
    '- [ ] Elevated launch success.',
    '- [ ] Elevated launch cancellation.',
    '## Destructive-Adjacent Flows',
    '- [ ] Database restore scheduling.',
    '- [ ] Safe archive import.',
    '- [ ] Full archive restore.',
    '- [ ] Save mirror restore.',
    '- [ ] Tag deletion.',
    '- [ ] Game record deletion.',
    '## Privacy And Logs',
    '- [ ] Diagnostic log preview.',
    '- [ ] Task logs.',
    '- [ ] Screenshots/reports.',
    '## Search UX',
    '- [ ] Quick title/keyword search.',
    '- [ ] Report shortcut search.',
    '- [ ] Advanced grammar disclosure.',
    '- [ ] Saved search.',
    ...(overrides.checklistLines || []),
  ].join('\n'));
  return { releaseDir, root };
}

test('checkReleaseHandoff accepts complete artifacts, checksums, reports, and checklist', () => {
  const { releaseDir } = createHandoff();

  const result = checkReleaseHandoff({ releaseDir });

  assert.equal(result.releaseDir, releaseDir);
  assert.equal(result.artifacts.length, 2);
  assert.equal(result.requiredFiles.length, 5);
  assert.equal(result.signingStatus, 'documented-unsigned');
  assert.equal(result.buildMode, 'updater-capable');
  assert.equal(result.topbarQuickSearchMs, 210);
  assert.equal(result.manualRiskStatus, 'checklist-pending');
  assert.deepEqual(result.blockingReleaseRisks, [
    {
      code: 'unsigned-windows-artifacts',
      message: 'Windows artifacts are documented as unsigned; public release should use a trusted signing certificate.',
    },
    {
      code: 'manual-risk-checklist-pending',
      message: 'Manual release risk checklist has 19 pending item(s).',
      pendingItems: [
        'Direct executable launch.',
        '`.lnk` shortcut launch.',
        'Custom command launch.',
        'Locale Emulator-style wrapper launch.',
        'Elevated launch success.',
        'Elevated launch cancellation.',
        'Database restore scheduling.',
        'Safe archive import.',
        'Full archive restore.',
        'Save mirror restore.',
        'Tag deletion.',
        'Game record deletion.',
        'Diagnostic log preview.',
        'Task logs.',
        'Screenshots/reports.',
        'Quick title/keyword search.',
        'Report shortcut search.',
        'Advanced grammar disclosure.',
        'Saved search.',
      ],
    },
  ]);
  assert.deepEqual(result.manualRiskChecklist, {
    total: 19,
    checked: 0,
    pending: 19,
    checkedItems: [],
    pendingItems: [
      'Direct executable launch.',
      '`.lnk` shortcut launch.',
      'Custom command launch.',
      'Locale Emulator-style wrapper launch.',
      'Elevated launch success.',
      'Elevated launch cancellation.',
      'Database restore scheduling.',
      'Safe archive import.',
      'Full archive restore.',
      'Save mirror restore.',
      'Tag deletion.',
      'Game record deletion.',
      'Diagnostic log preview.',
      'Task logs.',
      'Screenshots/reports.',
      'Quick title/keyword search.',
      'Report shortcut search.',
      'Advanced grammar disclosure.',
      'Saved search.',
    ],
  });
});

test('checkReleaseHandoff marks manual risk checklist passed when all items are checked', () => {
  const { releaseDir } = createHandoff();
  const checklistPath = path.join(releaseDir, 'MANUAL_RISK_PASS_CHECKLIST.md');
  fs.writeFileSync(
    checklistPath,
    fs.readFileSync(checklistPath, 'utf8')
      .replaceAll('- [ ]', '- [x]')
      .replace(/^(- \[x\] .+?)$/gm, '$1 Evidence: verified during release smoke.'),
  );

  const result = checkReleaseHandoff({ releaseDir });

  assert.equal(result.manualRiskStatus, 'passed');
  assert.deepEqual(result.manualRiskChecklist, {
    total: 19,
    checked: 19,
    pending: 0,
    checkedItems: [
      'Direct executable launch.',
      '`.lnk` shortcut launch.',
      'Custom command launch.',
      'Locale Emulator-style wrapper launch.',
      'Elevated launch success.',
      'Elevated launch cancellation.',
      'Database restore scheduling.',
      'Safe archive import.',
      'Full archive restore.',
      'Save mirror restore.',
      'Tag deletion.',
      'Game record deletion.',
      'Diagnostic log preview.',
      'Task logs.',
      'Screenshots/reports.',
      'Quick title/keyword search.',
      'Report shortcut search.',
      'Advanced grammar disclosure.',
      'Saved search.',
    ],
    pendingItems: [],
  });
});

test('checkReleaseHandoff public-ready mode rejects blocking release risks', () => {
  const { releaseDir } = createHandoff();
  const checklistPath = path.join(releaseDir, 'MANUAL_RISK_PASS_CHECKLIST.md');
  fs.writeFileSync(
    checklistPath,
    fs.readFileSync(checklistPath, 'utf8')
      .replaceAll('- [ ]', '- [x]')
      .replace(/^(- \[x\] .+?)$/gm, '$1 Evidence: verified during release smoke.'),
  );

  assert.throws(
    () => checkReleaseHandoff({ releaseDir, requirePublicReady: true }),
    /release handoff has blocking public release risk\(s\): unsigned-windows-artifacts/,
  );
});

test('check-release-handoff CLI can require public release readiness', () => {
  const { releaseDir } = createHandoff();
  const checklistPath = path.join(releaseDir, 'MANUAL_RISK_PASS_CHECKLIST.md');
  fs.writeFileSync(
    checklistPath,
    fs.readFileSync(checklistPath, 'utf8')
      .replaceAll('- [ ]', '- [x]')
      .replace(/^(- \[x\] .+?)$/gm, '$1 Evidence: verified during release smoke.'),
  );

  const result = childProcess.spawnSync(process.execPath, [
    path.join(__dirname, 'check-release-handoff.cjs'),
    '--require-public-ready',
  ], {
    cwd: path.join(__dirname, '..', '..'),
    encoding: 'utf8',
    env: { ...process.env, MIKAVN_RELEASE_HANDOFF_DIR: releaseDir },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /release handoff has blocking public release risk\(s\): unsigned-windows-artifacts/);
});

test('checkReleaseHandoff treats large-library performance warnings as public release blockers', () => {
  const { releaseDir } = createHandoff({
    reportLines: [
      '- `npm run release:signing:require`: passed.',
    ],
  });
  const reportPath = path.join(releaseDir, 'RELEASE_VALIDATION_REPORT.md');
  fs.writeFileSync(
    reportPath,
    fs.readFileSync(reportPath, 'utf8')
      .replace('Large library performance warnings: 0.', 'Large library performance warnings: 2.')
      .replace('- `npm run release:signing:check`: artifacts are `NotSigned`.', '- `npm run release:signing:check`: signed true.')
      .replace('- `npm run release:signing:require`: failed as expected because the artifacts are not signed with a valid trusted certificate.', '- `npm run release:signing:require`: passed.'),
  );
  const checklistPath = path.join(releaseDir, 'MANUAL_RISK_PASS_CHECKLIST.md');
  fs.writeFileSync(
    checklistPath,
    fs.readFileSync(checklistPath, 'utf8')
      .replaceAll('- [ ]', '- [x]')
      .replace(/^(- \[x\] .+?)$/gm, '$1 Evidence: verified during release smoke.'),
  );

  const reportOnly = checkReleaseHandoff({ releaseDir });
  assert.deepEqual(reportOnly.blockingReleaseRisks, [
    {
      code: 'large-library-performance-warnings',
      message: 'Large-library smoke recorded 2 performance warning(s); inspect the large-library report before public release.',
      warningCount: 2,
    },
  ]);

  assert.throws(
    () => checkReleaseHandoff({ releaseDir, requirePublicReady: true }),
    /release handoff has blocking public release risk\(s\): large-library-performance-warnings/,
  );
});

test('checkReleaseHandoff treats local-only builds as public release blockers even when signed', () => {
  const { releaseDir } = createHandoff({ localTauriBuildOnly: true });
  const reportPath = path.join(releaseDir, 'RELEASE_VALIDATION_REPORT.md');
  fs.writeFileSync(
    reportPath,
    fs.readFileSync(reportPath, 'utf8')
      .replace('- `npm run release:signing:check`: artifacts are `NotSigned`.', '- `npm run release:signing:check`: signed true.')
      .replace('- `npm run release:signing:require`: failed as expected because the artifacts are not signed with a valid trusted certificate.', '- `npm run release:signing:require`: passed.'),
  );
  const checklistPath = path.join(releaseDir, 'MANUAL_RISK_PASS_CHECKLIST.md');
  fs.writeFileSync(
    checklistPath,
    fs.readFileSync(checklistPath, 'utf8')
      .replaceAll('- [ ]', '- [x]')
      .replace(/^(- \[x\] .+?)$/gm, '$1 Evidence: verified during release smoke.'),
  );

  const reportOnly = checkReleaseHandoff({ releaseDir });
  assert.equal(reportOnly.buildMode, 'local-unsigned');
  assert.deepEqual(reportOnly.blockingReleaseRisks, [
    {
      code: 'not-updater-capable',
      message: 'Release handoff was built with tauri:build:local; public in-app updates require npm run tauri:build updater artifacts.',
      buildMode: 'local-unsigned',
    },
  ]);

  assert.throws(
    () => checkReleaseHandoff({ releaseDir, requirePublicReady: true }),
    /release handoff has blocking public release risk\(s\): not-updater-capable/,
  );
});

test('checkReleaseHandoff treats missing trusted signing certificate as a public release blocker', () => {
  const { releaseDir } = createHandoff({
    reportLines: [
      '- `npm run release:signing:require`: passed.',
    ],
    certificatePreflightLines: [
      '- Signing certificate preflight risks: no-usable-code-signing-certificate, no-trusted-code-signing-certificate.',
    ],
  });
  const reportPath = path.join(releaseDir, 'RELEASE_VALIDATION_REPORT.md');
  fs.writeFileSync(
    reportPath,
    fs.readFileSync(reportPath, 'utf8')
      .replace('- `npm run release:signing:check`: artifacts are `NotSigned`.', '- `npm run release:signing:check`: signed true.')
      .replace('- `npm run release:signing:require`: failed as expected because the artifacts are not signed with a valid trusted certificate.', '- `npm run release:signing:require`: passed.'),
  );
  const checklistPath = path.join(releaseDir, 'MANUAL_RISK_PASS_CHECKLIST.md');
  fs.writeFileSync(
    checklistPath,
    fs.readFileSync(checklistPath, 'utf8')
      .replaceAll('- [ ]', '- [x]')
      .replace(/^(- \[x\] .+?)$/gm, '$1 Evidence: verified during release smoke.'),
  );

  const reportOnly = checkReleaseHandoff({ releaseDir });
  assert.deepEqual(reportOnly.blockingReleaseRisks, [
    {
      code: 'no-trusted-code-signing-certificate',
      message: 'Signing certificate preflight did not find a trusted public release code-signing certificate candidate.',
      preflightRisks: ['no-usable-code-signing-certificate', 'no-trusted-code-signing-certificate'],
    },
  ]);

  assert.throws(
    () => checkReleaseHandoff({ releaseDir, requirePublicReady: true }),
    /release handoff has blocking public release risk\(s\): no-trusted-code-signing-certificate/,
  );
});

test('checkReleaseHandoff rejects updater-capable handoff without updater metadata artifacts', () => {
  const { releaseDir } = createHandoff({ includeUpdaterArtifacts: false });

  assert.throws(
    () => checkReleaseHandoff({ releaseDir }),
    /release handoff is missing required updater artifact: .*\.sig/,
  );
});

test('checkReleaseHandoff rejects updater metadata signature drift', () => {
  const { releaseDir } = createHandoff();
  const latestJsonPath = path.join(releaseDir, 'latest.json');
  const latestJson = JSON.parse(fs.readFileSync(latestJsonPath, 'utf8'));
  latestJson.platforms['windows-x86_64'].signature = 'different-signature';
  const latestJsonBuffer = Buffer.from(JSON.stringify(latestJson, null, 2));
  fs.writeFileSync(latestJsonPath, latestJsonBuffer);
  const sumsPath = path.join(releaseDir, 'SHA256SUMS.txt');
  fs.writeFileSync(
    sumsPath,
    fs.readFileSync(sumsPath, 'utf8').replace(/[a-f0-9]{64}  latest\.json/, `${sha256(latestJsonBuffer)}  latest.json`),
  );

  assert.throws(
    () => checkReleaseHandoff({ releaseDir }),
    /updater metadata signature does not match installer \.sig artifact/,
  );
});

test('checkReleaseHandoff rejects updater metadata URL that does not reference the installer artifact', () => {
  const { releaseDir } = createHandoff();
  const latestJsonPath = path.join(releaseDir, 'latest.json');
  const latestJson = JSON.parse(fs.readFileSync(latestJsonPath, 'utf8'));
  latestJson.platforms['windows-x86_64'].url = 'https://github.com/apaidedie/mikavn-library/releases/download/v0.0.0/old-installer.exe';
  const latestJsonBuffer = Buffer.from(JSON.stringify(latestJson, null, 2));
  fs.writeFileSync(latestJsonPath, latestJsonBuffer);
  const sumsPath = path.join(releaseDir, 'SHA256SUMS.txt');
  fs.writeFileSync(
    sumsPath,
    fs.readFileSync(sumsPath, 'utf8').replace(/[a-f0-9]{64}  latest\.json/, `${sha256(latestJsonBuffer)}  latest.json`),
  );

  assert.throws(
    () => checkReleaseHandoff({ releaseDir }),
    /updater metadata URL must reference installer artifact/,
  );
});

test('checkReleaseHandoff rejects checked manual risk items without evidence', () => {
  const { releaseDir } = createHandoff();
  const checklistPath = path.join(releaseDir, 'MANUAL_RISK_PASS_CHECKLIST.md');
  const checklist = fs.readFileSync(checklistPath, 'utf8');
  fs.writeFileSync(checklistPath, checklist.replace('- [ ] Direct executable launch.', '- [x] Direct executable launch.'));

  assert.throws(
    () => checkReleaseHandoff({ releaseDir }),
    /checked manual risk checklist item must include evidence: Direct executable launch\./,
  );
});

test('checkReleaseHandoff requires manual checklist evidence instructions', () => {
  const { releaseDir } = createHandoff();
  const checklistPath = path.join(releaseDir, 'MANUAL_RISK_PASS_CHECKLIST.md');
  const checklist = fs.readFileSync(checklistPath, 'utf8');
  fs.writeFileSync(checklistPath, checklist.replace('When checking an item, append `Evidence:` or `证据：` with the command, screenshot path, log path, or exact manual observation.\n', ''));

  assert.throws(
    () => checkReleaseHandoff({ releaseDir }),
    /manual risk checklist is missing required token: .*Evidence:/,
  );
});

test('checkReleaseHandoff accepts local unsigned builds that record tauri local build', () => {
  const { releaseDir } = createHandoff({ localTauriBuildOnly: true });

  const result = checkReleaseHandoff({ releaseDir });

  assert.equal(result.releaseDir, releaseDir);
  assert.equal(result.artifacts.length, 2);
  assert.equal(result.signingStatus, 'documented-unsigned');
  assert.equal(result.buildMode, 'local-unsigned');
});

test('checkReleaseHandoff rejects checksum drift', () => {
  const { releaseDir } = createHandoff();
  fs.writeFileSync(path.join(releaseDir, 'mikavn-library.exe'), 'changed');

  assert.throws(
    () => checkReleaseHandoff({ releaseDir }),
    /checksum mismatch for mikavn-library\.exe/,
  );
});

test('checkReleaseHandoff rejects incomplete manual checklist', () => {
  const { releaseDir } = createHandoff();
  fs.writeFileSync(path.join(releaseDir, 'MANUAL_RISK_PASS_CHECKLIST.md'), '## Launch Profiles\n');

  assert.throws(
    () => checkReleaseHandoff({ releaseDir }),
    /manual risk checklist is missing required token: .*Elevated launch cancellation/,
  );
});

test('checkReleaseHandoff requires the handoff check to be recorded in the validation report', () => {
  const { releaseDir } = createHandoff();
  const reportPath = path.join(releaseDir, 'RELEASE_VALIDATION_REPORT.md');
  const report = fs.readFileSync(reportPath, 'utf8');
  fs.writeFileSync(reportPath, report.replace('- `npm run release:handoff:check`: passed.\n', ''));

  assert.throws(
    () => checkReleaseHandoff({ releaseDir }),
    /release validation report is missing required token: .*npm run release:handoff:check/,
  );
});

test('checkReleaseHandoff requires real data readonly smoke evidence in the validation report', () => {
  const { releaseDir } = createHandoff();
  const reportPath = path.join(releaseDir, 'RELEASE_VALIDATION_REPORT.md');
  const report = fs.readFileSync(reportPath, 'utf8');
  fs.writeFileSync(reportPath, report.replace('- `npm run smoke:real-data:readonly`: passed. `quick_check` ok; image header samples ok.\n', ''));

  assert.throws(
    () => checkReleaseHandoff({ releaseDir }),
    /release validation report is missing required token: .*npm run smoke:real-data:readonly/,
  );
});

test('checkReleaseHandoff requires real install target evidence in the validation report', () => {
  const { releaseDir } = createHandoff();
  const reportPath = path.join(releaseDir, 'RELEASE_VALIDATION_REPORT.md');
  const report = fs.readFileSync(reportPath, 'utf8');
  fs.writeFileSync(reportPath, report.replace('- Target install directory: `E:\\MikaVN Library`.\n', ''));

  assert.throws(
    () => checkReleaseHandoff({ releaseDir }),
    /release validation report is missing required token: .*Target install directory/,
  );
});

test('checkReleaseHandoff requires real install update smoke evidence in the validation report', () => {
  const { releaseDir } = createHandoff();
  const reportPath = path.join(releaseDir, 'RELEASE_VALIDATION_REPORT.md');
  const report = fs.readFileSync(reportPath, 'utf8');
  fs.writeFileSync(reportPath, report.replace('- `npm run smoke:real-install:update`: passed. Real install counts preserved; verified database backup created under manual-install-smoke.\n', ''));

  assert.throws(
    () => checkReleaseHandoff({ releaseDir }),
    /release validation report is missing required token: .*npm run smoke:real-install:update/,
  );
});

test('checkReleaseHandoff requires real install update evidence to mention verified database backup', () => {
  const { releaseDir } = createHandoff();
  const reportPath = path.join(releaseDir, 'RELEASE_VALIDATION_REPORT.md');
  const report = fs.readFileSync(reportPath, 'utf8');
  fs.writeFileSync(
    reportPath,
    report.replace(
      '- `npm run smoke:real-install:update`: passed. Real install counts preserved; verified database backup created under manual-install-smoke.',
      '- `npm run smoke:real-install:update`: passed. Real install counts preserved.',
    ),
  );

  assert.throws(
    () => checkReleaseHandoff({ releaseDir }),
    /release validation report is missing required token: .*verified database backup/,
  );
});

test('checkReleaseHandoff requires lower-version updater rehearsal evidence in the validation report', () => {
  const { releaseDir } = createHandoff();
  const reportPath = path.join(releaseDir, 'RELEASE_VALIDATION_REPORT.md');
  const report = fs.readFileSync(reportPath, 'utf8');
  fs.writeFileSync(
    reportPath,
    report.replace('- Lower-version updater rehearsal: passed. Installed previous version, updated through the in-app updater to current version, restarted, and verified app-data.\n', ''),
  );

  assert.throws(
    () => checkReleaseHandoff({ releaseDir }),
    /release validation report is missing required token: .*Lower-version updater rehearsal/,
  );
});

test('checkReleaseHandoff requires diagnostic export and startup self-check evidence in the validation report', () => {
  const { releaseDir } = createHandoff();
  const reportPath = path.join(releaseDir, 'RELEASE_VALIDATION_REPORT.md');
  const report = fs.readFileSync(reportPath, 'utf8');
  fs.writeFileSync(
    reportPath,
    report.replace('- `npm run test:diagnostic-export`: passed. Covers diagnostic export package, startup self-check warning notice, and dashboard error diagnostic export.\n', ''),
  );

  assert.throws(
    () => checkReleaseHandoff({ releaseDir }),
    /release validation report is missing required token: .*npm run test:diagnostic-export/,
  );
});

test('checkReleaseHandoff requires production frontend build evidence in the validation report', () => {
  const { releaseDir } = createHandoff();
  const reportPath = path.join(releaseDir, 'RELEASE_VALIDATION_REPORT.md');
  const report = fs.readFileSync(reportPath, 'utf8');
  fs.writeFileSync(reportPath, report.replace('- `npm run build`: passed.\n', ''));

  assert.throws(
    () => checkReleaseHandoff({ releaseDir }),
    /release validation report is missing required token: .*npm run build/,
  );
});

test('checkReleaseHandoff rejects production frontend build evidence that is not marked passed', () => {
  const { releaseDir } = createHandoff();
  const reportPath = path.join(releaseDir, 'RELEASE_VALIDATION_REPORT.md');
  const report = fs.readFileSync(reportPath, 'utf8');
  fs.writeFileSync(reportPath, report.replace('- `npm run build`: passed.', '- `npm run build`: not run.'));

  assert.throws(
    () => checkReleaseHandoff({ releaseDir }),
    /release validation report must mark required command as passed: npm run build/,
  );
});

test('checkReleaseHandoff rejects diagnostic export evidence that is not marked passed', () => {
  const { releaseDir } = createHandoff();
  const reportPath = path.join(releaseDir, 'RELEASE_VALIDATION_REPORT.md');
  const report = fs.readFileSync(reportPath, 'utf8');
  fs.writeFileSync(
    reportPath,
    report.replace('- `npm run test:diagnostic-export`: passed.', '- `npm run test:diagnostic-export`: not run.'),
  );

  assert.throws(
    () => checkReleaseHandoff({ releaseDir }),
    /release validation report must mark required command as passed: npm run test:diagnostic-export/,
  );
});

test('checkReleaseHandoff rejects required validation commands that are not marked passed', () => {
  const { releaseDir } = createHandoff();
  const reportPath = path.join(releaseDir, 'RELEASE_VALIDATION_REPORT.md');
  const report = fs.readFileSync(reportPath, 'utf8');
  fs.writeFileSync(reportPath, report.replace('- `npm run tauri:build`: passed.', '- `npm run tauri:build`: not run.'));

  assert.throws(
    () => checkReleaseHandoff({ releaseDir }),
    /release validation report must mark npm run tauri:build or npm run tauri:build:local as passed/,
  );
});

test('checkReleaseHandoff requires large library warning count in the validation report', () => {
  const { releaseDir } = createHandoff();
  const reportPath = path.join(releaseDir, 'RELEASE_VALIDATION_REPORT.md');
  const report = fs.readFileSync(reportPath, 'utf8');
  fs.writeFileSync(reportPath, report.replace('- Large library performance warnings: 0.\n', ''));

  assert.throws(
    () => checkReleaseHandoff({ releaseDir }),
    /release validation report is missing required token: .*Large library performance warnings/,
  );
});

test('checkReleaseHandoff requires topbar quick search timing evidence in the validation report', () => {
  const { releaseDir } = createHandoff();
  const reportPath = path.join(releaseDir, 'RELEASE_VALIDATION_REPORT.md');
  const report = fs.readFileSync(reportPath, 'utf8');
  fs.writeFileSync(reportPath, report.replace('- Topbar quick search: 210ms, budget 5,000ms.\n', ''));

  assert.throws(
    () => checkReleaseHandoff({ releaseDir }),
    /release validation report is missing required token: .*Topbar quick search/,
  );
});

test('checkReleaseHandoff rejects non-numeric topbar quick search timing evidence', () => {
  const { releaseDir } = createHandoff();
  const reportPath = path.join(releaseDir, 'RELEASE_VALIDATION_REPORT.md');
  const report = fs.readFileSync(reportPath, 'utf8');
  fs.writeFileSync(reportPath, report.replace('Topbar quick search: 210ms', 'Topbar quick search: unknown'));

  assert.throws(
    () => checkReleaseHandoff({ releaseDir }),
    /release validation report must record a numeric topbar quick search timing/,
  );
});

test('checkReleaseHandoff rejects non-numeric large library warning count', () => {
  const { releaseDir } = createHandoff();
  const reportPath = path.join(releaseDir, 'RELEASE_VALIDATION_REPORT.md');
  const report = fs.readFileSync(reportPath, 'utf8');
  fs.writeFileSync(reportPath, report.replace('Large library performance warnings: 0.', 'Large library performance warnings: unknown.'));

  assert.throws(
    () => checkReleaseHandoff({ releaseDir }),
    /release validation report must record a numeric large library performance warning count/,
  );
});
