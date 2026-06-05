param(
  [string]$ProjectRoot = 'E:\codex\mikavn-library',
  [string]$Providers = 'dlsite,fanza',
  [int]$Limit = 500,
  [int]$BatchSize = 16,
  [int]$Concurrency = 5,
  [int]$MaxImages = 3,
  [int]$TimeoutMs = 60000,
  [int]$InitialPollSeconds = 60,
  [int]$MaxRoundsPerProvider = 0,
  [string]$OutputDir = 'E:\MikaVN Library\app-data\metadata-repair\logs',
  [string]$BackupDir = 'E:\MikaVN Library\app-data\database-backups\metadata-repair',
  [switch]$RetryFailed
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$providerList = @(
  $Providers -split ',' |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ }
)

$repairScript = Join-Path $ProjectRoot 'scripts\metadata\repair-description-images.py'
$outDir = $OutputDir
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

function Write-LoopLog {
  param([string]$Message)
  $line = "{0} {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
  Write-Output $line
}

function Get-RepairProcess {
  Get-CimInstance Win32_Process |
    Where-Object {
      $_.CommandLine -like '*repair-description-images.py*' -and
      $_.CommandLine -notlike '*run-description-image-repair-loop.ps1*'
    }
}

function Get-CandidateCount {
  param([string]$Provider)
  $dryRunArgs = @($repairScript, '--dry-run', '--provider', $Provider, '--limit', '1')
  if ($RetryFailed) {
    $dryRunArgs += '--retry-failed'
  }
  $output = & python @dryRunArgs 2>&1
  foreach ($line in $output) {
    if ($line -match '^Candidates:\s*(\d+)') {
      return [int]$Matches[1]
    }
  }
  Write-LoopLog "Could not parse dry-run output for ${Provider}: $($output -join ' | ')"
  return 0
}

Write-LoopLog "Description image repair loop started. providers=$($providerList -join ',') limit=$Limit batch=$BatchSize concurrency=$Concurrency retryFailed=$RetryFailed maxRoundsPerProvider=$MaxRoundsPerProvider"

while ($true) {
  $existing = @(Get-RepairProcess)
  if ($existing.Count -eq 0) { break }
  $ids = ($existing | ForEach-Object { $_.ProcessId }) -join ','
  Write-LoopLog "Waiting for existing repair process(es): $ids"
  Start-Sleep -Seconds $InitialPollSeconds
}

foreach ($provider in $providerList) {
  $round = 0
  while ($true) {
    $candidateCount = Get-CandidateCount -Provider $provider
    if ($candidateCount -le 0) {
      Write-LoopLog "No remaining candidates for provider=$provider"
      break
    }

    $round += 1
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $runLog = Join-Path $outDir ("{0}-auto-{1}.log" -f $provider, $stamp)
    Write-LoopLog "Starting provider=$provider round=$round log=$runLog"

    $runArgs = @(
      '-u',
      $repairScript,
      '--provider', $provider,
      '--limit', [string]$Limit,
      '--batch-size', [string]$BatchSize,
      '--concurrency', [string]$Concurrency,
      '--max-images', [string]$MaxImages,
      '--timeout-ms', [string]$TimeoutMs,
      '--backup-dir', $BackupDir
    )
    if ($RetryFailed) {
      $runArgs += '--retry-failed'
    }
    & python @runArgs 2>&1 | Tee-Object -FilePath $runLog -Append
    if ($LASTEXITCODE -ne 0) {
      Write-LoopLog "Provider=$provider round=$round failed with exit code $LASTEXITCODE. Loop stopped for safety."
      exit $LASTEXITCODE
    }
    Write-LoopLog "Finished provider=$provider round=$round"
    if ($MaxRoundsPerProvider -gt 0 -and $round -ge $MaxRoundsPerProvider) {
      Write-LoopLog "Reached max rounds for provider=$provider maxRoundsPerProvider=$MaxRoundsPerProvider"
      break
    }
    Start-Sleep -Seconds 5
  }
}

Write-LoopLog 'Description image repair loop completed.'
