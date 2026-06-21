param(
  [ValidateSet("success", "cancel")]
  [string]$ExpectedAction = "success",
  [int]$TimeoutSeconds = 45
)

$ErrorActionPreference = "Stop"

function New-Report {
  param(
    [string]$Status,
    [bool]$Succeeded,
    [string]$Message,
    [string]$ErrorText = ""
  )

  [ordered]@{
    smoke = "elevated-launch"
    expectedAction = $ExpectedAction
    status = $Status
    succeeded = $Succeeded
    message = $Message
    error = $ErrorText
    runRoot = $runRoot
    markerPath = $markerPath
    launcherPath = $launcherPath
    uacPolicy = $uacPolicy
    startedAt = $startedAt
    finishedAt = (Get-Date).ToString("o")
    note = "This smoke intentionally triggers Windows UAC. For success, approve UAC; for cancel, reject UAC."
  }
}

function Write-Report {
  param([hashtable]$Report)

  $Report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $reportPath -Encoding UTF8
  $Report | ConvertTo-Json -Depth 6
}

function Get-UacPolicy {
  try {
    Get-ItemProperty -LiteralPath "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" |
      Select-Object EnableLUA, ConsentPromptBehaviorAdmin, ConsentPromptBehaviorUser, PromptOnSecureDesktop
  } catch {
    $null
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$startedAt = (Get-Date).ToString("o")
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runRoot = Join-Path $repoRoot "output\elevated-launch-smoke\run-$stamp"
New-Item -ItemType Directory -Force -Path $runRoot | Out-Null

$markerPath = Join-Path $runRoot "marker.txt"
$launcherPath = Join-Path $runRoot "write-marker.ps1"
$reportPath = Join-Path $runRoot "elevated-launch-smoke-report.json"
$launchLogPath = Join-Path $runRoot "elevated-launch.log"

@"
`$ErrorActionPreference = "Stop"
"elevated launch marker $(Get-Date -Format o)" | Set-Content -LiteralPath "$markerPath" -Encoding UTF8
"wrote marker to $markerPath" | Set-Content -LiteralPath "$launchLogPath" -Encoding UTF8
"@ | Set-Content -LiteralPath $launcherPath -Encoding UTF8

$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$launcherPath`""
$cancelPatterns = @(
  "cancel",
  "cancelled",
  "canceled",
  "operation was canceled",
  "operation was cancelled",
  "用户取消",
  "被用户取消",
  "UAC"
)

$uacPolicy = Get-UacPolicy
if ($ExpectedAction -eq "cancel" -and $uacPolicy -and $uacPolicy.EnableLUA -eq 1 -and $uacPolicy.ConsentPromptBehaviorAdmin -eq 0) {
  Write-Report (New-Report -Status "unsupported" -Succeeded $false -Message "UAC policy is configured to elevate administrators without prompting; cancellation cannot be validated on this Windows profile.")
  exit 1
}

try {
  $process = Start-Process -FilePath "powershell.exe" -ArgumentList $arguments -Verb RunAs -PassThru -WindowStyle Hidden
} catch {
  $errorText = $_.Exception.Message
  $isCancel = $false
  foreach ($pattern in $cancelPatterns) {
    if ($errorText -match $pattern) {
      $isCancel = $true
      break
    }
  }

  if ($ExpectedAction -eq "cancel" -and $isCancel -and -not (Test-Path -LiteralPath $markerPath)) {
    Write-Report (New-Report -Status "cancelled" -Succeeded $true -Message "UAC cancellation was observed and no marker was written." -ErrorText $errorText)
    exit 0
  }

  Write-Report (New-Report -Status "failed" -Succeeded $false -Message "Elevated launch request failed before expected result." -ErrorText $errorText)
  exit 1
}

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
  if (Test-Path -LiteralPath $markerPath) {
    if ($ExpectedAction -eq "cancel") {
      Write-Report (New-Report -Status "approved" -Succeeded $false -Message "UAC approval was observed while cancellation was expected. Rerun the smoke and choose No/Cancel in the UAC prompt.")
      exit 1
    }

    Write-Report (New-Report -Status "completed" -Succeeded $true -Message "UAC-approved elevated process wrote the marker file.")
    exit 0
  }

  if ($process -and $process.HasExited -and -not (Test-Path -LiteralPath $markerPath)) {
    if ($ExpectedAction -eq "cancel") {
      Write-Report (New-Report -Status "failed" -Succeeded $false -Message "Start-Process returned an elevated process while cancellation was expected, but no marker was written.")
      exit 1
    }

    Write-Report (New-Report -Status "failed" -Succeeded $false -Message "Elevated process exited without writing marker.")
    exit 1
  }

  Start-Sleep -Milliseconds 250
}

Write-Report (New-Report -Status "timeout" -Succeeded $false -Message "Timed out waiting for elevated marker file.")
exit 1
