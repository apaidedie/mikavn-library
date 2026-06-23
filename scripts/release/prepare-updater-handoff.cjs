const crypto = require('node:crypto');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureFile(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function copyFile(sourcePath, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

function currentSourceCommit(repoRoot) {
  const result = childProcess.spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || '').trim();
    throw new Error(`failed to read current Git commit: ${message || `exit ${result.status}`}`);
  }
  const commit = result.stdout.trim();
  if (!/^[a-f0-9]{40}$/i.test(commit)) {
    throw new Error(`current Git commit is not a full SHA-1 hash: ${commit}`);
  }
  return commit.toLowerCase();
}

function currentSourceCommitTimeMs(repoRoot) {
  const result = childProcess.spawnSync('git', ['show', '-s', '--format=%ct', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || '').trim();
    throw new Error(`failed to read current Git commit time: ${message || `exit ${result.status}`}`);
  }
  const timestampSeconds = Number(result.stdout.trim());
  if (!Number.isFinite(timestampSeconds) || timestampSeconds <= 0) {
    throw new Error(`current Git commit time is invalid: ${result.stdout.trim()}`);
  }
  return timestampSeconds * 1000;
}

function assertArtifactsFresh(repoRoot, artifacts) {
  const commitTimeMs = currentSourceCommitTimeMs(repoRoot);
  const staleArtifacts = artifacts
    .filter((artifact) => fs.statSync(artifact.filePath).mtimeMs + 1000 < commitTimeMs)
    .map((artifact) => artifact.label);
  if (staleArtifacts.length > 0) {
    throw new Error(
      `Release artifacts are older than the current source commit: ${staleArtifacts.join(', ')}. Run npm run tauri:build before preparing updater handoff.`,
    );
  }
}

