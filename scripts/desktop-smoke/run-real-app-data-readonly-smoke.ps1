param(
  [string]$AppRoot = "E:\MikaVN Library",
  [int]$MinGameCount = 1,
  [int]$MinImageFiles = 1,
  [int]$MinBackupFiles = 1,
  [int]$MaxMissingLocalAssetPaths = 0,
  [switch]$NoReport
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Assert-UnderRoot([string]$Root, [string]$Path, [string]$Description) {
  $resolvedRoot = (Resolve-Path -LiteralPath $Root).Path
  $resolvedPath = (Resolve-Path -LiteralPath $Path).Path
  if (!$resolvedPath.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "$Description is outside expected root. Root=$resolvedRoot Path=$resolvedPath"
  }
  return $resolvedPath
}

function Get-DirectorySummary([string]$Root, [string]$Name) {
  $path = Assert-UnderRoot $Root (Join-Path $Root $Name) $Name
  $files = @(Get-ChildItem -LiteralPath $path -Recurse -File -ErrorAction SilentlyContinue)
  $bytes = ($files | Measure-Object -Property Length -Sum).Sum
  $latest = ($files | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime
  [ordered]@{
    path = $path
    fileCount = $files.Count
    totalBytes = [int64]$bytes
    latestFileTime = $latest
  }
}

$resolvedAppRoot = (Resolve-Path -LiteralPath $AppRoot).Path
$appDataRoot = Assert-UnderRoot $resolvedAppRoot (Join-Path $resolvedAppRoot "app-data") "app-data"
$databasePath = Assert-UnderRoot $appDataRoot (Join-Path $appDataRoot "mikavn.db") "database"
$exePath = Assert-UnderRoot $resolvedAppRoot (Join-Path $resolvedAppRoot "mikavn-library.exe") "installed executable"

$python = Get-Command python -ErrorAction SilentlyContinue
if (!$python) {
  throw "python is required for SQLite readonly smoke checks."
}

$pythonCode = @'
import json
import os
import sqlite3
import sys

db_path = sys.argv[1]
conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
conn.row_factory = sqlite3.Row

def table_exists(name):
    return conn.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?", (name,)).fetchone()[0] > 0

tables = {}
for name in ["games", "game_assets", "tasks", "task_logs", "save_backups"]:
    tables[name] = conn.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0] if table_exists(name) else None

asset_summary = None
if table_exists("game_assets"):
    local_paths = [
        row["uri"]
        for row in conn.execute("SELECT uri FROM game_assets WHERE uri GLOB '[A-Za-z]:\\*'")
    ]
    missing_local_paths = [path for path in local_paths if not os.path.isfile(path)]
    asset_summary = {
        "emptyUriCount": conn.execute("SELECT COUNT(*) FROM game_assets WHERE uri IS NULL OR TRIM(uri) = ''").fetchone()[0],
        "localWindowsPathCount": len(local_paths),
        "missingLocalWindowsPathCount": len(missing_local_paths),
        "missingLocalWindowsPathSamples": missing_local_paths[:10],
    }

result = {
    "quickCheck": conn.execute("PRAGMA quick_check").fetchone()[0],
    "tables": tables,
    "assetSummary": asset_summary,
}
conn.close()
print(json.dumps(result, ensure_ascii=False))
'@

$dbJson = $pythonCode | python - $databasePath
if ($LASTEXITCODE -ne 0) {
  throw "SQLite readonly smoke failed while reading $databasePath"
}
$database = $dbJson | ConvertFrom-Json

$images = Get-DirectorySummary $appDataRoot "images"
$databaseBackups = Get-DirectorySummary $appDataRoot "database-backups"
$updateProtection = Get-DirectorySummary $appDataRoot "database-update-protection"
$logs = Get-DirectorySummary $appDataRoot "logs"

if ($database.quickCheck -ne "ok") {
  throw "SQLite quick_check failed: $($database.quickCheck)"
}
if ($database.tables.games -lt $MinGameCount) {
  throw "Real data smoke failed: games count $($database.tables.games) is below minimum $MinGameCount"
}
if ($images.fileCount -lt $MinImageFiles) {
  throw "Real data smoke failed: image file count $($images.fileCount) is below minimum $MinImageFiles"
}
if ($databaseBackups.fileCount -lt $MinBackupFiles) {
  throw "Real data smoke failed: database backup count $($databaseBackups.fileCount) is below minimum $MinBackupFiles"
}
if ($database.assetSummary -and $database.assetSummary.missingLocalWindowsPathCount -gt $MaxMissingLocalAssetPaths) {
  $samples = $database.assetSummary.missingLocalWindowsPathSamples -join "`n"
  throw "Real data smoke failed: missing local asset refs $($database.assetSummary.missingLocalWindowsPathCount) exceeds maximum $MaxMissingLocalAssetPaths. Samples:`n$samples"
}

$report = [ordered]@{
  appRoot = $resolvedAppRoot
  executable = $exePath
  appDataRoot = $appDataRoot
  databasePath = $databasePath
  databaseBytes = (Get-Item -LiteralPath $databasePath).Length
  database = $database
  images = $images
  databaseBackups = $databaseBackups
  databaseUpdateProtection = $updateProtection
  logs = $logs
  readonly = $true
}

if (!$NoReport) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $runRoot = Join-Path (Join-Path $repoRoot "output\real-app-data-readonly-smoke") "run-$stamp"
  New-Item -ItemType Directory -Force -Path $runRoot | Out-Null
  $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $runRoot "real-app-data-readonly-smoke-report.json") -Encoding UTF8
  $report["runRoot"] = $runRoot
}

$report | ConvertTo-Json -Depth 8
