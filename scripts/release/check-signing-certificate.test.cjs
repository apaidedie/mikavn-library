const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { summarizeSigningCertificates } = require('./check-signing-certificate.cjs');

const scriptPath = path.join(__dirname, 'check-signing-certificate.cjs');

function certificate(overrides = {}) {
  return {
    subject: 'CN=MikaVN Release',
    issuer: 'CN=Trusted Code Signing CA',
    thumbprint: 'ABC123',
    notBefore: '2026-01-01T00:00:00.000Z',
    notAfter: '2027-01-01T00:00:00.000Z',
    hasPrivateKey: true,
    enhancedKeyUsages: ['Code Signing', '1.3.6.1.5.5.7.3.3'],
    chainTrusted: true,
    storeLocation: 'CurrentUser',
    storeName: 'My',
    ...overrides,
  };
}

test('summarizeSigningCertificates finds trusted public release candidates', () => {
  const summary = summarizeSigningCertificates([
    certificate(),
    certificate({ thumbprint: 'EXPIRED', notAfter: '2025-01-01T00:00:00.000Z' }),
    certificate({ thumbprint: 'NO_PRIVATE_KEY', hasPrivateKey: false }),
    certificate({ thumbprint: 'WRONG_EKU', enhancedKeyUsages: ['Client Authentication'] }),
    certificate({ thumbprint: 'SELF_SIGNED', issuer: 'CN=MikaVN Release' }),
  ], new Date('2026-06-23T00:00:00.000Z'));

  assert.equal(summary.scannedCertificates, 5);
  assert.equal(summary.usableCodeSigningCertificates.length, 2);
  assert.equal(summary.publicReleaseCandidates.length, 1);
  assert.equal(summary.publicReleaseCandidates[0].thumbprint, 'ABC123');
  assert.deepEqual(summary.blockingReleaseRisks, []);
});

test('certificate preflight require mode rejects missing trusted candidates', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mikavn-cert-preflight-'));
  const certPath = path.join(tempDir, 'certificates.json');
  fs.writeFileSync(certPath, JSON.stringify([
    certificate({ issuer: 'CN=MikaVN Release', chainTrusted: false }),
  ]));

  const result = childProcess.spawnSync(process.execPath, [
    scriptPath,
    '--certificates-json',
    certPath,
    '--require-certificate',
    '--now',
    '2026-06-23T00:00:00.000Z',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /no-trusted-code-signing-certificate/);
});
