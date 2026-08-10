# One-time setup for the Windows machine that drives the physical weather display.
#
# There is only one task left: "NovaStats Kiosk", which opens the deployed slideshow
# full-screen in Edge at user logon.
#
# The daily image refresh used to be a second task here. It now runs as a Vercel Cron (see
# vercel.json) with the GitHub Actions workflow as a backup, so this machine downloads and
# uploads nothing — it only displays. If the old refresh task is still registered from a
# previous install, this script removes it.
#
# Run once from an elevated (Administrator) PowerShell prompt.
# Usage: .\install-scheduled-tasks.ps1 [-Url "https://nova-stats.vercel.app"]
param(
  [string]$Url = "https://nova-stats.vercel.app"
)
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$User = "$env:USERDOMAIN\$env:USERNAME"

# --- Retire the old local-refresh task, if present ---
$oldTask = Get-ScheduledTask -TaskName "NovaStats Weather Refresh" -ErrorAction SilentlyContinue
if ($oldTask) {
  Unregister-ScheduledTask -TaskName "NovaStats Weather Refresh" -Confirm:$false
  Write-Host "Removed the old 'NovaStats Weather Refresh' task - the refresh runs on Vercel now." -ForegroundColor Yellow
}

# --- The kiosk display, at logon ---
# LogonType Interactive: the task runs as the signed-in kiosk user, which it must, since it
# opens a window on that user's desktop.
$Principal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive -RunLevel Limited

$KioskAction = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$RepoRoot\scripts\windows\start-kiosk.ps1`" -Url `"$Url`"" `
  -WorkingDirectory $RepoRoot

$KioskTrigger = New-ScheduledTaskTrigger -AtLogOn -User $User

# No execution time limit: the script exits once Edge is up, but Task Scheduler counts the
# task as running for as long as its process tree lives.
$KioskSettings = New-ScheduledTaskSettingsSet `
  -DontStopOnIdleEnd `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask -TaskName "NovaStats Kiosk" `
  -Description "Opens the deployed slideshow full-screen in Edge kiosk mode at logon." `
  -Action $KioskAction -Trigger $KioskTrigger -Settings $KioskSettings `
  -Principal $Principal -Force | Out-Null

Write-Host ""
Write-Host "Installed 'NovaStats Kiosk' - opens $Url at logon." -ForegroundColor Green
Write-Host ""
Write-Host "Verify now, without waiting for a reboot:" -ForegroundColor Yellow
Write-Host "  .\start-kiosk.ps1"
Write-Host "  .\check-tasks.ps1"
Write-Host ""
Write-Host "The image refresh is a Vercel Cron (vercel.json, 11:00 UTC daily), with the"
Write-Host "GitHub Actions workflow calling the same endpoint later as a backup."
