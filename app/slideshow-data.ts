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
  // Vercel Blob and the browser — busting with a date keeps them in sync with the
  // once-daily refresh + reload cycle instead of serving yesterday's image forever.
  // The refresh cron runs at 12:00 UTC (see .github/workflows/refresh-weather.yml), not
  // at UTC midnight, so the buster must roll over at 12:00 UTC too — otherwise it stays
  // unchanged across the actual image refresh and only flips 12h later, at midnight.
  const cacheBuster = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString().slice(0, 10)

  return [
    ...weatherImages.map((src): Slide => ({ type: "image", src: `${src}?v=${cacheBuster}`, delay: IMAGE_DELAY })),
    { type: "leaderboard", id: "rpm", delay: DATA_DELAY },
    { type: "leaderboard", id: "gross", delay: DATA_DELAY },
    { type: "leaderboard", id: "avg", delay: DATA_DELAY },
  ]
}
