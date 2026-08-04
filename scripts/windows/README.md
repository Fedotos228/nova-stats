# Display machine setup (Windows)

One-time setup for the Windows PC that shows the weather slideshow. It runs the app
locally with `next start` and refreshes the weather images itself once a day, instead of
relying solely on GitHub Actions (which stays as a same-day fallback — see
`.github/workflows/refresh-weather.yml`).

1. Install [Node.js 24 LTS](https://nodejs.org) and Git.
2. Clone the repo and install dependencies:
   ```
   git clone <repo-url>
   cd nova-stats
   npm install
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
   - **NovaStats Weather Refresh** — runs `npm run refresh-weather` daily at 15:00 local
     (pass `-RefreshTime "HH:mm"` to change it).
   - **NovaStats Kiosk** — runs `start-kiosk.ps1` at logon, which starts `npm run start`
     and opens it full-screen in Edge kiosk mode.
6. Log off/on (or reboot) to confirm the kiosk task launches the slideshow automatically.

To pick up app code changes later: `git pull`, `npm install`, `npm run build`, then log
off/on (or manually re-run `start-kiosk.ps1`) to restart the server.
