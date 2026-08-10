// Standalone script: downloads the NWS forecast images, upscales them 4x, and uploads the
// result to Vercel Blob. Runs on a daily schedule on the display machine (see
// scripts/windows/install-scheduled-tasks.ps1), with GitHub Actions
// (.github/workflows/refresh-weather.yml) as a same-day fallback.
const { del, list, put } = require("@vercel/blob")
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

// 515x388 sources become 2060x1552, which is what the TV renders full-screen.
const UPSCALE_FACTOR = 4

const BLOB_PREFIX = "weather/weatherstreet-"

// Plain Lanczos resampling, not ML super-resolution. This used to run ESRGAN via
// @tensorflow/tfjs-node, which cost ~500MB of native dependencies, needed a shim for a
// `util` helper Node removed in v20+, and — decisively — does not work at all on the
// Windows display machine, where its prebuilt bindings fail to load. These are flat-colour
// vector-style maps with anti-aliased text rather than photographs, so there is nothing
// for a super-resolution model to reconstruct: a side-by-side of the caption text at 4x
// was indistinguishable between the two.
async function upscaleImage(buffer) {
  const { width, height } = await sharp(buffer).metadata()

  return sharp(buffer)
    .resize(width * UPSCALE_FACTOR, height * UPSCALE_FACTOR, { kernel: "lanczos3" })
    .png()
    .toBuffer()
}

async function main() {
  const urls = Array.from({ length: IMAGE_COUNT }, (_, i) => imageUrl(i + 1))

  const freshPathnames = []
  for (const [i, url] of urls.entries()) {
    const imgRes = await fetch(url)
    if (!imgRes.ok) throw new Error(`Failed to download ${url}: ${imgRes.status}`)
    const raw = Buffer.from(await imgRes.arrayBuffer())

    const upscaled = await upscaleImage(raw)
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

  console.log(`[weather] refreshed ${freshPathnames.length} images (upscaled ${UPSCALE_FACTOR}x)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
