// Standalone script: downloads the NWS forecast images, upscales them 4x with ESRGAN, and uploads
// the result to Vercel Blob. Runs on a daily schedule on the display machine (see
// scripts/windows/install-scheduled-tasks.ps1), with GitHub Actions
// (.github/workflows/refresh-weather.yml) as a same-day fallback — not inside the Vercel
// app itself, since the AI upscaling step needs @tensorflow/tfjs-node's native (fast)
// backend, which both crashes in Vercel's serverless sandbox (it disallows
// SharedArrayBuffer) and is far too slow on the pure-JS fallback to fit any serverless
// function's execution time limit.
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

// These images are published by the National Weather Service. We used to discover their
// URLs by scraping weatherstreet.com's 7-day slider, but that site was only ever a
// middleman pointing at graphical.weather.gov, and on 2026-08-06 its TLS certificate
// expired (notAfter=Aug 5 23:59:59 2026 GMT), which took the whole refresh down with it —
// http:// is 301'd straight back to https://, so there was no way around it. The URLs are
// a plain numbered sequence, so we build them ourselves and drop the middleman.
const imageUrl = (period) => `https://graphical.weather.gov/images/conus/Wx${period}_conus.png`

// Wx1..WxN are consecutive NDFD forecast periods 3 hours apart, oldest first (verified:
// Wx1 = Aug 05 7 PM EST, Wx16 = Aug 07 4 PM EST = Wx1 + 15x3h). 16 reproduces exactly the
// set the scrape used to return — roughly two days of forecast.
const IMAGE_COUNT = 16

const BLOB_PREFIX = "weather/weatherstreet-"

async function upscaleImage(upscaler, buffer) {
  const tensor = await upscaler.upscale(buffer, { output: "tensor" })
  const [height, width, channels] = tensor.shape
  const pixels = Buffer.from(Uint8Array.from(await tensor.data()))
  tensor.dispose()

  return sharp(pixels, { raw: { width, height, channels } }).png().toBuffer()
}

async function main() {
  const urls = Array.from({ length: IMAGE_COUNT }, (_, i) => imageUrl(i + 1))

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
