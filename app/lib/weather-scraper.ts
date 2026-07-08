import { execFile } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"
import { promisify } from "util"

const execFileAsync = promisify(execFile)

const FORECAST_PAGE_URL = "https://www.weatherstreet.com/states/u-s-weather-forecast.htm"
const IMAGE_URL_PATTERN = /https:\/\/graphical\.weather\.gov\/images\/conus\/Wx\d+_conus\.png/g

// The site's 7-day slider steps through 28 forecast periods (4 per day), oldest first.
const PERIODS_PER_DAY = 4
const DAYS_TO_KEEP = 4

const FILE_PREFIX = "weatherstreet-"
const WEATHER_DIR = path.join(process.cwd(), "public", "weather")
const UPSCALE_WORKER = path.join(process.cwd(), "scripts", "upscale-images.cjs")

export function hasWeatherImages() {
  return fs.existsSync(WEATHER_DIR) && fs.readdirSync(WEATHER_DIR).length > 0
}

// Runs the upscale worker in its own `node` process: the upscaler/tfjs-node packages
// are CJS-only and don't play well with being imported through Next.js's own bundler.
async function upscaleImages(manifest: { input: string; output: string }[]) {
  const manifestPath = path.join(os.tmpdir(), `weather-upscale-manifest-${Date.now()}.json`)
  fs.writeFileSync(manifestPath, JSON.stringify(manifest))

  try {
    await execFileAsync("node", [UPSCALE_WORKER, manifestPath])
  } finally {
    fs.rmSync(manifestPath, { force: true })
  }
}

export async function refreshWeatherImages() {
  const res = await fetch(FORECAST_PAGE_URL)
  if (!res.ok) throw new Error(`Failed to load forecast page: ${res.status}`)
  const html = await res.text()

  const urls = [...new Set(html.match(IMAGE_URL_PATTERN) ?? [])].slice(0, DAYS_TO_KEEP * PERIODS_PER_DAY)
  if (urls.length === 0) throw new Error("No forecast images found on the page")

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "weather-raw-"))
  try {
    fs.mkdirSync(WEATHER_DIR, { recursive: true })

    const manifest = await Promise.all(
      urls.map(async (url, i) => {
        const imgRes = await fetch(url)
        if (!imgRes.ok) throw new Error(`Failed to download ${url}: ${imgRes.status}`)
        const buffer = Buffer.from(await imgRes.arrayBuffer())
        const name = `${FILE_PREFIX}${String(i + 1).padStart(2, "0")}.png`
        const input = path.join(tmpDir, name)
        fs.writeFileSync(input, buffer)
        return { input, output: path.join(WEATHER_DIR, name) }
      }),
    )

    await upscaleImages(manifest)

    // The slider only ever shows what's in this folder, so anything the refresh
    // didn't just (re)write is stale and gets cleared out.
    const freshNames = new Set(manifest.map(({ output }) => path.basename(output)))
    for (const file of fs.readdirSync(WEATHER_DIR)) {
      if (!freshNames.has(file)) fs.rmSync(path.join(WEATHER_DIR, file))
    }

    console.log(`[weather] refreshed ${manifest.length} images (upscaled 4x)`)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}
