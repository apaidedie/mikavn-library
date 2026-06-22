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
  writeFile(path.join(releaseDir, 'mikavn-library.exe'), exe);
  writeFile(path.join(releaseDir, installerName), installer);
  writeFile(path.join(releaseDir, 'SHA256SUMS.txt'), [
    `${sha256(exe)}  mikavn-library.exe`,
    `${sha256(installer)}  ${installerName}`,
    '',
  ].join('\n'));
  const reportLines = [
    '# MikaVN Library 0.1.1 Local Release Validation',
    '## Automated Checks',
    '- `npm run release:validate:core`: passed.',
    '- `npm run smoke:browser`: passed.',
    '- `npm run smoke:large`: passed.',
    '- Large library performance warnings: 0.',
    overrides.localTauriBuildOnly ? '- `npm run tauri:build:local`: passed.' : '- `npm run tauri:build`: passed.',
    '- `npm run smoke:install`: passed.',
    '- `npm run smoke:portable-data`: passed.',
    '- `npm run smoke:real-data:readonly`: passed. `quick_check` ok; image header samples ok.',
    '- `npm run smoke:real-install:update`: passed. Real install counts preserved.',
    '- Target install directory: `E:\\MikaVN Library`.',
    '- Post-install SQLite `quick_check`: ok.',
    '- Real installed exe: `E:\\MikaVN Library\\mikavn-library.exe`.',
    '- `npm run smoke:desktop`: passed.',
    '- `npm run release:handoff:check`: passed.',
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
  fs.writeFileSync(reportPath, report.replace('- `npm run smoke:real-install:update`: passed. Real install counts preserved.\n', ''));

  assert.throws(
    () => checkReleaseHandoff({ releaseDir }),
    /release validation report is missing required token: .*npm run smoke:real-install:update/,
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
