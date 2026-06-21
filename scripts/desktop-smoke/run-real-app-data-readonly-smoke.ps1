param(
  [string]$AppRoot = "E:\MikaVN Library",
  [int]$MinGameCount = 1,
  [int]$MinImageFiles = 1,
  [int]$MinBackupFiles = 1,
  [int]$MaxMissingLocalAssetPaths = 0,
  [int]$MaxUnsupportedLocalAssetImages = 0,
  [int]$MaxBackupQuickCheckFiles = 3,
  [int]$MaxImageHeaderQuickCheckFiles = 25,
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

function Resolve-UnderRootPath([string]$Root, [string]$Path, [string]$Description) {
  $resolvedRoot = (Resolve-Path -LiteralPath $Root).Path
  $resolvedPath = [System.IO.Path]::GetFullPath($Path)
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

function Get-OptionalDirectorySummary([string]$Root, [string]$Name, [string]$ChildName = "") {
  $relativePath = if ($ChildName) { Join-Path $Name $ChildName } else { $Name }
  $path = Resolve-UnderRootPath $Root (Join-Path $Root $relativePath) $relativePath
  if (!(Test-Path -LiteralPath $path -PathType Container)) {
    return [ordered]@{
      path = $path
      exists = $false
      fileCount = 0
      totalBytes = [int64]0
      latestFileTime = $null
    }
  }

  $files = @(Get-ChildItem -LiteralPath $path -Recurse -File -ErrorAction SilentlyContinue)
  $bytes = ($files | Measure-Object -Property Length -Sum).Sum
  $latest = ($files | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime
  [ordered]@{
    path = $path
    exists = $true
    fileCount = $files.Count
    totalBytes = [int64]$bytes
    latestFileTime = $latest
  }
}

function Test-DatabaseBackupQuickChecks([object]$Summary, [string]$Description, [int]$Limit) {
  $path = $Summary.path
  if (!$path -or !(Test-Path -LiteralPath $path -PathType Container) -or $Limit -le 0) {
    return [ordered]@{
      label = $Description
      path = $path
      checkedCount = 0
      allOk = $true
      files = @()
    }
  }

  $files = @(Get-ChildItem -LiteralPath $path -Recurse -File -Filter *.db -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First $Limit)
  if ($files.Count -eq 0) {
    return [ordered]@{
      label = $Description
      path = $path
      checkedCount = 0
      allOk = $true
      files = @()
    }
  }

  $backupPaths = @($files | ForEach-Object { $_.FullName })
  $backupJson = $backupQuickCheckCode | python - @backupPaths
  if ($LASTEXITCODE -ne 0) {
    throw "Backup quick_check failed while reading $Description backups under $path"
  }
  $check = $backupJson | ConvertFrom-Json
  foreach ($file in @($check.files)) {
    if ($file.error) {
      throw "Backup quick_check failed for $($file.path): $($file.error)"
    }
    if ($file.quickCheck -ne "ok") {
      throw "Backup quick_check failed for $($file.path): $($file.quickCheck)"
    }
    if (!$file.hasGamesTable) {
      throw "Backup quick_check failed for $($file.path): does not look like a MikaVN database backup"
    }
  }
  [ordered]@{
    label = $Description
    path = $path
    checkedCount = $check.checkedCount
    allOk = $true
    files = $check.files
  }
}

function Test-ImageHeaderQuickChecks([object]$Summary, [int]$Limit) {
  $path = $Summary.path
  if (!$path -or !(Test-Path -LiteralPath $path -PathType Container) -or $Limit -le 0) {
    return [ordered]@{
      path = $path
      checkedCount = 0
      allOk = $true
      unsupportedImageFileSamples = @()
      imageFileKindCounts = [ordered]@{}
      files = @()
    }
  }

  $imageExtensions = @(".jpg", ".jpeg", ".png", ".webp", ".gif", ".ico")
  $files = @(Get-ChildItem -LiteralPath $path -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $imageExtensions -contains $_.Extension.ToLowerInvariant() } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First $Limit)
  if ($files.Count -eq 0) {
    return [ordered]@{
      path = $path
      checkedCount = 0
      allOk = $true
      unsupportedImageFileSamples = @()
      imageFileKindCounts = [ordered]@{}
      files = @()
    }
  }

  $imagePaths = @($files | ForEach-Object { $_.FullName })
  $imageJson = $imageHeaderQuickCheckCode | python - @imagePaths
  if ($LASTEXITCODE -ne 0) {
    throw "Image header quick check failed while reading image cache under $path"
  }
  $check = $imageJson | ConvertFrom-Json
  foreach ($file in @($check.files)) {
    if ($file.error) {
      throw "Image header quick check failed for $($file.path): $($file.error)"
    }
    if ($file.kind -eq "unsupported" -or $file.kind -eq "unreadable") {
      throw "Image header quick check failed for $($file.path): unsupported image header"
    }
  }

  [ordered]@{
    path = $path
    checkedCount = $check.checkedCount
    allOk = $true
    unsupportedImageFileSamples = $check.unsupportedImageFileSamples
    imageFileKindCounts = $check.imageFileKindCounts
    files = $check.files
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
from collections import Counter

db_path = sys.argv[1]
conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
conn.row_factory = sqlite3.Row

def table_exists(name):
    return conn.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?", (name,)).fetchone()[0] > 0

def sniff_image_kind(path):
    try:
        with open(path, "rb") as file:
            header = file.read(16)
    except OSError:
        return "unreadable"
    if len(header) >= 3 and header[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if len(header) >= 12 and header.startswith(b"RIFF") and header[8:12] == b"WEBP":
        return "webp"
    if header.startswith(b"GIF87a") or header.startswith(b"GIF89a"):
        return "gif"
    if header.startswith(b"\x00\x00\x01\x00") or header.startswith(b"\x00\x00\x02\x00"):
        return "ico"
    return "unsupported"

tables = {}
for name in ["games", "game_assets", "tasks", "task_logs", "save_backups"]:
    tables[name] = conn.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0] if table_exists(name) else None

asset_summary = None
if table_exists("game_assets"):
    local_paths = [
        row["uri"]
        for row in conn.execute("SELECT uri FROM game_assets WHERE uri GLOB '[A-Za-z]:\\*'")
    ]
    unique_local_paths = sorted(set(local_paths))
    missing_local_paths = [path for path in local_paths if not os.path.isfile(path)]
    existing_local_paths = [path for path in unique_local_paths if os.path.isfile(path)]
    local_image_kinds = {path: sniff_image_kind(path) for path in existing_local_paths}
    kind_counts = Counter(local_image_kinds.values())
    unsupported_local_images = [
        path
        for path, kind in local_image_kinds.items()
        if kind in {"unsupported", "unreadable"}
    ]
    asset_summary = {
        "emptyUriCount": conn.execute("SELECT COUNT(*) FROM game_assets WHERE uri IS NULL OR TRIM(uri) = ''").fetchone()[0],
        "localWindowsPathCount": len(local_paths),
        "uniqueLocalWindowsPathCount": len(unique_local_paths),
        "missingLocalWindowsPathCount": len(missing_local_paths),
        "missingLocalWindowsPathSamples": missing_local_paths[:10],
        "unsupportedLocalImageCount": len(unsupported_local_images),
        "unsupportedLocalImageSamples": unsupported_local_images[:10],
        "localImageKindCounts": dict(sorted(kind_counts.items())),
    }

result = {
    "quickCheck": conn.execute("PRAGMA quick_check").fetchone()[0],
    "tables": tables,
    "assetSummary": asset_summary,
}
conn.close()
print(json.dumps(result, ensure_ascii=False))
'@

$backupQuickCheckCode = @'
import json
import sqlite3
import sys

files = []
for path in sys.argv[1:]:
    item = {"path": path, "quickCheck": None, "hasGamesTable": False, "error": None}
    try:
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        item["quickCheck"] = conn.execute("PRAGMA quick_check").fetchone()[0]
        item["hasGamesTable"] = conn.execute(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='games')"
        ).fetchone()[0] == 1
        conn.close()
    except Exception as error:
        item["error"] = str(error)
    files.append(item)

print(json.dumps({"checkedCount": len(files), "files": files}, ensure_ascii=False))
'@

$imageHeaderQuickCheckCode = @'
import json
import os
import sys
from collections import Counter

def sniff_image_kind(path):
    try:
        with open(path, "rb") as file:
            header = file.read(16)
    except OSError:
        return "unreadable"
    if len(header) >= 3 and header[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if len(header) >= 12 and header.startswith(b"RIFF") and header[8:12] == b"WEBP":
        return "webp"
    if header.startswith(b"GIF87a") or header.startswith(b"GIF89a"):
        return "gif"
    if header.startswith(b"\x00\x00\x01\x00") or header.startswith(b"\x00\x00\x02\x00"):
        return "ico"
    return "unsupported"

files = []
for path in sys.argv[1:]:
    item = {
        "path": path,
        "extension": os.path.splitext(path)[1].lower(),
        "sizeBytes": None,
        "kind": None,
        "error": None,
    }
    try:
        item["sizeBytes"] = os.path.getsize(path)
        item["kind"] = sniff_image_kind(path)
    except Exception as error:
        item["kind"] = "unreadable"
        item["error"] = str(error)
    files.append(item)

kind_counts = Counter(item["kind"] for item in files)
unsupported = [
    item["path"]
    for item in files
    if item["kind"] in {"unsupported", "unreadable"} or item["error"]
]

print(json.dumps({
    "checkedCount": len(files),
    "allOk": len(unsupported) == 0,
    "unsupportedImageFileSamples": unsupported[:10],
    "imageFileKindCounts": dict(sorted(kind_counts.items())),
    "files": files,
}, ensure_ascii=False))
'@

$dbJson = $pythonCode | python - $databasePath
if ($LASTEXITCODE -ne 0) {
  throw "SQLite readonly smoke failed while reading $databasePath"
}
$database = $dbJson | ConvertFrom-Json

$images = Get-DirectorySummary $appDataRoot "images"
$imageHeaderQuickChecks = Test-ImageHeaderQuickChecks $images $MaxImageHeaderQuickCheckFiles
$databaseBackups = Get-DirectorySummary $appDataRoot "database-backups"
$updateProtection = Get-OptionalDirectorySummary $appDataRoot "database-backups" "update-protection"
$legacyUpdateProtection = Get-OptionalDirectorySummary $appDataRoot "database-update-protection"
$logs = Get-DirectorySummary $appDataRoot "logs"
$backupQuickChecks = [ordered]@{
  databaseBackups = Test-DatabaseBackupQuickChecks $databaseBackups "database-backups" $MaxBackupQuickCheckFiles
  databaseUpdateProtection = Test-DatabaseBackupQuickChecks $updateProtection "database-backups/update-protection" $MaxBackupQuickCheckFiles
  legacyDatabaseUpdateProtection = Test-DatabaseBackupQuickChecks $legacyUpdateProtection "database-update-protection" $MaxBackupQuickCheckFiles
}

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
if ($database.assetSummary -and $database.assetSummary.unsupportedLocalImageCount -gt $MaxUnsupportedLocalAssetImages) {
  $samples = $database.assetSummary.unsupportedLocalImageSamples -join "`n"
  throw "Real data smoke failed: unsupported local asset images $($database.assetSummary.unsupportedLocalImageCount) exceeds maximum $MaxUnsupportedLocalAssetImages. Samples:`n$samples"
}

$report = [ordered]@{
  appRoot = $resolvedAppRoot
  executable = $exePath
  appDataRoot = $appDataRoot
  databasePath = $databasePath
  databaseBytes = (Get-Item -LiteralPath $databasePath).Length
  database = $database
  images = $images
  imageHeaderQuickChecks = $imageHeaderQuickChecks
  databaseBackups = $databaseBackups
  databaseUpdateProtection = $updateProtection
  legacyDatabaseUpdateProtection = $legacyUpdateProtection
  backupQuickChecks = $backupQuickChecks
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
