const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { checkReleaseHandoff } = require('./check-release-handoff.cjs');
const { prepareUpdaterHandoff } = require('./prepare-updater-handoff.cjs');

const repoRoot = path.resolve(__dirname, '..', '..');
const { version } = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function sha256(contents) {
  return crypto.createHash('sha256').update(contents).digest('hex');
}

function writePassingReport(releaseDir) {
  writeFile(path.join(releaseDir, 'RELEASE_VALIDATION_REPORT.md'), [
    '# MikaVN Library release validation',
    '## Automated Checks',
    '- `npm run release:validate:core`: passed.',
    '- `npm run build`: passed.',
    '- `npm run test:diagnostic-export`: passed. Covers diagnostic export package, startup self-check warning notice, and dashboard error diagnostic export.',
    '- `npm run smoke:browser`: passed.',
    '- `npm run smoke:large`: passed.',
    '- Large library performance warnings: 0.',
    '- `npm run tauri:build`: passed.',
    '- `npm run smoke:install`: passed.',
    '- `npm run smoke:portable-data`: passed.',
    '- `npm run smoke:real-data:readonly`: passed. `quick_check` ok; image header samples ok.',
    '- `npm run smoke:real-install:update`: passed. Real install counts preserved.',
    '- Target install directory: `E:\\MikaVN Library`.',
    '- Post-install SQLite `quick_check`: ok.',
    '- Real installed exe: `E:\\MikaVN Library\\mikavn-library.exe`.',
    '- `npm run smoke:desktop`: passed.',
    '- `npm run release:handoff:check`: passed.',
    '## Signing Certificate Preflight',
    '- `npm run release:signing:certificate:check`: passed.',
    '- Public release certificate candidates: 1.',
    '## Signing Status',
    '- `npm run release:signing:check`: signed true.',
    '- `npm run release:signing:require`: passed.',
    '## Manual Risk Pass',
    'Use `MANUAL_RISK_PASS_CHECKLIST.md` in this directory to record the remaining human review.',
    '| Launch profiles | evidence | manual |',
    '| Destructive-adjacent flows | evidence | manual |',
    '| Privacy and logs | evidence | manual |',
    '| Search UX | evidence | manual |',
  ].join('\n'));
}

function writePassingChecklist(releaseDir) {
  const items = [
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
  ];
  writeFile(path.join(releaseDir, 'MANUAL_RISK_PASS_CHECKLIST.md'), [
    '# MikaVN Library Manual Risk Pass Checklist',
    'When checking an item, append `Evidence:` or `证据：` with the command, screenshot path, log path, or exact manual observation.',
    ...items.map((item) => `- [x] ${item} Evidence: verified in release rehearsal.`),
  ].join('\n'));
}

test('prepareUpdaterHandoff stages signed updater artifacts that pass handoff checks', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mikavn-updater-handoff-'));
  const releaseExePath = path.join(tempRoot, 'target', 'release', 'mikavn-library.exe');
  const bundleDir = path.join(tempRoot, 'target', 'release', 'bundle', 'nsis');
  const releaseDir = path.join(tempRoot, 'output', 'release', `${version}-windows-x64`);
  const installerName = `MikaVN Library_${version}_x64-setup.exe`;
  const signature = 'signed-updater-payload';
  const releaseExe = Buffer.from('desktop-exe');
  const installer = Buffer.from('installer');

  writeFile(releaseExePath, releaseExe);
  writeFile(path.join(bundleDir, installerName), installer);
  writeFile(path.join(bundleDir, `${installerName}.sig`), signature);
  writePassingReport(releaseDir);
  writePassingChecklist(releaseDir);

  const result = prepareUpdaterHandoff({
    bundleDir,
    releaseDir,
    releaseExePath,
    now: new Date('2026-06-23T00:00:00Z'),
    repoRoot,
  });

  assert.equal(result.installerName, installerName);
  assert.deepEqual(result.artifacts.map((artifact) => artifact.fileName).sort(), [
    `${installerName}.sig`,
    'latest.json',
    'mikavn-library.exe',
    installerName,
  ].sort());

  const latestJson = JSON.parse(fs.readFileSync(path.join(releaseDir, 'latest.json'), 'utf8'));
  assert.equal(latestJson.version, `v${version}`);
  assert.equal(latestJson.pub_date, '2026-06-23T00:00:00Z');
  assert.equal(latestJson.platforms['windows-x86_64'].signature, signature);
  assert.match(latestJson.platforms['windows-x86_64'].url, /MikaVN%20Library_/);

  const sums = fs.readFileSync(path.join(releaseDir, 'SHA256SUMS.txt'), 'utf8');
  assert.match(sums, new RegExp(`${sha256(releaseExe)}  mikavn-library\\.exe`));
  assert.match(sums, new RegExp(`${sha256(installer)}  MikaVN Library_${version}_x64-setup\\.exe`));
  assert.match(sums, new RegExp(`${sha256(signature)}  MikaVN Library_${version}_x64-setup\\.exe\\.sig`));
  assert.match(sums, / latest\.json/);

  const handoff = checkReleaseHandoff({ releaseDir, requirePublicReady: true });
  assert.equal(handoff.buildMode, 'updater-capable');
  assert.equal(handoff.updaterArtifacts.length, 2);
  assert.deepEqual(handoff.blockingReleaseRisks, []);
});

test('prepareUpdaterHandoff rejects installers without updater signatures', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mikavn-updater-handoff-'));
  const releaseExePath = path.join(tempRoot, 'target', 'release', 'mikavn-library.exe');
  const bundleDir = path.join(tempRoot, 'target', 'release', 'bundle', 'nsis');
  const releaseDir = path.join(tempRoot, 'output', 'release', `${version}-windows-x64`);

  writeFile(releaseExePath, 'desktop-exe');
  writeFile(path.join(bundleDir, `MikaVN Library_${version}_x64-setup.exe`), 'installer');

  assert.throws(
    () => prepareUpdaterHandoff({ bundleDir, releaseDir, releaseExePath, repoRoot }),
    /Missing updater signature/,
  );
});
