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
  const releaseDir = path.join(root, 'output', 'release', '0.1.1-windows-x64');
  const exe = Buffer.from('exe');
  const installer = Buffer.from('installer');
  writeFile(path.join(releaseDir, 'mikavn-library.exe'), exe);
  writeFile(path.join(releaseDir, 'MikaVN.Library_0.1.1_x64-setup.exe'), installer);
  writeFile(path.join(releaseDir, 'SHA256SUMS.txt'), [
    `${sha256(exe)}  mikavn-library.exe`,
    `${sha256(installer)}  MikaVN.Library_0.1.1_x64-setup.exe`,
    '',
  ].join('\n'));
  writeFile(path.join(releaseDir, 'RELEASE_VALIDATION_REPORT.md'), [
    '# MikaVN Library 0.1.1 Local Release Validation',
    '## Automated Checks',
    '- `npm run release:validate:core`: passed.',
    '- `npm run smoke:browser`: passed.',
    '- `npm run smoke:large`: passed.',
    '- `npm run tauri:build`: passed.',
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
  ].join('\n'));
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
  assert.equal(result.manualRiskStatus, 'checklist-required');
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
