param(
  [switch]$StrictGitHubLinks
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Read-JsonFile([string]$Path) {
  Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

$package = Read-JsonFile (Join-Path $repoRoot "package.json")
$tauri = Read-JsonFile (Join-Path $repoRoot "src-tauri\tauri.conf.json")
$cargoToml = Get-Content -LiteralPath (Join-Path $repoRoot "src-tauri\Cargo.toml") -Raw
$cargoVersion = [regex]::Match($cargoToml, "(?m)^version\s*=\s*`"([^`"]+)`"").Groups[1].Value

$versions = @($package.version, $tauri.version, $cargoVersion) | Sort-Object -Unique
if (@($versions).Count -ne 1) {
  throw "Version mismatch: package.json=$($package.version), tauri.conf.json=$($tauri.version), Cargo.toml=$cargoVersion"
}
$releaseVersion = @($versions)[0]

$requiredFiles = @(
  "LICENSE",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "SUPPORT.md",
  "README.md",
  "RELEASE_CHECKLIST.md",
  "docs\RELEASE_NOTES_TEMPLATE.md",
  ".github\workflows\ci.yml",
  ".github\workflows\release.yml",
  ".github\PULL_REQUEST_TEMPLATE.md",
  ".github\ISSUE_TEMPLATE\bug_report.yml",
  ".github\ISSUE_TEMPLATE\feature_request.yml"
)

$missing = @($requiredFiles | Where-Object { !(Test-Path -LiteralPath (Join-Path $repoRoot $_) -PathType Leaf) })
if ($missing.Count -gt 0) {
  throw "Missing release metadata files: $($missing -join ', ')"
}

if ($package.private -ne $true) {
  throw "package.json should remain private=true; GitHub release publishes the desktop installer, not an npm package."
}

if ($package.license -ne "MIT") {
  throw "package.json license should match LICENSE. Expected MIT, got '$($package.license)'."
}

if ($cargoToml -notmatch '(?m)^license\s*=\s*"MIT"') {
  throw "src-tauri/Cargo.toml license should match LICENSE. Expected MIT."
}

if ($StrictGitHubLinks) {
  $filesToCheck = @("README.md", ".github\ISSUE_TEMPLATE\config.yml", "docs\RELEASE_NOTES_TEMPLATE.md")
  foreach ($file in $filesToCheck) {
    $content = Get-Content -LiteralPath (Join-Path $repoRoot $file) -Raw
    if ($content.Contains("OWNER/REPO") -or $content.Contains("your-repo")) {
      throw "Replace repository placeholder links in $file before public release."
    }
  }
}

[ordered]@{
  version = $releaseVersion
  packageName = $package.name
  productName = $tauri.productName
  identifier = $tauri.identifier
  metadataFiles = $requiredFiles.Count
  strictGitHubLinks = [bool]$StrictGitHubLinks
} | ConvertTo-Json -Depth 3
