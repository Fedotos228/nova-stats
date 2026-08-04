import { list } from "@vercel/blob"

// Images are populated by scripts/refresh-weather.cjs, run daily on the display machine
// (see scripts/windows/install-scheduled-tasks.ps1) with GitHub Actions
// (.github/workflows/refresh-weather.yml) as a same-day fallback — this module only reads
// them back.
const BLOB_PREFIX = "weather/weatherstreet-"

export async function listWeatherImageUrls(): Promise<string[]> {
  const { blobs } = await list({ prefix: BLOB_PREFIX })
  return blobs
    .sort((a, b) => a.pathname.localeCompare(b.pathname, undefined, { numeric: true }))
    .map((blob) => blob.url)
}
