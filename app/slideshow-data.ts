import type { Leaderboards } from "./lib/leaderboards"
import { getWeatherImages } from "./lib/weather-scraper"

export const IMAGE_DELAY = 20000
export const DATA_DELAY = 20000

export type Slide =
  | { type: "image"; src: string; delay: number }
  | { type: "leaderboard"; id: keyof Leaderboards; delay: number }

export async function buildSlides(): Promise<{ slides: Slide[]; weatherVersion: string }> {
  const { images, version } = await getWeatherImages()

  return {
    slides: [
      // The blob URLs are stable (same pathname every refresh) but cached for a while by
      // Vercel Blob and the browser, so they need busting. The buster is the image's own
      // upload time: it changes the instant the image does, no matter which refresh path
      // ran (local task or GitHub Actions fallback) or what DST is doing to the clock.
      ...images.map((image): Slide => ({
        type: "image",
        src: `${image.url}?v=${image.uploadedAt}`,
        delay: IMAGE_DELAY,
      })),
      { type: "leaderboard", id: "rpm", delay: DATA_DELAY },
      { type: "leaderboard", id: "gross", delay: DATA_DELAY },
      { type: "leaderboard", id: "avg", delay: DATA_DELAY },
    ],
    weatherVersion: version,
  }
}
