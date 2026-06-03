param(
  [Parameter(Mandatory = $true)]
  [string]$CertificateThumbprint,
  [string]$InstallerPath = "",
  [string]$ExePath = "src-tauri\target\release\mikavn-library.exe",
  [string]$TimestampUrl = "http://timestamp.digicert.com"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Resolve-ReleasePath([string]$Path, [string]$Description) {
  if ([string]::IsNullOrWhiteSpace($Path)) {
    throw "$Description path is required."
  }
  $candidate = if ([System.IO.Path]::IsPathRooted($Path)) { $Path } else { Join-Path $repoRoot $Path }
  (Resolve-Path -LiteralPath $candidate).Path
}

function Resolve-InstallerPath([string]$Path) {
  if (![string]::IsNullOrWhiteSpace($Path)) {
    return Resolve-ReleasePath $Path "Installer"
  }

  $bundleDir = Join-Path $repoRoot "src-tauri\target\release\bundle\nsis"
  if (!(Test-Path -LiteralPath $bundleDir -PathType Container)) {
    throw "NSIS installer directory not found: $bundleDir"
  }
  $installers = @(Get-ChildItem -LiteralPath $bundleDir -Filter "*.exe" -File | Sort-Object LastWriteTime -Descending)
  if ($installers.Count -eq 0) {
    throw "No NSIS installer found under $bundleDir"
  }
  $installers[0].FullName
}

function Resolve-SignTool {
  $fromPath = Get-Command signtool.exe -ErrorAction SilentlyContinue
  if ($fromPath) {
    return $fromPath.Source
  }

  $kitsRoot = "${env:ProgramFiles(x86)}\Windows Kits\10\bin"
  if (Test-Path -LiteralPath $kitsRoot -PathType Container) {
    $candidates = @(Get-ChildItem -LiteralPath $kitsRoot -Recurse -Filter signtool.exe -File -ErrorAction SilentlyContinue | Sort-Object FullName -Descending)
    if ($candidates.Count -gt 0) {
      return $candidates[0].FullName
    }
  }

  throw "signtool.exe was not found. Install Windows SDK or add signtool.exe to PATH before signing."
}

$thumbprint = ($CertificateThumbprint -replace "\s", "").ToUpperInvariant()
$cert = @(Get-ChildItem Cert:\CurrentUser\My, Cert:\LocalMachine\My -CodeSigningCert -ErrorAction SilentlyContinue |
  Where-Object { $_.Thumbprint -eq $thumbprint } |
  Select-Object -First 1)
if ($cert.Count -eq 0) {
  throw "Code signing certificate with thumbprint $thumbprint was not found in CurrentUser or LocalMachine certificate stores."
}
if (!$cert[0].HasPrivateKey) {
  throw "Code signing certificate $thumbprint does not have a private key available."
}

$signtool = Resolve-SignTool
$files = @(
  Resolve-ReleasePath $ExePath "Release executable",
  Resolve-InstallerPath $InstallerPath
)

foreach ($file in $files) {
  & $signtool sign /fd SHA256 /td SHA256 /tr $TimestampUrl /sha1 $thumbprint $file
  if ($LASTEXITCODE -ne 0) {
    throw "signtool failed for $file with exit code $LASTEXITCODE."
  }
}

& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check-windows-signing.ps1") -InstallerPath $InstallerPath -ExePath $ExePath -RequireSigned
