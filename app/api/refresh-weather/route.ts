import { NextResponse } from "next/server"
import { refreshWeatherImages } from "../../lib/weather-scraper"

export const maxDuration = 60

export async function GET(request: Request) {
  if (process.env.CRON_SECRET) {
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    await refreshWeatherImages()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[weather] refresh failed", err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}