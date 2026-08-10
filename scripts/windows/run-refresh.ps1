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

# -Encoding UTF8 everywhere is load-bearing, not tidiness: in PowerShell 5.1 Add-Content
# defaults to ANSI while Tee-Object writes UTF-16LE, so a log written by both ends up with
# two encodings interleaved and is unreadable whichever way you open it.
function Write-Log([string]$Message) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Write-Host $line
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
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
  #
  # ErrorActionPreference is deliberately relaxed around this one call. Left at "Stop",
  # PowerShell turns the *first* line a native command writes to stderr into a terminating
  # NativeCommandError, which kills the pipeline and discards everything after it — that is
  # how a full Node stack trace once got truncated to a single useless "loader:1520" line.
  # Success here is decided by the exit code below, not by whether stderr was written to.
  $previousEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    # Not Tee-Object: it has no -Encoding in PowerShell 5.1 and hardcodes UTF-16LE.
    & $NodeExe --env-file=.env.local scripts/refresh-weather.cjs 2>&1 | ForEach-Object {
      $text = if ($_ -is [System.Management.Automation.ErrorRecord]) { $_.ToString() } else { $_ }
      Write-Host $text
      Add-Content -Path $LogFile -Value $text -Encoding UTF8
    }
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousEap
  }

  if ($exitCode -eq 0) {
    Write-Log "=== refresh OK ==="
  } else {
    Write-Log "=== refresh FAILED (exit $exitCode) ==="
  }
} catch {
  # Log the whole error record, not just .Message — the message alone is usually the first
  # line of a much longer Node stack trace, which is exactly the part worth keeping.
  Write-Log "=== refresh FAILED (PowerShell error) ==="
  Add-Content -Path $LogFile -Value ($_ | Out-String) -Encoding UTF8
  $exitCode = 1
} finally {
  Get-ChildItem -Path $LogDir -Filter "refresh-*.log" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip $KeepLogs |
    Remove-Item -Force -ErrorAction SilentlyContinue
}

exit $exitCode
