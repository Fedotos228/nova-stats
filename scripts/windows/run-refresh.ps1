# Wrapper the "NovaStats Weather Refresh" scheduled task actually executes.
#
# The task used to run `npm.cmd run refresh-weather` directly as its action, which is a bad
# fit for Task Scheduler: it depends on npm.cmd being resolvable from the task's PATH, it
# spawns an extra cmd.exe layer that swallows the real exit code, and — worst of all — it
# leaves no trace anywhere when it fails, so a task that never once succeeded looks
# identical to one that was never scheduled.
#
# This wrapper instead resolves node.exe explicitly, invokes the refresh script directly
# (skipping npm entirely), and tees everything to a dated log file, so a failed run can be
# diagnosed after the fact with scripts\windows\check-tasks.ps1.
#
# Usage (manual run):  powershell -ExecutionPolicy Bypass -File .\run-refresh.ps1
param(
  [string]$LogDir,
  [int]$KeepLogs = 14
)
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $LogDir) { $LogDir = Join-Path $RepoRoot "logs" }
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$LogFile = Join-Path $LogDir ("refresh-{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))

function Write-Log([string]$Message) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Write-Host $line
  Add-Content -Path $LogFile -Value $line
}

# Task Scheduler hands the task a stripped-down environment, so never rely on a bare
# `node` being on PATH — look in the usual install locations too.
function Resolve-NodeExe {
  $candidates = @()

  $onPath = Get-Command "node.exe" -ErrorAction SilentlyContinue
  if ($onPath) { $candidates += $onPath.Source }

  $candidates += Join-Path $env:ProgramFiles "nodejs\node.exe"
  $candidates += Join-Path ${env:ProgramFiles(x86)} "nodejs\node.exe"
  $candidates += Join-Path $env:LOCALAPPDATA "Programs\nodejs\node.exe"
  if ($env:NVM_SYMLINK) { $candidates += Join-Path $env:NVM_SYMLINK "node.exe" }

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) { return $candidate }
  }
  return $null
}

Write-Log "=== refresh starting (repo: $RepoRoot) ==="

try {
  Set-Location $RepoRoot

  $NodeExe = Resolve-NodeExe
  if (-not $NodeExe) {
    Write-Log "FAILED: node.exe not found. Install Node.js 24 LTS, or add it to PATH."
    exit 1
  }
  Write-Log ("node: {0} ({1})" -f $NodeExe, (& $NodeExe --version))

  $EnvFile = Join-Path $RepoRoot ".env.local"
  if (-not (Test-Path $EnvFile)) {
    Write-Log "FAILED: .env.local is missing. It must define BLOB_READ_WRITE_TOKEN."
    exit 1
  }

  if (-not (Test-Path (Join-Path $RepoRoot "node_modules"))) {
    Write-Log "FAILED: node_modules is missing. Run: npm install --legacy-peer-deps"
    exit 1
  }

  # Same command `npm run refresh-weather` would run, minus the npm/cmd.exe indirection.
  & $NodeExe --env-file=.env.local scripts/refresh-weather.cjs *>&1 |
    Tee-Object -FilePath $LogFile -Append
  $exitCode = $LASTEXITCODE

  if ($exitCode -eq 0) {
    Write-Log "=== refresh OK ==="
  } else {
    Write-Log "=== refresh FAILED (exit $exitCode) ==="
  }
} catch {
  Write-Log ("=== refresh FAILED: {0}" -f $_.Exception.Message)
  $exitCode = 1
} finally {
  Get-ChildItem -Path $LogDir -Filter "refresh-*.log" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip $KeepLogs |
    Remove-Item -Force -ErrorAction SilentlyContinue
}

exit $exitCode
