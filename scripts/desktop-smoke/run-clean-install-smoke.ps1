param(
  [string]$InstallerPath = "",
  [int]$TimeoutSeconds = 30
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

$resolvedInstaller = Resolve-InstallerPath $InstallerPath
if (!(Test-Path -LiteralPath $resolvedInstaller -PathType Leaf)) {
  throw "NSIS installer not found: $resolvedInstaller"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runRoot = Join-Path (Join-Path $repoRoot "output\clean-install-smoke") "run-$stamp"
$installDir = Join-Path $runRoot "install"
$appData = Join-Path $runRoot "AppData\Roaming"
$localAppData = Join-Path $runRoot "AppData\Local"
$isolatedAppRoot = Join-Path $runRoot "isolated-app-data"
$tempDir = Join-Path $runRoot "Temp"
$stdout = Join-Path $runRoot "stdout.log"
$stderr = Join-Path $runRoot "stderr.log"
New-Item -ItemType Directory -Force -Path $installDir, $appData, $localAppData, $isolatedAppRoot, $tempDir | Out-Null

$install = Start-HiddenProcess -FilePath $resolvedInstaller -ArgumentList @("/S", "/D=$installDir")
if ($install.ExitCode -ne 0) {
  throw "Clean install smoke failed: installer exited with code $($install.ExitCode). Installer=$resolvedInstaller"
}

$installedExe = Join-Path $installDir "mikavn-library.exe"
if (!(Test-Path -LiteralPath $installedExe -PathType Leaf)) {
  $installedExes = @(Get-ChildItem -LiteralPath $installDir -Filter "*.exe" -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne "uninstall.exe" })
  if ($installedExes.Count -eq 1) {
    $installedExe = $installedExes[0].FullName
  } else {
    $installedFiles = Get-ChildItem -LiteralPath $installDir -Recurse -File -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
    throw "Clean install smoke failed: installed executable was not found under $installDir. Files:`n$($installedFiles -join "`n")"
  }
}

$psi = [System.Diagnostics.ProcessStartInfo]::new()
$psi.FileName = $installedExe
$psi.WorkingDirectory = Split-Path -Parent $installedExe
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
    if ($candidate) {
      $dbPath = $candidate.FullName
    }
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
  throw "Clean install smoke failed: installed app did not create or expose mikavn.db within $TimeoutSeconds seconds. ProcessExited=$($process.HasExited) ExitCode=$(if ($process.HasExited) { $process.ExitCode } else { 'running' }) WindowTitle=$windowTitle Files:`n$($allFiles -join "`n")"
}

$resolvedIsolatedRoot = (Resolve-Path -LiteralPath $isolatedAppRoot).Path
$resolvedDbPath = (Resolve-Path -LiteralPath $dbPath).Path
if (!$resolvedDbPath.StartsWith($resolvedIsolatedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Clean install smoke failed: database was created outside isolated app data. Database=$resolvedDbPath IsolatedRoot=$resolvedIsolatedRoot"
}

if (!$windowDetected) {
  throw "Clean install smoke failed: installed app did not expose a main window before timeout. ProcessExited=$($process.HasExited) ExitCode=$(if ($process.HasExited) { $process.ExitCode } else { 'running' })"
}

$uninstallExe = Join-Path $installDir "uninstall.exe"
$uninstallExitCode = $null
if (Test-Path -LiteralPath $uninstallExe -PathType Leaf) {
  $uninstall = Start-HiddenProcess -FilePath $uninstallExe -ArgumentList @("/S") -WorkingDirectory $installDir
  $uninstallExitCode = $uninstall.ExitCode
  if ($uninstallExitCode -ne 0) {
    throw "Clean install smoke failed: uninstaller exited with code $uninstallExitCode. Uninstaller=$uninstallExe"
  }
}

$uninstallEntry = Get-ItemProperty HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\* -ErrorAction SilentlyContinue |
  Where-Object { $_.DisplayName -eq "MikaVN Library" -and $_.InstallLocation -like "*$installDir*" } |
  Select-Object -First 1
if ($uninstallEntry) {
  throw "Clean install smoke failed: uninstall registry entry still points to $installDir."
}

$report = [ordered]@{
  installer = $resolvedInstaller
  installExitCode = $install.ExitCode
  installDir = $installDir
  installedExe = $installedExe
  processStarted = $true
  processStayedAliveUntilDbCreated = $wasRunning
  mainWindowDetected = $windowDetected
  mainWindowHandle = $mainWindowHandle
  mainWindowTitle = $windowTitle
  isolatedAppDataRoot = $resolvedIsolatedRoot
  appDataRoot = Split-Path -Parent $dbPath
  database = $dbPath
  databaseBytes = (Get-Item -LiteralPath $dbPath).Length
  uninstallExitCode = $uninstallExitCode
  runRoot = $runRoot
}

$report | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $runRoot "clean-install-smoke-report.json") -Encoding UTF8
$report | ConvertTo-Json -Depth 4
