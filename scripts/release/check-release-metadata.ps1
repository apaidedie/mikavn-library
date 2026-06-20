param(
  [switch]$StrictGitHubLinks
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Read-JsonFile([string]$Path) {
  Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Read-PackageLockVersion([string]$Path) {
  $content = Get-Content -LiteralPath $Path -Raw
  $match = [regex]::Match($content, '(?m)^\s*"version"\s*:\s*"([^"]+)"')
  if (!$match.Success) {
    throw "Could not read root version from package-lock.json."
  }
  $match.Groups[1].Value
}

$package = Read-JsonFile (Join-Path $repoRoot "package.json")
$tauri = Read-JsonFile (Join-Path $repoRoot "src-tauri\tauri.conf.json")
$cargoToml = Get-Content -LiteralPath (Join-Path $repoRoot "src-tauri\Cargo.toml") -Raw
$cargoVersion = [regex]::Match($cargoToml, "(?m)^version\s*=\s*`"([^`"]+)`"").Groups[1].Value
$packageLockVersion = Read-PackageLockVersion (Join-Path $repoRoot "package-lock.json")

$versions = @($package.version, $packageLockVersion, $tauri.version, $cargoVersion) | Sort-Object -Unique
if (@($versions).Count -ne 1) {
  throw "Version mismatch: package.json=$($package.version), package-lock.json=$packageLockVersion, tauri.conf.json=$($tauri.version), Cargo.toml=$cargoVersion"
}
$releaseVersion = @($versions)[0]

$requiredFiles = @(
  "LICENSE",
  "ARCHITECTURE.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "DATA_MODEL.md",
  "DESIGN.md",
  "ERROR_HANDLING.md",
  "PRIVACY.md",
  "ROADMAP.md",
  "SECURITY.md",
  "SUPPORT.md",
  "README.md",
  "RELEASE_CHECKLIST.md",
  "docs\README.md",
  "docs\RELEASE_NOTES_TEMPLATE.md",
  "docs\RELEASE_NOTES_0.1.1.md",
  "docs\CODE_SIGNING.md",
  "scripts\README.md",
  "output\README.md",
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

$requiredScripts = @("build", "typecheck", "test:release-scripts", "test:playwright-scripts", "test:updater-release", "test:diagnostic-export", "release:check", "release:check:strict", "release:signing:check", "release:signing:require", "release:sign", "release:handoff:check", "release:validate", "release:validate:strict", "release:validate:core", "smoke:browser", "smoke:large", "smoke:install", "smoke:portable-data", "tauri:build", "smoke:desktop")
foreach ($scriptName in $requiredScripts) {
  if ($null -eq $package.scripts.$scriptName -or [string]::IsNullOrWhiteSpace([string]$package.scripts.$scriptName)) {
    throw "package.json is missing required script '$scriptName'."
  }
}
foreach ($token in @("scripts/release/check-release-metadata.ps1", "-StrictGitHubLinks")) {
  $scriptText = [string]$package.scripts.'release:check:strict'
  if (!$scriptText.Contains($token)) {
    throw "package.json release:check:strict must include token '$token'."
  }
}
foreach ($token in @("scripts/release/run-release-validation.ps1", "-StrictGitHubLinks", "-SkipBrowserSmoke", "-SkipLargeSmoke", "-SkipTauriBuild", "-SkipInstallSmoke", "-SkipPortableDataSmoke", "-SkipDesktopSmoke")) {
  $scriptText = [string]$package.scripts.'release:validate:core'
  if (!$scriptText.Contains($token)) {
    throw "package.json release:validate:core must include token '$token'."
  }
}
foreach ($token in @("scripts/release/check-windows-signing.ps1", "-RequireSigned")) {
  $scriptText = [string]$package.scripts.'release:signing:require'
  if (!$scriptText.Contains($token)) {
    throw "package.json release:signing:require must include token '$token'."
  }
}
foreach ($token in @("scripts/release/sign-windows-release.ps1")) {
  $scriptText = [string]$package.scripts.'release:sign'
  if (!$scriptText.Contains($token)) {
    throw "package.json release:sign must include token '$token'."
  }
}
foreach ($token in @("scripts/release/check-release-handoff.cjs")) {
  $scriptText = [string]$package.scripts.'release:handoff:check'
  if (!$scriptText.Contains($token)) {
    throw "package.json release:handoff:check must include token '$token'."
  }
}
foreach ($token in @("scripts/release/check-build-chunks.test.cjs", "scripts/release/check-source-size.test.cjs", "scripts/release/check-release-handoff.test.cjs", "scripts/updater-release-config.test.cjs")) {
  $scriptText = [string]$package.scripts.'test:release-scripts'
  if (!$scriptText.Contains($token)) {
    throw "package.json test:release-scripts must include token '$token'."
  }
}
foreach ($token in @("updater-release-config.test.cjs", "updater-service-model.test.cjs", "settings-updater-section.test.cjs", "startup-updater.test.cjs")) {
  $scriptText = [string]$package.scripts.'test:updater-release'
  if (!$scriptText.Contains($token)) {
    throw "package.json test:updater-release must include token '$token'."
  }
}
foreach ($token in @("scripts/diagnostic-export.test.cjs")) {
  $scriptText = [string]$package.scripts.'test:diagnostic-export'
  if (!$scriptText.Contains($token)) {
    throw "package.json test:diagnostic-export must include token '$token'."
  }
}
foreach ($token in @("scripts/playwright/playwright-resolution.test.cjs")) {
  $scriptText = [string]$package.scripts.'test:playwright-scripts'
  if (!$scriptText.Contains($token)) {
    throw "package.json test:playwright-scripts must include token '$token'."
  }
}
foreach ($token in @("scripts/playwright/run-smoke-with-vite.cjs", "browser")) {
  $scriptText = [string]$package.scripts.'smoke:browser'
  if (!$scriptText.Contains($token)) {
    throw "package.json smoke:browser must include token '$token'."
  }
}
foreach ($token in @("scripts/playwright/run-smoke-with-vite.cjs", "large")) {
  $scriptText = [string]$package.scripts.'smoke:large'
  if (!$scriptText.Contains($token)) {
    throw "package.json smoke:large must include token '$token'."
  }
}
foreach ($token in @("scripts/desktop-smoke/run-clean-install-smoke.ps1")) {
  $scriptText = [string]$package.scripts.'smoke:install'
  if (!$scriptText.Contains($token)) {
    throw "package.json smoke:install must include token '$token'."
  }
}

foreach ($token in @("scripts/desktop-smoke/run-portable-app-data-smoke.ps1")) {
  $scriptText = [string]$package.scripts.'smoke:portable-data'
  if (!$scriptText.Contains($token)) {
    throw "package.json smoke:portable-data must include token '$token'."
  }
}

$requiredScriptFiles = @(
  "scripts\playwright\page-qa-runner.cjs",
  "scripts\playwright\core-workflow-smoke.cjs",
  "scripts\playwright\large-library-smoke.cjs",
  "scripts\playwright\run-smoke-with-vite.cjs",
  "scripts\desktop-smoke\run-desktop-smoke.ps1",
  "scripts\desktop-smoke\run-clean-install-smoke.ps1",
  "scripts\desktop-smoke\run-portable-app-data-smoke.ps1",
  "scripts\release\check-windows-signing.ps1",
  "scripts\release\sign-windows-release.ps1",
  "scripts\release\run-release-validation.ps1",
  "scripts\release\check-release-metadata.ps1",
  "scripts\release\check-build-chunks.cjs",
  "scripts\release\check-build-chunks.test.cjs",
  "scripts\release\check-source-size.cjs",
  "scripts\release\check-source-size.test.cjs",
  "scripts\release\check-release-handoff.cjs",
  "scripts\release\check-release-handoff.test.cjs",
  "scripts\diagnostic-export.test.cjs",
  "scripts\playwright\playwright-resolution.cjs",
  "scripts\playwright\playwright-resolution.test.cjs"
)
$missingScriptFiles = @($requiredScriptFiles | Where-Object { !(Test-Path -LiteralPath (Join-Path $repoRoot $_) -PathType Leaf) })
if ($missingScriptFiles.Count -gt 0) {
  throw "Missing required verification scripts: $($missingScriptFiles -join ', ')"
}

$desktopSmokeScript = Get-Content -LiteralPath (Join-Path $repoRoot "scripts\desktop-smoke\run-desktop-smoke.ps1") -Raw
$cleanInstallSmokeScript = Get-Content -LiteralPath (Join-Path $repoRoot "scripts\desktop-smoke\run-clean-install-smoke.ps1") -Raw
$portableAppDataSmokeScript = Get-Content -LiteralPath (Join-Path $repoRoot "scripts\desktop-smoke\run-portable-app-data-smoke.ps1") -Raw
$coreWorkflowSmoke = Get-Content -LiteralPath (Join-Path $repoRoot "scripts\playwright\core-workflow-smoke.cjs") -Raw
$appPathsSource = Get-Content -LiteralPath (Join-Path $repoRoot "src-tauri\src\infrastructure\paths.rs") -Raw
$loggerSource = Get-Content -LiteralPath (Join-Path $repoRoot "src-tauri\src\infrastructure\logger.rs") -Raw
$logsServiceSource = Get-Content -LiteralPath (Join-Path $repoRoot "src-tauri\src\services\logs.rs") -Raw
$taskRepositorySource = Get-Content -LiteralPath (Join-Path $repoRoot "src-tauri\src\repositories\tasks.rs") -Raw
$architectureDoc = Get-Content -LiteralPath (Join-Path $repoRoot "ARCHITECTURE.md") -Raw
$contributingDoc = Get-Content -LiteralPath (Join-Path $repoRoot "CONTRIBUTING.md") -Raw
$designDoc = Get-Content -LiteralPath (Join-Path $repoRoot "DESIGN.md") -Raw
$readme = Get-Content -LiteralPath (Join-Path $repoRoot "README.md") -Raw
$releaseChecklist = Get-Content -LiteralPath (Join-Path $repoRoot "RELEASE_CHECKLIST.md") -Raw
$ciWorkflow = Get-Content -LiteralPath (Join-Path $repoRoot ".github\workflows\ci.yml") -Raw
$releaseWorkflow = Get-Content -LiteralPath (Join-Path $repoRoot ".github\workflows\release.yml") -Raw
$releaseNotesTemplate = Get-Content -LiteralPath (Join-Path $repoRoot "docs\RELEASE_NOTES_TEMPLATE.md") -Raw
$releaseNotes011 = Get-Content -LiteralPath (Join-Path $repoRoot "docs\RELEASE_NOTES_0.1.1.md") -Raw
$codeSigningDoc = Get-Content -LiteralPath (Join-Path $repoRoot "docs\CODE_SIGNING.md") -Raw

foreach ($content in @($releaseWorkflow, $releaseNotesTemplate, $releaseChecklist)) {
  if ($content.Contains("release:check -- -StrictGitHubLinks")) {
    throw "Use npm run release:check:strict instead of npm argument forwarding for strict release checks."
  }
}

if (!$desktopSmokeScript.Contains("MIKAVN_APP_DATA_DIR")) {
  throw "Desktop smoke must set MIKAVN_APP_DATA_DIR so release checks never use the real user app data directory."
}
if (!$desktopSmokeScript.Contains("Resolve-InstallerPath") -or !$desktopSmokeScript.Contains("src-tauri\target\release\bundle\nsis")) {
  throw "Desktop smoke must discover the NSIS installer from the release bundle directory by default."
}
if ($desktopSmokeScript -match 'MikaVN Library_\d+\.\d+\.\d+_x64-setup\.exe') {
  throw "Desktop smoke must not hard-code a versioned NSIS installer filename."
}
if (!$desktopSmokeScript.Contains("isolated-app-data")) {
  throw "Desktop smoke must place its app data override under output/desktop-smoke/run-*/isolated-app-data."
}
if (!$desktopSmokeScript.Contains("StartsWith") -or !$desktopSmokeScript.Contains("isolated app data")) {
  throw "Desktop smoke must fail if mikavn.db is created outside the isolated app data root."
}
foreach ($reportField in @("isolatedAppDataRoot", "appDataRoot", "database", "mainWindowDetected", "mainWindowHandle")) {
  if (!$desktopSmokeScript.Contains($reportField)) {
    throw "Desktop smoke report is missing required field '$reportField'."
  }
}
if (!$desktopSmokeScript.Contains('$dbPath -and $windowDetected')) {
  throw "Desktop smoke must wait for both database creation and main window detection before stopping the app."
}
foreach ($token in @("/S", "/D=", "uninstall.exe", "MIKAVN_APP_DATA_DIR", "clean-install-smoke-report.json")) {
  if (!$cleanInstallSmokeScript.Contains($token)) {
    throw "Clean install smoke must keep installer lifecycle token '$token'."
  }
}
foreach ($token in @("/S", "/D=", "uninstall.exe", "app-data", ".mikavn-portable", "MIKAVN_APP_DATA_DIR", "Portable app-data smoke", "portable-app-data-smoke-report.json", "appDataPersistsAfterUninstall")) {
  if (!$portableAppDataSmokeScript.Contains($token)) {
    throw "Portable app-data smoke must keep executable-adjacent app-data lifecycle token '$token'."
  }
}

foreach ($token in @("afterSavedSearchDelete", "afterBackupDelete", "savePathsAfterRemove", "record-only deletes")) {
  if (!$coreWorkflowSmoke.Contains($token)) {
    throw "Core workflow smoke must keep record-only delete safety assertion token '$token'."
  }
}

if (!$appPathsSource.Contains("MIKAVN_APP_DATA_DIR")) {
  throw "App path resolution must keep the MIKAVN_APP_DATA_DIR test override used by desktop smoke."
}
if (!$appPathsSource.Contains("is_relative()") -or !$appPathsSource.Contains("must be an absolute path")) {
  throw "MIKAVN_APP_DATA_DIR must reject relative paths before creating app data directories."
}
foreach ($token in @("app-data", ".mikavn-portable", "resolve_from_app", "AppDataDirSource::Portable", "migrate_default_app_data_to_portable", "INSTALLER_UNINSTALLER_FILE", "PORTABLE_MARKER_CONTENT")) {
  if (!$appPathsSource.Contains($token)) {
    throw "App path resolution must keep portable app-data discovery token '$token'."
  }
}

foreach ($token in @("browser-smoke", "npm run smoke:browser", "npm run smoke:large", "npm exec -- playwright install chromium", "browser-smoke-artifacts")) {
  if (!$ciWorkflow.Contains($token)) {
    throw "CI workflow must keep browser smoke gate token '$token'."
  }
}
foreach ($token in @("npm run test:release-scripts", "npm run test:playwright-scripts", "npm run test:updater-release", "npm run test:diagnostic-export")) {
  if (!$ciWorkflow.Contains($token)) {
    throw "CI workflow must keep script unit-test gate token '$token'."
  }
}
foreach ($token in @("cargo fmt --check", "cargo clippy -- -D warnings", "cargo test")) {
  if (!$ciWorkflow.Contains($token)) {
    throw "CI workflow must keep Rust quality gate token '$token'."
  }
}
foreach ($token in @("npm run release:check:strict", "npm run test:release-scripts", "npm run test:playwright-scripts", "npm run test:updater-release", "npm run test:diagnostic-export", "cargo fmt --check", "cargo clippy -- -D warnings", "npm run tauri:build", "npm run smoke:install", "npm run smoke:portable-data", "npm run smoke:desktop", "desktop-smoke-report", "output/clean-install-smoke/**", "output/portable-app-data-smoke/**", "output/desktop-smoke/**")) {
  if (!$releaseWorkflow.Contains($token)) {
    throw "Release workflow must keep desktop smoke gate token '$token'."
  }
}
foreach ($token in @("TAURI_SIGNING_PRIVATE_KEY", "Require updater signing secrets", "Create updater metadata", "latest.json", "*.sig")) {
  if (!$releaseWorkflow.Contains($token)) {
    throw "Release workflow must include updater token '$token'."
  }
}
if ($releaseWorkflow.IndexOf("npm run smoke:install") -lt $releaseWorkflow.IndexOf("npm run tauri:build")) {
  throw "Release workflow must run clean install smoke after building the Tauri bundle."
}
if ($releaseWorkflow.IndexOf("npm run smoke:portable-data") -lt $releaseWorkflow.IndexOf("npm run smoke:install")) {
  throw "Release workflow must run portable app-data smoke after clean install smoke."
}
if ($releaseWorkflow.IndexOf("npm run smoke:desktop") -lt $releaseWorkflow.IndexOf("npm run smoke:portable-data")) {
  throw "Release workflow must run desktop smoke after portable app-data smoke."
}
if ($releaseWorkflow.IndexOf("src-tauri/target/release/bundle/nsis/*.exe") -lt $releaseWorkflow.IndexOf("npm run smoke:desktop")) {
  throw "Release workflow must run desktop smoke before uploading installer artifacts."
}

foreach ($token in @("npm run release:validate:strict", "npm run release:check:strict", "npm run test:release-scripts", "npm run test:playwright-scripts", "npm run test:updater-release", "npm run test:diagnostic-export", "npm run build", "cargo fmt --check", "cargo clippy -- -D warnings", "cargo test", "npm run tauri:build", "npm run smoke:install", "npm run smoke:portable-data", "npm run smoke:desktop", "npm run smoke:browser", "npm run smoke:large")) {
  if (!$releaseNotesTemplate.Contains($token)) {
    throw "Release notes template must document verification command '$token'."
  }
}
foreach ($token in @("0.1.1", "Windows GUI", "npm run release:validate:strict", "npm run smoke:install", "npm run smoke:portable-data", "npm run release:signing:check", "local-only data safety")) {
  if (!$releaseNotes011.Contains($token)) {
    throw "0.1.1 release notes must document token '$token'."
  }
}
foreach ($token in @("trusted OV/EV", "signtool.exe", "npm run release:sign", "npm run release:signing:require", "SmartScreen")) {
  if (!$codeSigningDoc.Contains($token)) {
    throw "CODE_SIGNING.md must document token '$token'."
  }
}
foreach ($token in @("browser", "Vite", "desktop smoke artifacts")) {
  if (!$releaseNotesTemplate.Contains($token)) {
    throw "Release notes template must document CI artifact coverage token '$token'."
  }
}
foreach ($token in @("npm run release:check:strict", "npm run release:validate:strict", "npm run release:validate:core", "npm run test:release-scripts", "npm run test:playwright-scripts", "npm run smoke:large", "npm run smoke:install", "npm run smoke:portable-data", "npm run release:handoff:check", "RELEASE_VALIDATION_REPORT.md", "MANUAL_RISK_PASS_CHECKLIST.md", "output/desktop-smoke/run-*/isolated-app-data", "docs/CODE_SIGNING.md")) {
  if (!$releaseChecklist.Contains($token)) {
    throw "RELEASE_CHECKLIST.md must document release gate token '$token'."
  }
}
foreach ($token in @("Mature V1 task/progress surfaces", "Dashboard recent-task panel", "Tasks page with logs, retry, and cancellation")) {
  if (!$designDoc.Contains($token)) {
    throw "DESIGN.md must document current task/progress design state token '$token'."
  }
}

foreach ($token in @("api_key", "token", "password", "C:\Users\[user]")) {
  if (!$loggerSource.Contains($token)) {
    throw "Logger redaction baseline is missing token '$token'."
  }
}
foreach ($token in @("logger::redact_sensitive_text", "logger::display_path", "list_logs_redacts_preview")) {
  if (!$logsServiceSource.Contains($token)) {
    throw "Diagnostic log preview must keep redaction token '$token'."
  }
}
if (!$taskRepositorySource.Contains("logger::redact_sensitive_text")) {
  throw "Task repository must redact task messages, errors, and log entries before persistence."
}

foreach ($token in @("cargo fmt --check", "cargo clippy -- -D warnings", "cargo test")) {
  if (!$contributingDoc.Contains($token)) {
    throw "CONTRIBUTING.md quality gate must document '$token'."
  }
  if (!$architectureDoc.Contains($token)) {
    throw "ARCHITECTURE.md verification rules must document '$token'."
  }
}
foreach ($token in @("scripts/playwright/page-qa-runner.cjs", "scripts/playwright/core-workflow-smoke.cjs", "scripts/playwright/large-library-smoke.cjs")) {
  if (!$architectureDoc.Contains($token)) {
    throw "ARCHITECTURE.md verification rules must document script '$token'."
  }
}
foreach ($stalePath in @("output/playwright/page-qa-runner.cjs", "output/playwright/core-workflow-smoke.cjs")) {
  if ($architectureDoc.Contains($stalePath)) {
    throw "ARCHITECTURE.md must not point to stale smoke runner path '$stalePath'."
  }
}
foreach ($token in @("current repository test count", "Rust tests", "get_app_data_diagnostics", "cleanup_old_database_backups", "cargo clippy -- -D warnings", "1500 browser-preview records", "advanced search", "npm run release:check:strict", "npm run release:validate:strict", "npm run release:validate:core", "npm run test:release-scripts", "npm run test:playwright-scripts", "npm run test:diagnostic-export", "npm run smoke:large", "npm run smoke:install", "npm run smoke:portable-data", "npm run tauri:build", "npm run smoke:desktop", "npm run release:handoff:check", "output/desktop-smoke/run-*/isolated-app-data")) {
  if (!$readme.Contains($token)) {
    throw "README.md verification snapshot must document '$token'."
  }
}

$releaseValidationScript = Get-Content -LiteralPath (Join-Path $repoRoot "scripts\release\run-release-validation.ps1") -Raw
foreach ($token in @("check-release-metadata.ps1", "-StrictGitHubLinks", "npm run test:release-scripts", "npm run test:playwright-scripts", "npm run test:diagnostic-export", "cargo fmt --check", "cargo clippy -- -D warnings", "cargo test", "npm run smoke:browser", "npm run smoke:large", "npm run tauri:build", "npm run smoke:install", "npm run smoke:portable-data", "npm run smoke:desktop")) {
  if (!$releaseValidationScript.Contains($token)) {
    throw "Release validation script must keep validation step '$token'."
  }
}

if ($package.license -ne "MIT") {
  throw "package.json license should match LICENSE. Expected MIT, got '$($package.license)'."
}

if ($cargoToml -notmatch '(?m)^license\s*=\s*"MIT"') {
  throw "src-tauri/Cargo.toml license should match LICENSE. Expected MIT."
}

$security = $tauri.app.security
if ($null -eq $security) {
  throw "src-tauri/tauri.conf.json must define app.security for release builds."
}

if ($null -eq $security.csp -or [string]::IsNullOrWhiteSpace([string]$security.csp)) {
  throw "Tauri CSP must be explicit; do not release with app.security.csp set to null or empty."
}

$csp = [string]$security.csp
$requiredCspTokens = @(
  "default-src 'self'",
  "script-src 'self'",
  "connect-src 'self'",
  "ipc:",
  "http://ipc.localhost",
  "img-src",
  "asset:",
  "http://asset.localhost"
)
foreach ($token in $requiredCspTokens) {
  if (!$csp.Contains($token)) {
    throw "Tauri CSP is missing required token '$token'."
  }
}
if ($csp -match "(?i)script-src[^;]*'unsafe-(inline|eval)'") {
  throw "Tauri CSP must not allow unsafe inline/eval scripts."
}

if ($security.freezePrototype -ne $true) {
  throw "Tauri app.security.freezePrototype must remain enabled."
}

$assetProtocol = $security.assetProtocol
if ($null -eq $assetProtocol -or $assetProtocol.enable -ne $true) {
  throw "Tauri asset protocol must remain enabled for imported local images."
}

$assetScope = $assetProtocol.scope
if ($null -eq $assetScope) {
  throw "Tauri asset protocol must define a scoped allow/deny policy."
}
$assetAllow = @($assetScope.allow)
$assetDeny = @($assetScope.deny)
foreach ($allowedPath in @("`$APPDATA/**", "`$APPLOCALDATA/**", "`$APPCACHE/**", "`$EXE/../app-data/images/**")) {
  if ($assetAllow -notcontains $allowedPath) {
    throw "Tauri asset protocol allow scope is missing $allowedPath."
  }
}
foreach ($allowedPath in $assetAllow) {
  if ([string]$allowedPath -match '^[A-Za-z]:[\\/]') {
    throw "Tauri asset protocol allow scope must not hard-code a local drive path: $allowedPath."
  }
}
foreach ($deniedPath in @("`$APPDATA/**/mikavn.db", "`$APPDATA/**/*.db", "`$APPDATA/**/*.sqlite", "`$APPDATA/**/*.sqlite3", "`$APPDATA/**/logs/**")) {
  if ($assetDeny -notcontains $deniedPath) {
    throw "Tauri asset protocol deny scope is missing $deniedPath."
  }
}

if ($cargoToml -notmatch '(?m)^tauri\s*=\s*\{[^\r\n]*features\s*=\s*\[[^\]]*"protocol-asset"') {
  throw "src-tauri/Cargo.toml must enable the tauri protocol-asset feature when assetProtocol is enabled."
}

if ($StrictGitHubLinks) {
  $filesToCheck = @(
    "README.md",
    "ARCHITECTURE.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "DATA_MODEL.md",
    "DESIGN.md",
    "ERROR_HANDLING.md",
    "PRIVACY.md",
    "ROADMAP.md",
    "SECURITY.md",
    "SUPPORT.md",
    "RELEASE_CHECKLIST.md",
    "docs\README.md",
    ".github\ISSUE_TEMPLATE\config.yml",
    "docs\RELEASE_NOTES_TEMPLATE.md",
    "docs\RELEASE_NOTES_0.1.1.md",
    "docs\CODE_SIGNING.md",
    "scripts\README.md",
    "output\README.md"
  )
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
  verificationScripts = $requiredScripts.Count
  tauriSecurity = "csp+freezePrototype+scopedAssetProtocol"
  privacyRedaction = "task-logs+diagnostic-preview"
  desktopSmokeIsolation = "MIKAVN_APP_DATA_DIR+isolated-app-data+absolute-path-guard"
  portableAppData = "exe-adjacent-app-data+marker+default-copy-migration"
  ciSmokeGates = "browser+large+portable-data+desktop-release"
  strictGitHubLinks = [bool]$StrictGitHubLinks
} | ConvertTo-Json -Depth 3
