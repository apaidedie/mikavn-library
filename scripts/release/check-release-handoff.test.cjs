const assert = require('node:assert/strict');
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
  assert.deepEqual(result.manualRiskChecklist, {
    total: 19,
    checked: 0,
    pending: 19,
  });
});

test('checkReleaseHandoff marks manual risk checklist passed when all items are checked', () => {
  const { releaseDir } = createHandoff();
  const checklistPath = path.join(releaseDir, 'MANUAL_RISK_PASS_CHECKLIST.md');
  fs.writeFileSync(checklistPath, fs.readFileSync(checklistPath, 'utf8').replaceAll('- [ ]', '- [x]'));

  const result = checkReleaseHandoff({ releaseDir });

  assert.equal(result.manualRiskStatus, 'passed');
  assert.deepEqual(result.manualRiskChecklist, {
    total: 19,
    checked: 19,
    pending: 0,
  });
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
