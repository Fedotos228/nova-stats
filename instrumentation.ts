const REFRESH_HOUR = 15 // 15:00 local time

function msUntilNextRun() {
  const next = new Date()
  next.setHours(REFRESH_HOUR, 0, 0, 0)
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1)
  return next.getTime() - Date.now()
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const { refreshWeatherImages, hasWeatherImages } = await import("./app/lib/weather-scraper")

  if (!hasWeatherImages()) {
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
