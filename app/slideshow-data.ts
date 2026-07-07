import type { Leaderboards } from "./lib/leaderboards"

export const IMAGE_DELAY = 20000 // 20 sec
export const DATA_DELAY = 20000 // 20 sec

export const weatherImages = [
  "/Screenshot_1.realesrgan.png",
  "/Screenshot_2.realesrgan.png",
  "/Screenshot_3.realesrgan.png",
  "/Screenshot_4.realesrgan.png",
  "/Screenshot_5.realesrgan.png",
  "/Screenshot_6.realesrgan.png",
  "/Screenshot_7.realesrgan.png",
  "/Screenshot_8.realesrgan.png",
  "/Screenshot_9.realesrgan.png",
  "/Screenshot_10.realesrgan.png",
  "/Screenshot_11.realesrgan.png",
  "/Screenshot_12.realesrgan.png",
  "/Screenshot_13.realesrgan.png",
]

export type Slide =
  | { type: "image"; src: string; delay: number }
  | { type: "leaderboard"; id: keyof Leaderboards; delay: number }

export function buildSlides(): Slide[] {
  return [
    ...weatherImages.map((src): Slide => ({ type: "image", src, delay: IMAGE_DELAY })),
    { type: "leaderboard", id: "rpm", delay: DATA_DELAY },
    { type: "leaderboard", id: "gross", delay: DATA_DELAY },
    { type: "leaderboard", id: "ytd", delay: DATA_DELAY },
    { type: "leaderboard", id: "avg", delay: DATA_DELAY },
  ]
}
