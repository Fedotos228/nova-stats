import { list } from "@vercel/blob"

// Images are populated by app/lib/refresh-weather.ts, invoked daily by Vercel Cron (see
// vercel.json) with GitHub Actions (.github/workflows/refresh-weather.yml) hitting the same
// endpoint later as a same-day fallback — this module only reads them back.
const BLOB_PREFIX = "weather/weatherstreet-"

export type WeatherImage = { url: string; uploadedAt: number }

export type WeatherImageSet = {
  images: WeatherImage[]
  // Identifies the current set of images: changes exactly when a refresh writes new ones,
  // and never otherwise. The client polls this (see app/api/weather-version) to know when
  // to reload, which is why it has to be derived from the blobs themselves rather than
  // from a clock — either the local task or the GitHub Actions fallback may do the
  // refresh, hours apart and at times that shift with DST.
  version: string
}

export async function getWeatherImages(): Promise<WeatherImageSet> {
  const { blobs } = await list({ prefix: BLOB_PREFIX })

  const images = blobs
    .sort((a, b) => a.pathname.localeCompare(b.pathname, undefined, { numeric: true }))
    .map((blob) => ({ url: blob.url, uploadedAt: blob.uploadedAt.getTime() }))

  const newestUpload = images.reduce((max, image) => Math.max(max, image.uploadedAt), 0)

  return { images, version: `${images.length}-${newestUpload}` }
}
