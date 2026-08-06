"use client"

import { useEffect, useState } from "react"
import type { Leaderboards } from "../lib/leaderboards"
import type { Slide } from "../slideshow-data"
import ImageContainer from './ImageContainer'
import { LeaderboardPanel } from "./LeaderboardPanel"

function SlideContent({ slide, leaderboards }: { slide: Slide; leaderboards: Leaderboards }) {
  if (slide.type === "image") {
    // eslint-disable-next-line @next/next/no-img-element -- runtime-swapped crossfade slide, not a static asset
    return <ImageContainer src={slide.src} />
  }
  return <LeaderboardPanel leaderboard={leaderboards[slide.id]} />
}

// The weather images change once a day, but *when* depends on which refresh path ran —
// the local task on the display machine (scripts/windows/install-scheduled-tasks.ps1) or
// the GitHub Actions fallback at 18:00 UTC — and the local one's UTC-equivalent shifts
// with DST. This page is left open on a TV for days at a time, so rather than guess a
// wall-clock reload time that has to be after every possibility, it polls a heartbeat
// that changes only when new images actually land, and reloads then.
const VERSION_POLL_INTERVAL = 5 * 60 * 1000

export function Slideshow({
  slides,
  leaderboards,
  weatherVersion,
}: {
  slides: Slide[]
  leaderboards: Leaderboards
  weatherVersion: string
}) {
  // Each slot keeps showing its last assigned slide until it is off-screen and
  // picked as the target for the *next* transition — never swapped while visible.
  const [slotIndices, setSlotIndices] = useState<[number, number]>([0, 1 % slides.length])
  const [activeSlot, setActiveSlot] = useState<0 | 1>(0)

  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const res = await fetch("/api/weather-version", { cache: "no-store" })
        if (!res.ok) return
        const { version } = await res.json()
        // A missing/empty listing would reload us into the same empty page on a loop.
        if (version && version !== weatherVersion) window.location.reload()
      } catch {
        // Offline or the server is restarting — the next tick tries again.
      }
    }, VERSION_POLL_INTERVAL)

    return () => clearInterval(intervalId)
  }, [weatherVersion])

  useEffect(() => {
    const preloaded = slides
      .filter((slide) => slide.type === "image")
      .map((slide) => {
        const img = new window.Image()
        img.src = slide.src
        return img
      })
    return () => {
      preloaded.forEach((img) => {
        img.src = ""
      })
    }
  }, [slides])

  useEffect(() => {
    const currentIndex = slotIndices[activeSlot]

    const advance = (i: number) => {
      const nextIndex = (i + slides.length) % slides.length
      const inactiveSlot = activeSlot === 0 ? 1 : 0
      setSlotIndices((prev) => {
        const next: [number, number] = [...prev]
        next[inactiveSlot] = nextIndex
        return next
      })
      setActiveSlot(inactiveSlot)
    }

    const timerId = setTimeout(() => advance(currentIndex + 1), slides[currentIndex].delay)

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") advance(currentIndex + 1)
      else if (e.key === "ArrowLeft") advance(currentIndex - 1)
    }
    window.addEventListener("keydown", handleKeydown)

    return () => {
      clearTimeout(timerId)
      window.removeEventListener("keydown", handleKeydown)
    }
  }, [activeSlot, slotIndices, slides])

  return (
    <div className="viewer">
      {slotIndices.map((slideIndex, slot) => (
        <div key={slot} className={`slide-layer ${slot === activeSlot ? "active" : ""}`}>
          <SlideContent slide={slides[slideIndex]} leaderboards={leaderboards} />
        </div>
      ))}
    </div>
  )
}
