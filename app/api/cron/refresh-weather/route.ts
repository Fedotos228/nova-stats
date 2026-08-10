import { refreshWeatherImages } from "../../../lib/refresh-weather"

// Downloads, upscales and uploads the daily forecast images. Scheduled by Vercel Cron (see
// vercel.json), with the GitHub Actions workflow calling this same endpoint as a backup in
// case the cron does not fire.
//
// This used to run as a Node script on the display machine, because the ESRGAN upscaler
// needed @tensorflow/tfjs-node's native backend, which crashes in Vercel's serverless
// sandbox. Swapping ESRGAN for sharp removed that constraint, so the job moved here and
// the Windows machine no longer runs anything but a browser.
export const dynamic = "force-dynamic"

// A full run is ~45s (16 downloads, upscales and uploads, sequentially). The ceiling is
// generous so a slow NWS response cannot truncate a run halfway and leave a mixed set.
export const maxDuration = 300

export async function GET(request: Request) {
  // Vercel Cron sends this header automatically when CRON_SECRET is set on the project.
  // Without the check the endpoint would let anyone on the internet trigger a full
  // re-upload of the blob store.
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not configured" }, { status: 500 })
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startedAt = Date.now()
  try {
    const { count } = await refreshWeatherImages()
    const ms = Date.now() - startedAt
    console.log(`[weather] refreshed ${count} images in ${ms}ms`)

    return Response.json({ ok: true, count, ms })
  } catch (error) {
    // Logged as well as returned: the caller may be Vercel Cron, which discards the body
    // and only records the status code, so the runtime log is the only place a failure
    // reason survives.
    console.error("[weather] refresh failed", error)
    const message = error instanceof Error ? error.message : String(error)

    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
