import fs from "fs"
import path from "path"
import type { Leaderboards } from "./lib/leaderboards"

export const IMAGE_DELAY = 20000 // 20 sec
export const DATA_DELAY = 20000 // 20 sec

const WEATHER_DIR = path.join(process.cwd(), "public", "weather")
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"])

// Lists every image in public/weather so new screenshots show up without touching this file.
function readWeatherImages(): string[] {
  return fs
    .readdirSync(WEATHER_DIR)
    .filter((file) => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((file) => `/weather/${file}`)
}

export const weatherImages = readWeatherImages()

export type Slide =
  | { type: "image"; src: string; delay: number }
  | { type: "leaderboard"; id: keyof Leaderboards; delay: number }

export function buildSlides(): Slide[] {
  return [
    ...weatherImages.map((src): Slide => ({ type: "image", src, delay: IMAGE_DELAY })),
    { type: "leaderboard", id: "rpm", delay: DATA_DELAY },
    { type: "leaderboard", id: "gross", delay: DATA_DELAY },
    { type: "leaderboard", id: "avg", delay: DATA_DELAY },
  ]
}
