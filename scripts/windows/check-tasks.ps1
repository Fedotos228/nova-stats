# Diagnostics for the display machine. Run this whenever the slideshow looks stale - it
# answers "did the refresh task run, and what did it say?" without digging through the
# Task Scheduler UI.
#
# Usage: powershell -ExecutionPolicy Bypass -File .\check-tasks.ps1 [-Lines 40]
param(
  [int]$Lines = 40
)

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

# Task Scheduler reports the action's exit code as LastTaskResult, so 0 here means
# run-refresh.ps1 itself exited 0. The non-zero values below are the ones that actually
# show up in practice.
$ResultMeanings = @{
  0            = "success"
  1            = "the script ran and failed - read the log below"
  2            = "file not found (0x2) - the task's executable could not be launched"
  267009       = "currently running (0x41301)"
  267011       = "has not run yet (0x41303)"
  267014       = "terminated by the user (0x41306)"
  2147942401   = "file not found (0x80070002)"
  2147943712   = "logon failure / wrong principal (0x800704DD)"
}

function Show-Task([string]$Name) {
  Write-Host ""
  Write-Host "--- $Name ---" -ForegroundColor Cyan

  $task = Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
  if (-not $task) {
    Write-Host "  NOT REGISTERED. Run install-scheduled-tasks.ps1 from an elevated prompt." -ForegroundColor Red
    return
  }

  $info = Get-ScheduledTaskInfo -TaskName $Name
  $result = $info.LastTaskResult
  $meaning = if ($ResultMeanings.ContainsKey([int]$result)) { $ResultMeanings[[int]$result] } else { "see 'Task Scheduler error codes'" }

  Write-Host ("  State        : {0}" -f $task.State)
  Write-Host ("  Last run     : {0}" -f $info.LastRunTime)
  Write-Host ("  Last result  : {0} ({1})" -f $result, $meaning) -ForegroundColor $(if ($result -eq 0) { "Green" } else { "Red" })
  Write-Host ("  Next run     : {0}" -f $info.NextRunTime)
  Write-Host ("  Runs as      : {0} ({1})" -f $task.Principal.UserId, $task.Principal.LogonType)
  foreach ($action in $task.Actions) {
    Write-Host ("  Action       : {0} {1}" -f $action.Execute, $action.Arguments)
  }
}

Write-Host "NovaStats display machine check" -ForegroundColor White
Write-Host ("Repo: {0}" -f $RepoRoot)

Write-Host ""
Write-Host "--- prerequisites ---" -ForegroundColor Cyan
$node = Get-Command "node.exe" -ErrorAction SilentlyContinue
if ($node) {
  Write-Host ("  node         : {0} ({1})" -f (& $node.Source --version), $node.Source)
} else {
  Write-Host "  node         : NOT ON PATH (run-refresh.ps1 also probes the default install paths)" -ForegroundColor Yellow
}
Write-Host ("  .env.local   : {0}" -f $(if (Test-Path (Join-Path $RepoRoot ".env.local")) { "present" } else { "MISSING - needs BLOB_READ_WRITE_TOKEN" }))
Write-Host ("  node_modules : {0}" -f $(if (Test-Path (Join-Path $RepoRoot "node_modules")) { "present" } else { "MISSING - run npm install --legacy-peer-deps" }))
Write-Host ("  .next build  : {0}" -f $(if (Test-Path (Join-Path $RepoRoot ".next")) { "present" } else { "MISSING - run npm run build" }))

Show-Task "NovaStats Weather Refresh"
Show-Task "NovaStats Kiosk"

$LogDir = Join-Path $RepoRoot "logs"

function Show-Log([string]$Pattern, [string]$Title, [string]$Hint) {
  Write-Host ""
  Write-Host "--- $Title ---" -ForegroundColor Cyan

  $latest = Get-ChildItem -Path $LogDir -Filter $Pattern -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1

  if (-not $latest) {
    Write-Host "  No $Pattern in $LogDir." -ForegroundColor Red
    Write-Host "  $Hint" -ForegroundColor Yellow
    return
  }

  Write-Host ("  {0} (last written {1})" -f $latest.FullName, $latest.LastWriteTime)
  Write-Host ""
  # -Encoding UTF8 matches what the scripts write. Without it PowerShell 5.1 guesses, and
  # guesses wrong on anything non-ASCII, rendering the log as CJK gibberish.
  Get-Content $latest.FullName -Tail $Lines -Encoding UTF8
}

Show-Log "refresh-*.log" "latest refresh log" "Trigger it with: Start-ScheduledTask -TaskName 'NovaStats Weather Refresh'"
Show-Log "kiosk-*.log" "latest kiosk log" "Trigger it with: .\start-kiosk.ps1"
