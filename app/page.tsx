import { Slideshow } from "./components/Slideshow"
import { getLeaderboards } from "./lib/leaderboards"
import { buildSlides } from "./slideshow-data"

export const revalidate = 300

export default async function Home() {
  const leaderboards = await getLeaderboards()

  return <Slideshow slides={buildSlides()} leaderboards={leaderboards} />
}
