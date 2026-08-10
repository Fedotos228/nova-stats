# Opens the slideshow full-screen in Edge kiosk mode. Launched by the "NovaStats Kiosk"
# scheduled task (see install-scheduled-tasks.ps1) at user logon.
#
# This machine no longer runs the app. It used to serve it locally with `next start`, which
# turned out to be the single largest source of breakage: the server kept running for days
# with whatever build it started from, so a `git pull` plus `npm run build` changed nothing
# on screen until someone restarted the process, and under Task Scheduler the server was
# killed along with the task that spawned it (0xC000013A).
#
# The app is deployed anyway, redeploys itself on every push, and the images live in Vercel
# Blob rather than on disk — so pointing the browser at the deployment removes the local
# server, the rebuild step, and the Node install with it.
param(
  [string]$Url = "https://nova-stats.vercel.app"
)
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$LogDir = Join-Path $RepoRoot "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir ("kiosk-{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))

# -Encoding UTF8 is load-bearing: PowerShell 5.1's Add-Content defaults to ANSI, and a log
# read back with a different assumption comes out as gibberish.
function Write-Log([string]$Message) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Write-Host $line
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

try {
  Write-Log "=== kiosk starting ($Url) ==="

  $EdgePath = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
  if (-not (Test-Path $EdgePath)) { $EdgePath = "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe" }
  if (-not (Test-Path $EdgePath)) {
    Write-Log "FAILED: Microsoft Edge not found in either Program Files location."
    exit 1
  }

  # Wait for the network rather than opening Edge onto an error page: at logon this task
  # can easily win the race against DHCP and DNS.
  $online = $false
  $deadline = (Get-Date).AddSeconds(120)
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 -Method Head | Out-Null
      $online = $true
      break
    } catch {
      Start-Sleep -Seconds 3
    }
  }
  if ($online) {
    Write-Log "reachable: $Url"
  } else {
    Write-Log "WARNING: $Url did not respond within 120s - opening Edge anyway, it retries on its own."
  }

  Start-Process -FilePath $EdgePath -ArgumentList "--kiosk", $Url, "--edge-kiosk-type=fullscreen", "--no-first-run"
  Write-Log "=== kiosk OK ==="
  exit 0
} catch {
  Write-Log "=== kiosk FAILED (PowerShell error) ==="
  Add-Content -Path $LogFile -Value ($_ | Out-String) -Encoding UTF8
  exit 1
}
