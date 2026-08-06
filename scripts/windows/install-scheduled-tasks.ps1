# One-time setup for the Windows machine that drives the physical weather display.
# Registers two Scheduled Tasks:
#   1. "NovaStats Weather Refresh" - runs run-refresh.ps1 once a day, scraping and
#      upscaling the forecast images and uploading them to Vercel Blob directly from this
#      machine. This is the primary refresh path; the Actions workflow
#      (.github/workflows/refresh-weather.yml) is kept as a same-day fallback in case this
#      machine is off or the task fails.
#   2. "NovaStats Kiosk" - runs at user logon, starts `next start` and opens it full-screen
#      in Edge kiosk mode (see start-kiosk.ps1).
#
# Run this once, from an elevated (Administrator) PowerShell prompt, after `npm install`
# and `npm run build` have completed and .env.local (with BLOB_READ_WRITE_TOKEN) exists.
# Re-running it is safe - it overwrites the existing tasks.
#
# Usage: .\install-scheduled-tasks.ps1 [-RefreshTime "14:00"]
param(
  [string]$RefreshTime = "14:00"
)
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$User = "$env:USERDOMAIN\$env:USERNAME"

# LogonType Interactive: the task runs under the logged-on kiosk user. That account is
# always signed in (it has to be - it is what displays the slideshow), and it avoids
# needing a stored password.
$Principal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive -RunLevel Limited

# --- Task 1: daily weather image refresh ---
# Executed via powershell.exe rather than npm.cmd: Task Scheduler resolves the action's
# executable against a minimal environment, where a bare "npm.cmd" frequently fails to
# launch at all (result 0x1/0x2) and reports nothing useful when it does. run-refresh.ps1
# finds node itself and writes a log under <repo>\logs.
$RefreshAction = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$RepoRoot\scripts\windows\run-refresh.ps1`"" `
  -WorkingDirectory $RepoRoot

$RefreshTrigger = New-ScheduledTaskTrigger -Daily -At $RefreshTime

$RefreshSettings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -DontStopOnIdleEnd `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -WakeToRun `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 15)

Register-ScheduledTask -TaskName "NovaStats Weather Refresh" `
  -Description "Scrapes, upscales and uploads the daily forecast images (see scripts/refresh-weather.cjs)." `
  -Action $RefreshAction -Trigger $RefreshTrigger -Settings $RefreshSettings `
  -Principal $Principal -Force | Out-Null

# --- Task 2: start the kiosk display at logon ---
$KioskAction = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$RepoRoot\scripts\windows\start-kiosk.ps1`"" `
  -WorkingDirectory $RepoRoot

$KioskTrigger = New-ScheduledTaskTrigger -AtLogOn -User $User

# No execution time limit: this task owns the long-lived `next start` server.
$KioskSettings = New-ScheduledTaskSettingsSet `
  -DontStopOnIdleEnd `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask -TaskName "NovaStats Kiosk" `
  -Description "Starts the local Next.js server and opens the slideshow in Edge kiosk mode." `
  -Action $KioskAction -Trigger $KioskTrigger -Settings $KioskSettings `
  -Principal $Principal -Force | Out-Null

Write-Host ""
Write-Host "Installed:" -ForegroundColor Green
Write-Host "  NovaStats Weather Refresh - daily at $RefreshTime (logs to $RepoRoot\logs)"
Write-Host "  NovaStats Kiosk           - at logon"
Write-Host ""
Write-Host "Verify it actually works now, do not wait until tomorrow:" -ForegroundColor Yellow
Write-Host "  Start-ScheduledTask -TaskName 'NovaStats Weather Refresh'"
Write-Host "  .\check-tasks.ps1"
Write-Host ""
Write-Host "GitHub Actions keeps running as a same-day fallback refresh - no change needed there."
