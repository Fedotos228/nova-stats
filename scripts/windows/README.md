# Display machine setup (Windows)

This PC only shows the slideshow. It does not run the app and does not refresh the
images — it opens `https://nova-stats.vercel.app` full-screen in Edge and nothing else.
No Node.js, no build step, no repo checkout strictly required beyond these scripts.

## Install

1. From an **elevated** (Administrator) PowerShell prompt:
   ```
   cd scripts\windows
   .\install-scheduled-tasks.ps1
   ```
   This registers **NovaStats Kiosk** (opens the slideshow at logon) and removes the old
   **NovaStats Weather Refresh** task if it is still present from a previous setup.
2. Verify immediately, without waiting for a reboot:
   ```
   .\start-kiosk.ps1
   .\check-tasks.ps1
   ```
3. Log off/on once to confirm the kiosk starts by itself.

To point at a different URL: `.\install-scheduled-tasks.ps1 -Url "https://..."`.

## How the images stay up to date

Nothing on this machine is involved:

- **Vercel Cron** runs `/api/cron/refresh-weather` daily at 11:00 UTC (see `vercel.json`),
  which downloads the NWS forecast maps, upscales them 4x and uploads them to Vercel Blob.
- **GitHub Actions** calls the same endpoint at 18:00 UTC as a backup, in case the cron
  does not fire. Both are idempotent.
- The browser polls `/api/weather-version` every 5 minutes and reloads when the image set
  changes, so a refresh reaches the screen within ~5 minutes.

11:00 UTC is 14:00 local in summer and 13:00 in winter — Vercel crons are UTC only and do
not follow DST. Change the `schedule` in `vercel.json` if that matters.

## Troubleshooting

Run `.\check-tasks.ps1`. It shows the kiosk task's last result (decimal and hex) and tails
`logs\kiosk-<date>.log`.

| Result | Meaning |
| --- | --- |
| `0` | Success. |
| `1` | The script failed — the reason is in the log. |
| `267011` | Never run yet — the task only fires at logon. |
| `3221225786` / `0xC000013A` | The process was terminated from outside, not an error of its own. |

If the screen is stale but the images are current, the problem is the browser, not the
refresh. Confirm the images themselves with:

```
curl.exe https://nova-stats.vercel.app/api/weather-version
```

The version string changes whenever new images land.

## Updating

Nothing to do. The app redeploys itself on every push to `main`. Only re-run
`install-scheduled-tasks.ps1` if these scripts themselves change.
