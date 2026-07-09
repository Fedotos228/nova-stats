import { del, list, put } from "@vercel/blob"
import { upscaleImage } from "./upscale"

const FORECAST_PAGE_URL = "https://www.weatherstreet.com/states/u-s-weather-forecast.htm"
const IMAGE_URL_PATTERN = /https:\/\/graphical\.weather\.gov\/images\/conus\/Wx\d+_conus\.png/g

// The site's 7-day slider steps through 28 forecast periods (4 per day), oldest first.
const PERIODS_PER_DAY = 4
const DAYS_TO_KEEP = 4

// Images are stored in Vercel Blob (not the local filesystem, which isn't writable/persistent
// on Vercel) under this prefix, so the slider can list exactly what the last refresh produced.
const BLOB_PREFIX = "weather/weatherstreet-"

export async function hasWeatherImages() {
  const { blobs } = await list({ prefix: BLOB_PREFIX })
  return blobs.length > 0
}

export async function listWeatherImageUrls(): Promise<string[]> {
  const { blobs } = await list({ prefix: BLOB_PREFIX })
  return blobs
    .sort((a, b) => a.pathname.localeCompare(b.pathname, undefined, { numeric: true }))
    .map((blob) => blob.url)
}

export async function refreshWeatherImages() {
  const res = await fetch(FORECAST_PAGE_URL)
  if (!res.ok) throw new Error(`Failed to load forecast page: ${res.status}`)
  const html = await res.text()

  const urls = [...new Set(html.match(IMAGE_URL_PATTERN) ?? [])].slice(0, DAYS_TO_KEEP * PERIODS_PER_DAY)
  if (urls.length === 0) throw new Error("No forecast images found on the page")

  const rawBuffers = await Promise.all(
    urls.map(async (url) => {
      const imgRes = await fetch(url)
      if (!imgRes.ok) throw new Error(`Failed to download ${url}: ${imgRes.status}`)
      return Buffer.from(await imgRes.arrayBuffer())
    }),
  )

  // Upscaled sequentially: the model runs on a single shared TF session, and running
  // several inferences concurrently isn't worth the resource contention it causes.
  const freshPathnames: string[] = []
  for (const [i, raw] of rawBuffers.entries()) {
    const upscaled = await upscaleImage(raw)
    const name = `${String(i + 1).padStart(2, "0")}.png`
    const blob = await put(`${BLOB_PREFIX}${name}`, upscaled, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: false,
      allowOverwrite: true,
    })
    freshPathnames.push(blob.pathname)
  }

  // The slider only ever shows what's currently in the blob store, so anything the
  // refresh didn't just (re)write is stale and gets cleared out.
  const { blobs } = await list({ prefix: BLOB_PREFIX })
  const fresh = new Set(freshPathnames)
  const stale = blobs.filter((blob) => !fresh.has(blob.pathname))
  if (stale.length > 0) await del(stale.map((blob) => blob.url))

  console.log(`[weather] refreshed ${freshPathnames.length} images (upscaled 4x)`)
}
