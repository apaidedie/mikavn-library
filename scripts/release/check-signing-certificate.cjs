const childProcess = require('node:child_process');
const fs = require('node:fs');

const CODE_SIGNING_OID = '1.3.6.1.5.5.7.3.3';

function parseArgs(argv) {
  const options = { requireCertificate: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--certificates-json') {
      options.certificatesJson = next;
      index += 1;
    } else if (token === '--require-certificate') {
      options.requireCertificate = true;
    } else if (token === '--now') {
      options.now = new Date(next);
      index += 1;
    } else {
      throw new Error(`unknown argument: ${token}`);
    }
  }
  return options;
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function hasCodeSigningUsage(certificate) {
  const usages = normalizeList(certificate.enhancedKeyUsages).map((usage) => usage.toLowerCase());
  return usages.some((usage) => usage === CODE_SIGNING_OID || usage.includes('code signing'));
}

function isSelfSigned(certificate) {
  return String(certificate.subject || '').trim() === String(certificate.issuer || '').trim();
}

function isValidAt(certificate, now) {
  const notBefore = new Date(certificate.notBefore);
  const notAfter = new Date(certificate.notAfter);
  return Number.isFinite(notBefore.getTime()) && Number.isFinite(notAfter.getTime()) && notBefore <= now && now < notAfter;
}

function publicCertificateSummary(certificate, now) {
  const hasPrivateKey = certificate.hasPrivateKey === true;
  const validNow = isValidAt(certificate, now);
  const codeSigningUsage = hasCodeSigningUsage(certificate);
  const selfSigned = isSelfSigned(certificate);
  const chainTrusted = certificate.chainTrusted === true;
  const usableCodeSigning = hasPrivateKey && validNow && codeSigningUsage;
  const publicReleaseCandidate = usableCodeSigning && chainTrusted && !selfSigned;

  return {
    subject: certificate.subject || null,
    issuer: certificate.issuer || null,
    thumbprint: certificate.thumbprint || null,
    storeLocation: certificate.storeLocation || null,
    storeName: certificate.storeName || null,
    notAfter: certificate.notAfter || null,
    hasPrivateKey,
    codeSigningUsage,
    validNow,
    selfSigned,
    chainTrusted,
    usableCodeSigning,
    publicReleaseCandidate,
  };
}

function summarizeSigningCertificates(certificates, now = new Date()) {
  const candidates = certificates.map((certificate) => publicCertificateSummary(certificate, now));
  const usableCodeSigningCertificates = candidates.filter((candidate) => candidate.usableCodeSigning);
  const publicReleaseCandidates = candidates.filter((candidate) => candidate.publicReleaseCandidate);
  const blockingReleaseRisks = [];

  if (usableCodeSigningCertificates.length === 0) {
    blockingReleaseRisks.push({
      code: 'no-usable-code-signing-certificate',
      message: 'No unexpired code-signing certificate with an available private key was found.',
    });
  }
  if (publicReleaseCandidates.length === 0) {
    blockingReleaseRisks.push({
      code: 'no-trusted-code-signing-certificate',
      message: 'No trusted non-self-signed code-signing certificate candidate was found for public Windows release signing.',
    });
  }

  return {
    scannedCertificates: certificates.length,
    usableCodeSigningCertificates,
    publicReleaseCandidates,
    blockingReleaseRisks,
  };
}

function readCertificatesFromJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function runPowerShellJson(script) {
  const shells = ['pwsh', 'powershell'];
  const errors = [];
  for (const shell of shells) {
    const result = childProcess.spawnSync(shell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { encoding: 'utf8' });
    if (result.status === 0) return result.stdout.trim() || '[]';
    errors.push(`${shell}: ${result.stderr || result.stdout || result.error?.message || 'failed'}`);
  }
  throw new Error(`Unable to query Windows certificate store. ${errors.join(' | ')}`);
}

function readWindowsCertificateStore() {
  const script = `
$ErrorActionPreference = "SilentlyContinue"
$storePaths = @(
  @{ Path = "Cert:\\CurrentUser\\My"; StoreLocation = "CurrentUser"; StoreName = "My" },
  @{ Path = "Cert:\\LocalMachine\\My"; StoreLocation = "LocalMachine"; StoreName = "My" }
)
$results = @()
foreach ($storePath in $storePaths) {
  if (!(Test-Path -LiteralPath $storePath.Path)) { continue }
  foreach ($cert in Get-ChildItem -LiteralPath $storePath.Path -ErrorAction SilentlyContinue) {
    $chain = [System.Security.Cryptography.X509Certificates.X509Chain]::new()
    $chain.ChainPolicy.RevocationMode = [System.Security.Cryptography.X509Certificates.X509RevocationMode]::NoCheck
    $chainTrusted = $chain.Build($cert)
    $chainStatus = @($chain.ChainStatus | ForEach-Object { [string]$_.Status })
    $enhancedKeyUsages = @()
    foreach ($usage in @($cert.EnhancedKeyUsageList)) {
      if ($usage.FriendlyName) { $enhancedKeyUsages += [string]$usage.FriendlyName }
      if ($usage.ObjectId) { $enhancedKeyUsages += [string]$usage.ObjectId.Value }
    }
    $results += [ordered]@{
      subject = [string]$cert.Subject
      issuer = [string]$cert.Issuer
      thumbprint = [string]$cert.Thumbprint
      notBefore = $cert.NotBefore.ToUniversalTime().ToString("o")
      notAfter = $cert.NotAfter.ToUniversalTime().ToString("o")
      hasPrivateKey = [bool]$cert.HasPrivateKey
      enhancedKeyUsages = $enhancedKeyUsages
      chainTrusted = [bool]$chainTrusted
      chainStatus = $chainStatus
      storeLocation = [string]$storePath.StoreLocation
      storeName = [string]$storePath.StoreName
    }
  }
}
$results | ConvertTo-Json -Depth 8
`;
  const output = runPowerShellJson(script);
  const parsed = JSON.parse(output || '[]');
  return Array.isArray(parsed) ? parsed : [parsed];
}

function loadCertificates(options) {
  if (options.certificatesJson) return readCertificatesFromJson(options.certificatesJson);
  return readWindowsCertificateStore();
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const certificates = loadCertificates(options);
    const summary = summarizeSigningCertificates(certificates, options.now || new Date());
    console.log(JSON.stringify(summary, null, 2));
    if (options.requireCertificate && summary.blockingReleaseRisks.length > 0) {
      throw new Error(`signing certificate preflight failed: ${summary.blockingReleaseRisks.map((risk) => risk.code).join(', ')}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = { summarizeSigningCertificates };
