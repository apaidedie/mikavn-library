param(
  [switch]$StrictGitHubLinks,
  [switch]$SkipBrowserSmoke,
  [switch]$SkipLargeSmoke,
  [switch]$SkipTauriBuild,
  [switch]$SkipInstallSmoke,
  [switch]$SkipPortableDataSmoke,
  [switch]$SkipDesktopSmoke
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Invoke-Step([string]$Name, [scriptblock]$Action) {
  Write-Host "==> $Name"
  & $Action
}

Push-Location $repoRoot
try {
  $releaseCheckArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $repoRoot "scripts\release\check-release-metadata.ps1"))
  if ($StrictGitHubLinks) {
    $releaseCheckArgs += "-StrictGitHubLinks"
  }

  Invoke-Step "Release metadata" { pwsh @releaseCheckArgs }
  Invoke-Step "Script unit tests" {
    npm run test:release-scripts
    npm run test:playwright-scripts
    npm run test:updater-release
    npm run test:image-src
  }
  Invoke-Step "Frontend build" { npm run build }

  Push-Location (Join-Path $repoRoot "src-tauri")
  try {
    Invoke-Step "Rust formatting" { cargo fmt --check }
    Invoke-Step "Rust clippy" { cargo clippy -- -D warnings }
    Invoke-Step "Rust tests" { cargo test }
  } finally {
    Pop-Location
  }

  if (!$SkipBrowserSmoke) {
    Invoke-Step "Browser smoke" { npm run smoke:browser }
  }
  if (!$SkipLargeSmoke) {
    Invoke-Step "Large-library smoke" { npm run smoke:large }
  }
  if (!$SkipTauriBuild) {
    Invoke-Step "Tauri release build" { npm run tauri:build }
  }
  if (!$SkipInstallSmoke) {
    Invoke-Step "Clean install smoke" { npm run smoke:install }
  }
  if (!$SkipPortableDataSmoke) {
    Invoke-Step "Portable app-data smoke" { npm run smoke:portable-data }
  }
  if (!$SkipDesktopSmoke) {
    Invoke-Step "Desktop smoke" { npm run smoke:desktop }
  }
} finally {
  Pop-Location
}
