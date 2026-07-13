import type { Leaderboards } from "./lib/leaderboards"
import { listWeatherImageUrls } from "./lib/weather-scraper"

export const IMAGE_DELAY = 20000
export const DATA_DELAY = 20000

export type Slide =
  | { type: "image"; src: string; delay: number }
  | { type: "leaderboard"; id: keyof Leaderboards; delay: number }

export async function buildSlides(): Promise<Slide[]> {
  const weatherImages = await listWeatherImageUrls()
  // The blob URLs are stable (same pathname every refresh) but cached for a while by
  // Vercel Blob and the browser — busting with the current date keeps them in sync with
  // the once-daily refresh + reload cycle instead of serving yesterday's image forever.
  const cacheBuster = new Date().toISOString().slice(0, 10)

  return [
    ...weatherImages.map((src): Slide => ({ type: "image", src: `${src}?v=${cacheBuster}`, delay: IMAGE_DELAY })),
    { type: "leaderboard", id: "rpm", delay: DATA_DELAY },
    { type: "leaderboard", id: "gross", delay: DATA_DELAY },
    { type: "leaderboard", id: "avg", delay: DATA_DELAY },
  ]
}
