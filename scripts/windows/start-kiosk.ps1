# Starts the local Next.js server (built with `npm run build`) and opens it full-screen
# in Edge kiosk mode. Meant to be launched by the "NovaStats Kiosk" scheduled task
# (see install-scheduled-tasks.ps1), which fires at user logon.
#
# Like run-refresh.ps1, this deliberately avoids npm.cmd: Task Scheduler launches actions
# in a minimal environment where a bare "npm.cmd" often fails to start at all, and any
# failure here is invisible because there is no console to print to. Everything is logged
# to <repo>\logs\kiosk-<date>.log instead.
param(
  [int]$Port = 3000
)
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $RepoRoot

$LogDir = Join-Path $RepoRoot "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir ("kiosk-{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))

# UTF8 for the same reason as run-refresh.ps1 - see the note there.
function Write-Log([string]$Message) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Write-Host $line
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

function Resolve-NodeExe {
  $candidates = @()
  $onPath = Get-Command "node.exe" -ErrorAction SilentlyContinue
  if ($onPath) { $candidates += $onPath.Source }
  $candidates += Join-Path $env:ProgramFiles "nodejs\node.exe"
  $candidates += Join-Path ${env:ProgramFiles(x86)} "nodejs\node.exe"
  $candidates += Join-Path $env:LOCALAPPDATA "Programs\nodejs\node.exe"
  if ($env:NVM_SYMLINK) { $candidates += Join-Path $env:NVM_SYMLINK "node.exe" }
  foreach ($c in $candidates) { if ($c -and (Test-Path $c)) { return $c } }
  return $null
}

$Url = "http://localhost:$Port"

try {
  Write-Log "=== kiosk starting (repo: $RepoRoot) ==="

  $NodeExe = Resolve-NodeExe
  if (-not $NodeExe) { Write-Log "FAILED: node.exe not found."; exit 1 }

  $NextBin = Join-Path $RepoRoot "node_modules\next\dist\bin\next"
  if (-not (Test-Path $NextBin)) {
    Write-Log "FAILED: $NextBin missing. Run: npm ci"
    exit 1
  }
  if (-not (Test-Path (Join-Path $RepoRoot ".next"))) {
    Write-Log "FAILED: no .next build. Run: npm run build"
    exit 1
  }

  # A server left over from a previous session keeps serving its own (now stale) build,
  # and would make `next start` below die on an occupied port. Retiring it here is what
  # makes this script safe to re-run without a reboot.
  $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  foreach ($listener in $listeners) {
    Write-Log ("stopping process {0} already listening on {1}" -f $listener.OwningProcess, $Port)
    Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
  }
  if ($listeners) { Start-Sleep -Seconds 2 }

  Write-Log ("starting: {0} {1} start -p {2}" -f $NodeExe, $NextBin, $Port)
  Start-Process -FilePath $NodeExe `
    -ArgumentList "`"$NextBin`"", "start", "-p", "$Port" `
    -WorkingDirectory $RepoRoot -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $LogDir "server-out.log") `
    -RedirectStandardError (Join-Path $LogDir "server-err.log")

  # Wait for the server to accept connections before opening the browser.
  $ready = $false
  $deadline = (Get-Date).AddSeconds(90)
  while ((Get-Date) -lt $deadline) {
    try {
      if ((Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200) { $ready = $true; break }
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  if (-not $ready) {
    Write-Log "FAILED: server did not answer on $Url within 90s. See logs\server-err.log."
    exit 1
  }
  Write-Log "server is up on $Url"

  $EdgePath = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
  if (-not (Test-Path $EdgePath)) { $EdgePath = "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe" }
  if (-not (Test-Path $EdgePath)) {
    Write-Log "FAILED: Microsoft Edge not found at either Program Files location."
    exit 1
  }

  Start-Process -FilePath $EdgePath -ArgumentList "--kiosk", $Url, "--edge-kiosk-type=fullscreen", "--no-first-run"
  Write-Log "=== kiosk OK ==="
  exit 0
} catch {
  Write-Log "=== kiosk FAILED (PowerShell error) ==="
  Add-Content -Path $LogFile -Value ($_ | Out-String) -Encoding UTF8
  exit 1
}
