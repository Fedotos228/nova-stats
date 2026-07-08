import { Slideshow } from "./components/Slideshow"
import { getLeaderboards } from "./lib/leaderboards"
import { buildSlides } from "./slideshow-data"

export const revalidate = 300

export default async function Home() {
  const [leaderboards, slides] = await Promise.all([getLeaderboards(), buildSlides()])

  return <Slideshow slides={slides} leaderboards={leaderboards} />
}
