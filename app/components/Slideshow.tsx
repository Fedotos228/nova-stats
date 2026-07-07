"use client"

import { useEffect, useMemo, useState } from "react"
import type { Leaderboards } from "../lib/leaderboards"
import type { Slide } from "../slideshow-data"
import { LeaderboardPanel } from "./LeaderboardPanel"

function SlideContent({ slide, leaderboards }: { slide: Slide; leaderboards: Leaderboards }) {
  if (slide.type === "image") {
    // eslint-disable-next-line @next/next/no-img-element -- runtime-swapped crossfade slide, not a static asset
    return <img src={slide.src} alt="" className="h-full w-full object-contain" />
  }
  return <LeaderboardPanel leaderboard={leaderboards[slide.id]} />
}

export function Slideshow({ slides, leaderboards }: { slides: Slide[]; leaderboards: Leaderboards }) {
  const [index, setIndex] = useState(0)
  const [activeSlot, setActiveSlot] = useState<0 | 1>(0)

  const slots = useMemo<[number, number]>(() => {
    return activeSlot === 0 ? [index, (index + 1) % slides.length] : [(index + 1) % slides.length, index]
  }, [activeSlot, index, slides.length])

  useEffect(() => {
    const advance = (i: number) => {
      setIndex((i + slides.length) % slides.length)
      setActiveSlot((slot) => (slot === 0 ? 1 : 0))
    }

    const timerId = setTimeout(() => advance(index + 1), slides[index].delay)

    const handleKeydown = (e: KeyboardEvent) => {
      clearTimeout(timerId)
      if (e.key === "ArrowRight") advance(index + 1)
      else if (e.key === "ArrowLeft") advance(index - 1)
    }
    window.addEventListener("keydown", handleKeydown)

    return () => {
      clearTimeout(timerId)
      window.removeEventListener("keydown", handleKeydown)
    }
  }, [index, slides])

  return (
    <div className="viewer">
      {slots.map((slideIndex, slot) => (
        <div key={slot} className={`slide-layer ${slot === activeSlot ? "active" : ""}`}>
          <SlideContent slide={slides[slideIndex]} leaderboards={leaderboards} />
        </div>
      ))}
    </div>
  )
}
