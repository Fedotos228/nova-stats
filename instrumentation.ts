const REFRESH_HOUR = 14 // 15:00 local time (dev-only fallback; production uses the Vercel Cron below)

function msUntilNextRun() {
  const next = new Date()
  next.setHours(REFRESH_HOUR, 0, 0, 0)
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1)
  return next.getTime() - Date.now()
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  // On Vercel, a Cron Job (see vercel.json) hits /api/refresh-weather on schedule instead.
  // A setTimeout scheduled here has no guarantee of surviving between serverless invocations.
  if (process.env.VERCEL) return

  const { refreshWeatherImages, hasWeatherImages } = await import("./app/lib/weather-scraper")

  if (!(await hasWeatherImages())) {
    await refreshWeatherImages().catch((err) => console.error("[weather] initial refresh failed", err))
  }

  const runDaily = () => {
    setTimeout(async () => {
      await refreshWeatherImages().catch((err) => console.error("[weather] refresh failed", err))
      runDaily()
    }, msUntilNextRun())
  }
  runDaily()
}
