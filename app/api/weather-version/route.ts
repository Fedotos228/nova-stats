import { getWeatherImages } from "../../lib/weather-scraper"

// Heartbeat the kiosk polls so it can reload as soon as new forecast images land, instead
// of guessing at a fixed wall-clock time. See app/components/Slideshow.tsx.
export const dynamic = "force-dynamic"

export async function GET() {
  const { version } = await getWeatherImages()

  return Response.json({ version }, { headers: { "Cache-Control": "no-store" } })
}
