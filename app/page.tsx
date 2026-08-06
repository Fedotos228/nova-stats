import { Slideshow } from "./components/Slideshow"
import { getLeaderboards } from "./lib/leaderboards"
import { buildSlides } from "./slideshow-data"

// Rendered fresh on every request. This page is only ever loaded by the kiosk reloading
// itself, so there is no traffic to amortise a cache over — and under ISR the one reload
// that mattered got served the previous day's HTML (stale-while-revalidate), which pinned
// the slides to yesterday's image URLs until the *next* day's reload. The Google Sheets
// fetches keep their own `revalidate: 300` (see lib/leaderboards.ts), so this only forces
// the blob listing to be re-read.
export const revalidate = 0

export default async function Home() {
  const [leaderboards, { slides, weatherVersion }] = await Promise.all([getLeaderboards(), buildSlides()])

  return <Slideshow slides={slides} leaderboards={leaderboards} weatherVersion={weatherVersion} />
}
