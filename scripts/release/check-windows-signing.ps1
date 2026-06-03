param(
  [string]$InstallerPath = "",
  [string]$ExePath = "src-tauri\target\release\mikavn-library.exe",
  [switch]$RequireSigned
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

$resolvedInstaller = Resolve-InstallerPath $InstallerPath
$resolvedExe = Resolve-ReleasePath $ExePath "Release executable"
$files = @($resolvedInstaller, $resolvedExe)

$signatures = foreach ($file in $files) {
  $signature = Get-AuthenticodeSignature -LiteralPath $file
  [ordered]@{
    path = $file
    status = [string]$signature.Status
    signerSubject = if ($signature.SignerCertificate) { $signature.SignerCertificate.Subject } else { $null }
    signerThumbprint = if ($signature.SignerCertificate) { $signature.SignerCertificate.Thumbprint } else { $null }
  }
}

$unsigned = @($signatures | Where-Object { $_.status -ne "Valid" })
$result = [ordered]@{
  signed = ($unsigned.Count -eq 0)
  requireSigned = [bool]$RequireSigned
  files = $signatures
  note = "A trusted OV/EV or trusted signing certificate is required to reduce Windows SmartScreen warnings; self-signed certificates are only useful for local trust testing."
}

$result | ConvertTo-Json -Depth 5

if ($RequireSigned -and $unsigned.Count -gt 0) {
  throw "Windows release artifacts are not fully signed with a valid trusted certificate."
}
