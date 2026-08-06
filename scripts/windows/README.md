# Display machine setup (Windows)

One-time setup for the Windows PC that shows the weather slideshow. It runs the app
locally with `next start` and refreshes the weather images itself once a day, with GitHub
Actions as a same-day fallback (see `.github/workflows/refresh-weather.yml`).

## Install

1. Install [Node.js 24 LTS](https://nodejs.org) and Git.
2. Clone the repo and install dependencies:
   ```
   git clone <repo-url>
   cd nova-stats
   npm install --legacy-peer-deps
   ```
3. Create `.env.local` in the repo root with the Blob token (same value used in the
   GitHub Actions secret / Vercel project env):
   ```
   BLOB_READ_WRITE_TOKEN=...
   ```
4. Build the app once: `npm run build`
5. From an **elevated** (Administrator) PowerShell prompt, register the scheduled tasks:
   ```
   cd scripts\windows
   .\install-scheduled-tasks.ps1
   ```
   This installs:
   - **NovaStats Weather Refresh** — runs `run-refresh.ps1` daily at 14:00 local
     (pass `-RefreshTime "HH:mm"` to change it).
   - **NovaStats Kiosk** — runs `start-kiosk.ps1` at logon, which starts `npm run start`
     and opens it full-screen in Edge kiosk mode.
6. **Verify immediately — do not wait until tomorrow:**
   ```
   Start-ScheduledTask -TaskName "NovaStats Weather Refresh"
   .\check-tasks.ps1
   ```
   `check-tasks.ps1` prints each task's last run time and result, and tails the refresh
   log. A healthy run ends with `=== refresh OK ===`.
7. Log off/on (or reboot) to confirm the kiosk task launches the slideshow automatically.

## How the display stays up to date

The kiosk browser polls `/api/weather-version` every 5 minutes and reloads the page when
the image set changes, so new forecasts appear within ~5 minutes of a refresh — whether it
came from this machine's task or from the GitHub Actions fallback. There is no fixed
reload time to keep in sync with the schedule, and DST changes do not affect it.

## Troubleshooting

Run `.\check-tasks.ps1` first. It reports the task's `LastTaskResult`:

| Result | Meaning |
| --- | --- |
| `0` | Success. If the display is still stale, the problem is the browser, not the refresh. |
| `1` | The script ran and failed — the reason is in `logs\refresh-<date>.log`. |
| `2` / `2147942401` | Task Scheduler could not launch the action at all (bad path). |
| `267011` | Never run yet. |
| `2147943712` | Logon failure — re-run `install-scheduled-tasks.ps1` while signed in as the kiosk user. |

Logs live in `logs\refresh-YYYY-MM-DD.log` (14 kept, git-ignored). To run the refresh by
hand and watch it:

```
powershell -ExecutionPolicy Bypass -File .\run-refresh.ps1
```

Note the task runs with `LogonType Interactive`, so it only fires while the kiosk user is
signed in. That is fine for a display PC that is always logged on; if the machine is
asleep at 14:00, `StartWhenAvailable` runs the task shortly after it wakes.

## Updating

To pick up app code changes later: `git pull`, `npm install --legacy-peer-deps`,
`npm run build`, then log off/on (or manually re-run `start-kiosk.ps1`) to restart the
server. Re-run `install-scheduled-tasks.ps1` only if the task definitions changed.
