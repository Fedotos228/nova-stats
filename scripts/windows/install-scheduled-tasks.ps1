# One-time setup for the Windows machine that drives the physical weather display.
# Registers two Scheduled Tasks:
#   1. "NovaStats Weather Refresh" - runs `npm run refresh-weather` once a day, scraping
#      and upscaling the forecast images and uploading them to Vercel Blob directly from
#      this machine. This replaces GitHub Actions as the primary refresh path; the Actions
#      workflow (.github/workflows/refresh-weather.yml) is kept as a same-day fallback in
#      case this machine is off or the task fails.
#   2. "NovaStats Kiosk" - runs at user logon, starts `next start` and opens it full-screen
#      in Edge kiosk mode (see start-kiosk.ps1).
#
# Run this once, from an elevated (Administrator) PowerShell prompt, after `npm install`
# and `npm run build` have completed and .env.local (with BLOB_READ_WRITE_TOKEN) exists.
#
# Usage: .\install-scheduled-tasks.ps1 [-RefreshTime "15:00"]
param(
  [string]$RefreshTime = "15:00"
)
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$User = "$env:USERDOMAIN\$env:USERNAME"

# --- Task 1: daily weather image refresh ---
$RefreshAction = New-ScheduledTaskAction -Execute "npm.cmd" -Argument "run refresh-weather" -WorkingDirectory $RepoRoot
$RefreshTrigger = New-ScheduledTaskTrigger -Daily -At $RefreshTime
$RefreshSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd
Register-ScheduledTask -TaskName "NovaStats Weather Refresh" `
  -Action $RefreshAction -Trigger $RefreshTrigger -Settings $RefreshSettings `
  -User $User -RunLevel Limited -Force

# --- Task 2: start the kiosk display at logon ---
$KioskAction = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$RepoRoot\scripts\windows\start-kiosk.ps1`""
$KioskTrigger = New-ScheduledTaskTrigger -AtLogOn -User $User
Register-ScheduledTask -TaskName "NovaStats Kiosk" `
  -Action $KioskAction -Trigger $KioskTrigger `
  -User $User -RunLevel Limited -Force

Write-Host "Installed 'NovaStats Weather Refresh' (daily at $RefreshTime) and 'NovaStats Kiosk' (at logon)."
Write-Host "GitHub Actions keeps running as a same-day fallback refresh - no change needed there."
