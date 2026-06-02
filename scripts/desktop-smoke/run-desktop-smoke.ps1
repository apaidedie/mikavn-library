param(
  [string]$ExePath = "src-tauri\target\release\mikavn-library.exe",
  [string]$InstallerPath = "",
  [int]$TimeoutSeconds = 25
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

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

$resolvedExe = Resolve-SmokePath $ExePath "Release executable"
$resolvedInstaller = Resolve-InstallerPath $InstallerPath

if (!(Test-Path -LiteralPath $resolvedExe -PathType Leaf)) {
  throw "Release executable not found: $resolvedExe"
}

if (!(Test-Path -LiteralPath $resolvedInstaller -PathType Leaf)) {
  throw "NSIS installer not found: $resolvedInstaller"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runRoot = Join-Path (Join-Path $repoRoot 'output\desktop-smoke') "run-$stamp"
$appData = Join-Path $runRoot "AppData\Roaming"
$localAppData = Join-Path $runRoot "AppData\Local"
$isolatedAppRoot = Join-Path $runRoot "isolated-app-data"
$tempDir = Join-Path $runRoot "Temp"
$stdout = Join-Path $runRoot "stdout.log"
$stderr = Join-Path $runRoot "stderr.log"
New-Item -ItemType Directory -Force -Path $appData, $localAppData, $isolatedAppRoot, $tempDir | Out-Null

$psi = [System.Diagnostics.ProcessStartInfo]::new()
$psi.FileName = $resolvedExe
$psi.WorkingDirectory = Split-Path -Parent $resolvedExe
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.EnvironmentVariables["APPDATA"] = $appData
$psi.EnvironmentVariables["LOCALAPPDATA"] = $localAppData
$psi.EnvironmentVariables["MIKAVN_APP_DATA_DIR"] = $isolatedAppRoot
$psi.EnvironmentVariables["TEMP"] = $tempDir
$psi.EnvironmentVariables["TMP"] = $tempDir

$process = [System.Diagnostics.Process]::new()
$process.StartInfo = $psi
$null = $process.Start()

$dbPath = $null
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

  if (!$dbPath) {
    $candidate = Get-ChildItem -LiteralPath $isolatedAppRoot -Recurse -Filter "mikavn.db" -File -ErrorAction SilentlyContinue | Select-Object -First 1
  }
  if (!$dbPath -and $candidate) {
    $dbPath = $candidate.FullName
  }

  if ($dbPath -and $windowDetected) {
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

if (!$dbPath) {
  $allFiles = Get-ChildItem -LiteralPath $runRoot -Recurse -File -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
  throw "Desktop smoke failed: app did not create or expose mikavn.db within $TimeoutSeconds seconds. ProcessExited=$($process.HasExited) ExitCode=$(if ($process.HasExited) { $process.ExitCode } else { 'running' }) WindowTitle=$windowTitle Files:`n$($allFiles -join "`n")"
}

$resolvedIsolatedRoot = (Resolve-Path -LiteralPath $isolatedAppRoot).Path
$resolvedDbPath = (Resolve-Path -LiteralPath $dbPath).Path
if (!$resolvedDbPath.StartsWith($resolvedIsolatedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Desktop smoke failed: database was created outside isolated app data. Database=$resolvedDbPath IsolatedRoot=$resolvedIsolatedRoot"
}

if (!$windowDetected) {
  throw "Desktop smoke failed: release exe did not expose a main window before timeout. ProcessExited=$($process.HasExited) ExitCode=$(if ($process.HasExited) { $process.ExitCode } else { 'running' })"
}

$appRoot = Split-Path -Parent $dbPath
$requiredDirs = @("images", "cache", "logs", "save-backups", "pending-restore", "database-restore-protection")
$missingDirs = @($requiredDirs | Where-Object { !(Test-Path -LiteralPath (Join-Path $appRoot $_) -PathType Container) })
if ($missingDirs.Count -gt 0) {
  throw "Desktop smoke failed: missing app data directories under ${appRoot}: $($missingDirs -join ', ')"
}

$report = [ordered]@{
  exe = $resolvedExe
  installer = $resolvedInstaller
  processStarted = $true
  processStayedAliveUntilDbCreated = $wasRunning
  mainWindowDetected = $windowDetected
  mainWindowHandle = $mainWindowHandle
  mainWindowTitle = $windowTitle
  isolatedAppDataRoot = $resolvedIsolatedRoot
  appDataRoot = $appRoot
  database = $dbPath
  databaseBytes = (Get-Item -LiteralPath $dbPath).Length
  runRoot = $runRoot
}

$report | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $runRoot "desktop-smoke-report.json") -Encoding UTF8
$report | ConvertTo-Json -Depth 4
