import { del, list, put } from "@vercel/blob"
import sharp from "sharp"

// These images are published by the National Weather Service. We used to discover their
// URLs by scraping weatherstreet.com's 7-day slider, but that site was only ever a
// middleman pointing at graphical.weather.gov, and on 2026-08-06 its TLS certificate
// expired (notAfter=Aug 5 23:59:59 2026 GMT), which took the whole refresh down with it —
// http:// is 301'd straight back to https://, so there was no way around it. The URLs are
// a plain numbered sequence, so we build them ourselves and drop the middleman.
const imageUrl = (period: number) =>
  `https://graphical.weather.gov/images/conus/Wx${period}_conus.png`

// Wx1..WxN are consecutive NDFD forecast periods 3 hours apart, oldest first (verified:
// Wx1 = Aug 05 7 PM EST, Wx16 = Aug 07 4 PM EST = Wx1 + 15x3h). 16 reproduces exactly the
// set the original scrape returned — roughly two days of forecast.
const IMAGE_COUNT = 16

// 515x388 sources become 2060x1552, which is what the TV renders full-screen.
const UPSCALE_FACTOR = 4

const BLOB_PREFIX = "weather/weatherstreet-"

// Plain Lanczos resampling, not ML super-resolution. This used to run ESRGAN via
// @tensorflow/tfjs-node, which cost ~500MB of native dependencies, could not load at all
// on the Windows display machine, and — the reason this whole job had to live outside the
// app — crashes in Vercel's serverless sandbox. These are flat-colour vector-style maps
// with anti-aliased text rather than photographs, so there is nothing for a
// super-resolution model to reconstruct: a side-by-side of the caption text at 4x was
// indistinguishable between the two. Dropping it is what lets this run as a Vercel Cron.
async function upscaleImage(buffer: Buffer): Promise<Buffer> {
  const { width, height } = await sharp(buffer).metadata()

  const resized = await sharp(buffer)
    .resize(width * UPSCALE_FACTOR, height * UPSCALE_FACTOR, { kernel: "lanczos3" })
    .png()
    .toBuffer()

  // Buffer.from copies, and the copy is the entire point. sharp hands back memory libvips
  // allocated natively, outside the V8 heap; fetch's WHATWG body validation rejects such a
  // buffer on Vercel's linux-x64 runtime with "ArrayBuffer: SharedArrayBuffer is not
  // allowed." That is how the put() below failed in production while passing locally on
  // darwin-arm64. A plain V8-owned copy sidesteps the classification question entirely.
  return Buffer.from(resized)
}

export async function refreshWeatherImages(): Promise<{ count: number }> {
  const freshPathnames: string[] = []

  for (let period = 1; period <= IMAGE_COUNT; period++) {
    const url = imageUrl(period)
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`)

    const upscaled = await upscaleImage(Buffer.from(await res.arrayBuffer()))
    const name = `${String(period).padStart(2, "0")}.png`

    const blob = await put(`${BLOB_PREFIX}${name}`, upscaled, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: false,
      allowOverwrite: true,
      // Defaults to a month — this stable URL gets fresh content daily, so the app's own
      // cache-busting query param (see slideshow-data.ts) does the real work, and this is
      // just a shorter backstop for anything referencing the bare URL.
      cacheControlMaxAge: 60 * 60 * 6, // 6 hours
    })
    freshPathnames.push(blob.pathname)
  }

  // The slideshow only ever shows what's currently in the blob store, so anything this
  // refresh didn't just (re)write is stale and gets cleared out.
  const { blobs } = await list({ prefix: BLOB_PREFIX })
  const fresh = new Set(freshPathnames)
  const stale = blobs.filter((blob) => !fresh.has(blob.pathname))
  if (stale.length > 0) await del(stale.map((blob) => blob.url))

  return { count: freshPathnames.length }
}
