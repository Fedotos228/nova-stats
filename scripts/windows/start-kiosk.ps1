# Starts the local Next.js server (built with `npm run build`) and opens it full-screen
# in Edge kiosk mode. Meant to be launched by the "NovaStats Kiosk" scheduled task
# (see install-scheduled-tasks.ps1), which fires at user logon.
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $RepoRoot

$Port = 3000
$Url = "http://localhost:$Port"

Start-Process -FilePath "npm.cmd" -ArgumentList "run", "start" -WorkingDirectory $RepoRoot -WindowStyle Hidden

# Wait for the server to accept connections before opening the browser.
$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $deadline) {
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200) { break }
  } catch {
    Start-Sleep -Seconds 1
  }
}

$EdgePath = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $EdgePath)) { $EdgePath = "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe" }

Start-Process -FilePath $EdgePath -ArgumentList "--kiosk", $Url, "--edge-kiosk-type=fullscreen", "--no-first-run"
