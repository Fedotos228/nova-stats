import { list } from "@vercel/blob"

// Images are populated by scripts/refresh-weather.cjs (run on a schedule via GitHub
// Actions, see .github/workflows/refresh-weather.yml) — this module only reads them back.
const BLOB_PREFIX = "weather/weatherstreet-"

export async function listWeatherImageUrls(): Promise<string[]> {
  const { blobs } = await list({ prefix: BLOB_PREFIX })
  return blobs
    .sort((a, b) => a.pathname.localeCompare(b.pathname, undefined, { numeric: true }))
    .map((blob) => blob.url)
}
