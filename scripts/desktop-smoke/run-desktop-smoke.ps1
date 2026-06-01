param(
  [string]$ExePath = "src-tauri\target\release\mikavn-library.exe",
  [string]$InstallerPath = "src-tauri\target\release\bundle\nsis\MikaVN Library_0.1.0_x64-setup.exe",
  [int]$TimeoutSeconds = 25
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$resolvedExe = (Resolve-Path (Join-Path $repoRoot $ExePath)).Path
$resolvedInstaller = (Resolve-Path (Join-Path $repoRoot $InstallerPath)).Path

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
$tempDir = Join-Path $runRoot "Temp"
$stdout = Join-Path $runRoot "stdout.log"
$stderr = Join-Path $runRoot "stderr.log"
New-Item -ItemType Directory -Force -Path $appData, $localAppData, $tempDir | Out-Null

$psi = [System.Diagnostics.ProcessStartInfo]::new()
$psi.FileName = $resolvedExe
$psi.WorkingDirectory = Split-Path -Parent $resolvedExe
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.EnvironmentVariables["APPDATA"] = $appData
$psi.EnvironmentVariables["LOCALAPPDATA"] = $localAppData
$psi.EnvironmentVariables["TEMP"] = $tempDir
$psi.EnvironmentVariables["TMP"] = $tempDir

$process = [System.Diagnostics.Process]::new()
$process.StartInfo = $psi
$null = $process.Start()

$dbPath = $null
$windowTitle = $null
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
  if ($process.HasExited) {
    break
  }

  $process.Refresh()
  if ($process.MainWindowTitle) {
    $windowTitle = $process.MainWindowTitle
  }

  $candidate = Get-ChildItem -LiteralPath $appData -Recurse -Filter "mikavn.db" -File -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($candidate) {
    $dbPath = $candidate.FullName
    break
  }
  Start-Sleep -Milliseconds 500
}

$wasRunning = -not $process.HasExited
if ($wasRunning) {
  $process.CloseMainWindow() | Out-Null
  if (!$process.WaitForExit(5000)) {
    $process.Kill($true)
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
  $knownRoot = Join-Path $env:APPDATA "dev.mikavn.library"
  $knownDb = Join-Path $knownRoot "mikavn.db"
  if (Test-Path -LiteralPath $knownDb -PathType Leaf) {
    $dbPath = $knownDb
  }
}

if (!$dbPath) {
  $allFiles = Get-ChildItem -LiteralPath $runRoot -Recurse -File -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
  throw "Desktop smoke failed: app did not create or expose mikavn.db within $TimeoutSeconds seconds. ProcessExited=$($process.HasExited) ExitCode=$(if ($process.HasExited) { $process.ExitCode } else { 'running' }) WindowTitle=$windowTitle Files:`n$($allFiles -join "`n")"
}

if (!$windowTitle) {
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
  mainWindowTitle = $windowTitle
  appDataRoot = $appRoot
  database = $dbPath
  databaseBytes = (Get-Item -LiteralPath $dbPath).Length
  runRoot = $runRoot
}

$report | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $runRoot "desktop-smoke-report.json") -Encoding UTF8
$report | ConvertTo-Json -Depth 4
