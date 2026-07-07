import Image from "next/image"
import type { Leaderboard, LeaderboardRow } from "../lib/leaderboards"

const RANK_BADGE_COLOR: Record<number, string> = {
  1: "bg-nova-orange text-white",
  2: "bg-nova-gray-400 text-nova-black",
  3: "bg-nova-gray-600 text-white",
}

function ListColumn({ rows, maxValue }: { rows: LeaderboardRow[]; maxValue: number }) {
  return (
    <div className="flex flex-1 flex-col justify-between">
      {rows.map((row) => (
        <div key={row.rank} className="grid grid-cols-[2.7vw_15vw_8vw_1fr] items-center gap-[1vw] py-[0.55vh]">
          <span
            className={`flex h-[2.7vw] w-[2.7vw] items-center justify-center rounded-full font-heading text-[1.4vw] font-bold ${
              RANK_BADGE_COLOR[row.rank] ?? "bg-nova-gray-600/50 text-white"
            }`}
          >
            {row.rank}
          </span>
          <span className="truncate font-body text-[1.8vw] font-medium">{row.name}</span>
          <span className="text-right font-body text-[1.7vw] font-semibold text-nova-orange">{row.value}</span>
          <div className="h-[1.4vh] overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-nova-orange"
              style={{ width: `${(row.raw / maxValue) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function LeaderboardPanel({ leaderboard }: { leaderboard: Leaderboard }) {
  const maxValue = Math.max(...leaderboard.rows.map((row) => row.raw))

  return (
    <div className="flex h-full w-full flex-col bg-nova-black px-[3.5vw] py-[2.5vh] text-white">
      <header className="mb-[1.8vh] shrink-0">
        <Image src="/logo.svg" alt="Nova Lines" width={157} height={60} className="mb-[1vh] h-auto w-[9vw]" />
        <h1 className="font-heading text-[4.2vw] font-bold uppercase leading-none text-white">
          {leaderboard.title}
        </h1>
        <div className="mt-[1.5vh] h-1 w-[8vw] bg-nova-orange" />
      </header>

      <div className="grid grow grid-cols-2 gap-x-[2.5vw]">
        <ListColumn rows={leaderboard.rows.slice(0, 10)} maxValue={maxValue} />
        <ListColumn rows={leaderboard.rows.slice(10, 20)} maxValue={maxValue} />
      </div>
    </div>
  )
}
