param(
  [string]$AppRoot = "E:\MikaVN Library",
  [string]$InstallerPath = "",
  [int]$TimeoutSeconds = 60
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

$databaseSummaryCode = @'
import json
import sqlite3
import sys

path = sys.argv[1]
conn = sqlite3.connect(path)

def scalar(sql):
    row = conn.execute(sql).fetchone()
    return row[0] if row else None

tables = {}
for name in ["games", "game_assets", "tasks", "task_logs", "save_backups"]:
    try:
        tables[name] = scalar(f"SELECT COUNT(*) FROM {name}")
    except Exception as error:
        tables[name] = {"error": str(error)}

print(json.dumps({
    "quickCheck": scalar("PRAGMA quick_check"),
    "userVersion": scalar("PRAGMA user_version"),
    "tables": tables,
}, ensure_ascii=False))
'@

function Resolve-SmokePath([string]$Path, [string]$Description) {
  if ([string]::IsNullOrWhiteSpace($Path)) {
    throw "$Description path is required."
  }
  $candidate = if ([System.IO.Path]::IsPathRooted($Path)) { $Path } else { Join-Path $repoRoot $Path }
  (Resolve-Path -LiteralPath $candidate).Path
}

function Resolve-InstallerPath([string]$Path) {
  if (![string]::IsNullOrWhiteSpace($Path)) {
    return Resolve-SmokePath $Path "NSIS installer"
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

function Start-HiddenProcess([string]$FilePath, [string[]]$ArgumentList, [string]$WorkingDirectory = "") {
  $startInfo = @{
    FilePath = $FilePath
    ArgumentList = $ArgumentList
    Wait = $true
    PassThru = $true
    WindowStyle = "Hidden"
  }
  if (![string]::IsNullOrWhiteSpace($WorkingDirectory)) {
    $startInfo.WorkingDirectory = $WorkingDirectory
  }
  Start-Process @startInfo
}

function Assert-NoRunningInstalledProcess([string]$ResolvedRoot) {
  $running = @(Get-Process | Where-Object {
    try {
      $_.Path -and ([System.IO.Path]::GetFullPath($_.Path)).StartsWith($ResolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)
    } catch {
      $false
    }
  })
  if ($running.Count -gt 0) {
    $items = @($running | ForEach-Object { "$($_.ProcessName)($($_.Id)) $($_.Path)" })
    throw "Real install update smoke refuses to run while installed app processes are active. Close them first:`n$($items -join "`n")"
  }
}

function Get-DirectoryFileCount([string]$Path) {
  if (!(Test-Path -LiteralPath $Path -PathType Container)) {
    return 0
  }
  @(Get-ChildItem -LiteralPath $Path -Recurse -File -ErrorAction SilentlyContinue).Count
}

function Invoke-DatabaseSummary([string]$Path) {
  $json = $databaseSummaryCode | python - $Path
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to inspect SQLite database: $Path"
  }
  $summary = $json | ConvertFrom-Json
  if ($summary.quickCheck -ne "ok") {
    throw "SQLite quick_check failed for ${Path}: $($summary.quickCheck)"
  }
  $summary
}

function Get-TableCount([object]$Summary, [string]$Name) {
  $value = $Summary.tables.PSObject.Properties[$Name].Value
  if ($value -is [pscustomobject] -and $value.error) {
    throw "Database table '$Name' could not be counted: $($value.error)"
  }
  [int64]$value
}

$resolvedAppRoot = Resolve-SmokePath $AppRoot "Installed MikaVN Library"
$resolvedInstaller = Resolve-InstallerPath $InstallerPath
$installedExe = Join-Path $resolvedAppRoot "mikavn-library.exe"
$appDataRoot = Join-Path $resolvedAppRoot "app-data"
$database = Join-Path $appDataRoot "mikavn.db"
$imagesRoot = Join-Path $appDataRoot "images"
$backupRoot = Join-Path $appDataRoot "database-backups"

if (!(Test-Path -LiteralPath $installedExe -PathType Leaf)) {
  throw "Installed executable not found: $installedExe"
}
if (!(Test-Path -LiteralPath $database -PathType Leaf)) {
  throw "Installed database not found: $database"
}

Assert-NoRunningInstalledProcess $resolvedAppRoot

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runRoot = Join-Path (Join-Path $repoRoot "output\real-install-update-smoke") "run-$stamp"
$stdout = Join-Path $runRoot "stdout.log"
$stderr = Join-Path $runRoot "stderr.log"
New-Item -ItemType Directory -Force -Path $runRoot | Out-Null

$before = Invoke-DatabaseSummary $database
$gamesBefore = Get-TableCount $before "games"
$gameAssetsBefore = Get-TableCount $before "game_assets"
$imagesBefore = Get-DirectoryFileCount $imagesRoot
$databaseBackupsBefore = Get-DirectoryFileCount $backupRoot
$sourceSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $database).Hash
$sourceBytes = (Get-Item -LiteralPath $database).Length

$backupDir = Join-Path $backupRoot "manual-install-smoke"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$backupPath = Join-Path $backupDir "before-real-install-$stamp.db"
Copy-Item -LiteralPath $database -Destination $backupPath -Force
$backupSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $backupPath).Hash
if ($backupSha256 -ne $sourceSha256) {
  throw "Pre-install database backup hash mismatch. Source=$sourceSha256 Backup=$backupSha256"
}
$backupSummary = Invoke-DatabaseSummary $backupPath
$backupDatabaseBeforeInstall = [ordered]@{
  path = $backupPath
  sourceSha256 = $sourceSha256
  backupSha256 = $backupSha256
  sourceBytes = $sourceBytes
  backupBytes = (Get-Item -LiteralPath $backupPath).Length
  quickCheck = $backupSummary.quickCheck
}

$install = Start-HiddenProcess -FilePath $resolvedInstaller -ArgumentList @("/S", "/D=$resolvedAppRoot")
if ($install.ExitCode -ne 0) {
  throw "Real install update smoke failed: installer exited with code $($install.ExitCode). Installer=$resolvedInstaller AppRoot=$resolvedAppRoot"
}

$psi = [System.Diagnostics.ProcessStartInfo]::new()
$psi.FileName = $installedExe
$psi.WorkingDirectory = $resolvedAppRoot
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true

$process = [System.Diagnostics.Process]::new()
$process.StartInfo = $psi
$null = $process.Start()

$windowTitle = $null
$windowDetected = $false
$mainWindowHandle = 0
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
  if ($process.HasExited) {
    break
  }
  $process.Refresh()
  if ($process.MainWindowHandle -ne 0) {
    $mainWindowHandle = $process.MainWindowHandle
    $windowDetected = $true
  }
  if ($process.MainWindowTitle) {
    $windowTitle = $process.MainWindowTitle
    $windowDetected = $true
  }
  if ($windowDetected) {
    break
  }
  Start-Sleep -Milliseconds 500
}

$wasRunning = -not $process.HasExited
if ($wasRunning) {
  $process.CloseMainWindow() | Out-Null
  if (!$process.WaitForExit(5000)) {
    try {
      $process.Kill()
    } catch {
      Stop-Process -Id $process.Id -Force
    }
    $process.WaitForExit(5000) | Out-Null
  }
}

try {
  $process.StandardOutput.ReadToEnd() | Set-Content -LiteralPath $stdout -Encoding UTF8
  $process.StandardError.ReadToEnd() | Set-Content -LiteralPath $stderr -Encoding UTF8
} catch {
  "failed to read redirected process output: $($_.Exception.Message)" | Set-Content -LiteralPath $stderr -Encoding UTF8
}

if (!$windowDetected) {
  throw "Real install update smoke failed: installed app did not expose a main window before timeout. ProcessExited=$($process.HasExited) ExitCode=$(if ($process.HasExited) { $process.ExitCode } else { 'running' })"
}

$after = Invoke-DatabaseSummary $database
$gamesAfter = Get-TableCount $after "games"
$gameAssetsAfter = Get-TableCount $after "game_assets"
$imagesAfter = Get-DirectoryFileCount $imagesRoot
$databaseBackupsAfter = Get-DirectoryFileCount $backupRoot

if ($gamesAfter -ne $gamesBefore) {
  throw "Real install update smoke failed: games count changed across install. Before=$gamesBefore After=$gamesAfter"
}
if ($gameAssetsAfter -ne $gameAssetsBefore) {
  throw "Real install update smoke failed: game asset count changed across install. Before=$gameAssetsBefore After=$gameAssetsAfter"
}
if ($imagesAfter -lt $imagesBefore) {
  throw "Real install update smoke failed: image file count decreased across install. Before=$imagesBefore After=$imagesAfter"
}
if ($databaseBackupsAfter -le $databaseBackupsBefore) {
  throw "Real install update smoke failed: verified pre-install backup did not increase database backup file count. Before=$databaseBackupsBefore After=$databaseBackupsAfter"
}

$report = [ordered]@{
  installer = $resolvedInstaller
  appRoot = $resolvedAppRoot
  installedExe = $installedExe
  appDataRoot = $appDataRoot
  database = $database
  installExitCode = $install.ExitCode
  backupDatabaseBeforeInstall = $backupDatabaseBeforeInstall
  before = [ordered]@{
    quickCheck = $before.quickCheck
    gamesBefore = $gamesBefore
    gameAssetsBefore = $gameAssetsBefore
    imagesBefore = $imagesBefore
    databaseBackupsBefore = $databaseBackupsBefore
  }
  after = [ordered]@{
    quickCheck = $after.quickCheck
    gamesAfter = $gamesAfter
    gameAssetsAfter = $gameAssetsAfter
    imagesAfter = $imagesAfter
    databaseBackupsAfter = $databaseBackupsAfter
  }
  launchAfterInstall = [ordered]@{
    processStarted = $true
    processStayedAliveUntilWindowDetected = $wasRunning
    mainWindowDetected = $windowDetected
    mainWindowHandle = $mainWindowHandle
    mainWindowTitle = $windowTitle
  }
  runRoot = $runRoot
}

$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $runRoot "real-install-update-smoke-report.json") -Encoding UTF8
$report | ConvertTo-Json -Depth 6