function upsertSourceCommitInReport(reportPath, commit) {
  if (!fs.existsSync(reportPath)) return;
  const report = fs.readFileSync(reportPath, 'utf8');
  const line = `- Source commit: ${commit}.`;
  const nextReport = /Source commit:\s*[a-f0-9]{40}\b/i.test(report)
    ? report.replace(/- Source commit:\s*[a-f0-9]{40}\.?/i, line)
    : report.replace(/^(#[^\r\n]*(?:\r?\n)?)/, `$1${line}\n`);
  fs.writeFileSync(reportPath, nextReport);
}

function readReleaseMetadata(repoRoot) {
  const pkg = readJson(path.join(repoRoot, 'package.json'));
  const tauriConfig = readJson(path.join(repoRoot, 'src-tauri', 'tauri.conf.json'));
  return {
    identifier: tauriConfig.identifier,
    productName: tauriConfig.productName || 'MikaVN Library',
    version: pkg.version,
  };
}

function publicInstallerName(productName, version) {
  return `${productName.trim().replace(/\s+/g, '.')}_${version}_x64-setup.exe`;
}

function defaultReleaseDir(repoRoot, version) {
  return path.join(repoRoot, 'output', 'release', `${version}-windows-x64`);
}

function findNewestInstaller(bundleDir) {
  if (!fs.existsSync(bundleDir) || !fs.statSync(bundleDir).isDirectory()) {
    throw new Error(`NSIS bundle directory not found: ${bundleDir}`);
  }
  const installers = fs.readdirSync(bundleDir)
    .filter((fileName) => fileName.toLowerCase().endsWith('.exe'))
    .map((fileName) => {
      const filePath = path.join(bundleDir, fileName);
      return { fileName, filePath, mtimeMs: fs.statSync(filePath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  if (installers.length === 0) throw new Error(`No NSIS installer found in ${bundleDir}`);
  return installers[0];
}

function formatPubDate(now = new Date()) {
  return now.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--bundle-dir') {
      options.bundleDir = next;
      index += 1;
    } else if (token === '--release-dir') {
      options.releaseDir = next;
      index += 1;
    } else if (token === '--release-exe') {
      options.releaseExePath = next;
      index += 1;
    } else if (token === '--notes') {
      options.notesPath = next;
      index += 1;
    } else {
      throw new Error(`unknown argument: ${token}`);
    }
  }
  return options;
}

function prepareUpdaterHandoff(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || path.join(__dirname, '..', '..'));
  const { productName, version } = readReleaseMetadata(repoRoot);
  const bundleDir = path.resolve(options.bundleDir || path.join(repoRoot, 'src-tauri', 'target', 'release', 'bundle', 'nsis'));
  const releaseDir = path.resolve(options.releaseDir || defaultReleaseDir(repoRoot, version));
  const releaseExePath = path.resolve(options.releaseExePath || path.join(repoRoot, 'src-tauri', 'target', 'release', 'mikavn-library.exe'));
  const notesPath = path.resolve(options.notesPath || path.join(repoRoot, 'docs', 'RELEASE_NOTES_TEMPLATE.md'));
  const installer = findNewestInstaller(bundleDir);
  const signaturePath = `${installer.filePath}.sig`;
  const installerName = publicInstallerName(productName, version);
  const signatureName = `${installerName}.sig`;

  ensureFile(releaseExePath, 'Release executable');
  ensureFile(signaturePath, 'Missing updater signature');
  assertArtifactsFresh(repoRoot, [
    { label: 'release executable', filePath: releaseExePath },
    { label: 'NSIS installer', filePath: installer.filePath },
    { label: 'updater signature', filePath: signaturePath },
  ]);

  const releaseExeTarget = path.join(releaseDir, 'mikavn-library.exe');
  const installerTarget = path.join(releaseDir, installerName);
  const signatureTarget = path.join(releaseDir, signatureName);
  const latestJsonTarget = path.join(releaseDir, 'latest.json');
  const shaTarget = path.join(releaseDir, 'SHA256SUMS.txt');
  const validationReportPath = path.join(releaseDir, 'RELEASE_VALIDATION_REPORT.md');

  copyFile(releaseExePath, releaseExeTarget);
  copyFile(installer.filePath, installerTarget);
  copyFile(signaturePath, signatureTarget);
  upsertSourceCommitInReport(validationReportPath, currentSourceCommit(repoRoot));

  const signature = fs.readFileSync(signaturePath, 'utf8').trim();
  const notes = fs.existsSync(notesPath) ? fs.readFileSync(notesPath, 'utf8') : '';
  const latestJson = {
    version: `v${version}`,
    notes,
    pub_date: formatPubDate(options.now),
    platforms: {
      'windows-x86_64': {
        signature,
        url: `https://github.com/apaidedie/mikavn-library/releases/download/v${version}/${encodeURIComponent(installerName)}`,
      },
    },
  };
  writeFile(latestJsonTarget, `${JSON.stringify(latestJson, null, 2)}\n`);

  const artifacts = [
    { fileName: 'mikavn-library.exe', filePath: releaseExeTarget },
    { fileName: installerName, filePath: installerTarget },
    { fileName: signatureName, filePath: signatureTarget },
    { fileName: 'latest.json', filePath: latestJsonTarget },
  ].map((artifact) => ({
    ...artifact,
    sha256: sha256File(artifact.filePath),
    sizeBytes: fs.statSync(artifact.filePath).size,
  }));

  writeFile(shaTarget, `${artifacts.map((artifact) => `${artifact.sha256}  ${artifact.fileName}`).join('\n')}\n`);

  return {
    releaseDir,
    installerName,
    artifacts,
  };
}

if (require.main === module) {
  try {
    const result = prepareUpdaterHandoff(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify({
      releaseDir: result.releaseDir,
      installerName: result.installerName,
      artifacts: result.artifacts.map((artifact) => ({
        fileName: artifact.fileName,
        sizeBytes: artifact.sizeBytes,
        sha256: artifact.sha256,
      })),
    }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = { prepareUpdaterHandoff };
