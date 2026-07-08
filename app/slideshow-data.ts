import fs from "fs"
import path from "path"
import type { Leaderboards } from "./lib/leaderboards"
import { listWeatherImageUrls } from "./lib/weather-scraper"

export const IMAGE_DELAY = 20000
export const DATA_DELAY = 20000

export type Slide =
  | { type: "image"; src: string; delay: number }
  | { type: "leaderboard"; id: keyof Leaderboards; delay: number }

export async function buildSlides(): Promise<Slide[]> {
  const weatherImages = await listWeatherImageUrls()

  return [
    ...weatherImages.map((src): Slide => ({ type: "image", src, delay: IMAGE_DELAY })),
    { type: "leaderboard", id: "rpm", delay: DATA_DELAY },
    { type: "leaderboard", id: "gross", delay: DATA_DELAY },
    { type: "leaderboard", id: "avg", delay: DATA_DELAY },
  ]
}
