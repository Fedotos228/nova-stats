// Standalone script: scrapes the 4-day forecast, upscales it 4x with ESRGAN, and uploads
// the result to Vercel Blob. Runs on a GitHub Actions schedule (see
// .github/workflows/refresh-weather.yml), not inside the Vercel app itself — the AI
// upscaling step needs @tensorflow/tfjs-node's native (fast) backend, which both crashes
// in Vercel's serverless sandbox (it disallows SharedArrayBuffer) and is far too slow on
// the pure-JS fallback to fit any serverless function's execution time limit.
const { del, list, put } = require("@vercel/blob")

// @tensorflow/tfjs-node's prebuilt native bindings call a `util` helper Node removed in v20+.
const util = require("util")
if (!util.isNullOrUndefined) {
  util.isNullOrUndefined = (v) => v === null || v === undefined
}

require("@tensorflow/tfjs-node")
const UpscalerJS = require("upscaler/node")
const model = require("@upscalerjs/esrgan-slim/4x")
const sharp = require("sharp")

const FORECAST_PAGE_URL = "https://www.weatherstreet.com/states/u-s-weather-forecast.htm"
const IMAGE_URL_PATTERN = /https:\/\/graphical\.weather\.gov\/images\/conus\/Wx\d+_conus\.png/g

// The site's 7-day slider steps through 28 forecast periods (4 per day), oldest first.
const PERIODS_PER_DAY = 4
const DAYS_TO_KEEP = 4

const BLOB_PREFIX = "weather/weatherstreet-"

async function upscaleImage(upscaler, buffer) {
  const tensor = await upscaler.upscale(buffer, { output: "tensor" })
  const [height, width, channels] = tensor.shape
  const pixels = Buffer.from(Uint8Array.from(await tensor.data()))
  tensor.dispose()

  return sharp(pixels, { raw: { width, height, channels } }).png().toBuffer()
}

async function main() {
  const res = await fetch(FORECAST_PAGE_URL)
  if (!res.ok) throw new Error(`Failed to load forecast page: ${res.status}`)
  const html = await res.text()

  const urls = [...new Set(html.match(IMAGE_URL_PATTERN) ?? [])].slice(0, DAYS_TO_KEEP * PERIODS_PER_DAY)
  if (urls.length === 0) throw new Error("No forecast images found on the page")

  const upscaler = new UpscalerJS({ model })

  const freshPathnames = []
  for (const [i, url] of urls.entries()) {
    const imgRes = await fetch(url)
    if (!imgRes.ok) throw new Error(`Failed to download ${url}: ${imgRes.status}`)
    const raw = Buffer.from(await imgRes.arrayBuffer())

    const upscaled = await upscaleImage(upscaler, raw)
    const name = `${String(i + 1).padStart(2, "0")}.png`
    const blob = await put(`${BLOB_PREFIX}${name}`, upscaled, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: false,
      allowOverwrite: true,
      // Defaults to a month — this stable URL gets fresh content daily, so the app's
      // own cache-busting query param (see slideshow-data.ts) does the real work, and
      // this is just a shorter backstop for anything that might reference the bare URL.
      cacheControlMaxAge: 60 * 60 * 6, // 6 hours
    })
    freshPathnames.push(blob.pathname)
    console.log(`upscaled ${url} -> ${blob.pathname}`)
  }

  // The slider only ever shows what's currently in the blob store, so anything this
  // refresh didn't just (re)write is stale and gets cleared out.
  const { blobs } = await list({ prefix: BLOB_PREFIX })
  const fresh = new Set(freshPathnames)
  const stale = blobs.filter((blob) => !fresh.has(blob.pathname))
  if (stale.length > 0) await del(stale.map((blob) => blob.url))

  console.log(`[weather] refreshed ${freshPathnames.length} images (upscaled 4x)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
