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

// The weather images only ever change once a day, via the GitHub Actions refresh (12:00
// UTC) — this page is left open on a TV for days at a time, so it needs to reload itself
// to pick up the new set. 10 minutes after the cron leaves enough buffer for that job to finish.
const RELOAD_HOUR_UTC = 12
const RELOAD_MINUTE_UTC = 10

function msUntilNextReload() {
  const next = new Date()
  next.setUTCHours(RELOAD_HOUR_UTC, RELOAD_MINUTE_UTC, 0, 0)
  if (next.getTime() <= Date.now()) next.setUTCDate(next.getUTCDate() + 1)
  return next.getTime() - Date.now()
}

export function Slideshow({ slides, leaderboards }: { slides: Slide[]; leaderboards: Leaderboards }) {
  // Each slot keeps showing its last assigned slide until it is off-screen and
  // picked as the target for the *next* transition — never swapped while visible.
  const [slotIndices, setSlotIndices] = useState<[number, number]>([0, 1 % slides.length])
  const [activeSlot, setActiveSlot] = useState<0 | 1>(0)

  useEffect(() => {
    const timerId = setTimeout(() => window.location.reload(), msUntilNextReload())
    return () => clearTimeout(timerId)
  }, [])

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
