import Image from "next/image"
import type { Leaderboard } from "../lib/leaderboards"

const RANK_BADGE_COLOR: Record<number, string> = {
  1: "bg-nova-orange text-white",
  2: "bg-nova-gray-400 text-nova-black",
  3: "bg-nova-gray-600 text-white",
}

function ListColumn({ leaderboard, rows }: { leaderboard: Leaderboard; rows: Leaderboard["rows"] }) {
  const gridTemplate = `2.6vw 1fr repeat(${leaderboard.columns.length}, minmax(5vw, max-content))`

  return (
    <div className="flex flex-col">
      <div
        className="grid items-center gap-[1.2vw] pb-[0.6vh] font-body text-[0.9vw] uppercase tracking-widest text-nova-gray-500"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        <span />
        <span>Driver</span>
        {leaderboard.columns.map((col) => (
          <span key={col} className="text-right">
            {col}
          </span>
        ))}
      </div>

      <div className="flex flex-1 flex-col justify-between">
        {rows.map((row) => (
          <div
            key={row.rank}
            className="grid items-center gap-[1.2vw] border-b border-nova-gray-600/40 py-[0.9vh]"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <span
              className={`flex h-[2.2vw] w-[2.2vw] items-center justify-center rounded-full font-heading text-[1.1vw] font-bold ${
                RANK_BADGE_COLOR[row.rank] ?? "bg-nova-gray-600/50 text-white"
              }`}
            >
              {row.rank}
            </span>
            <span className="truncate font-body text-[1.4vw] font-medium">{row.name}</span>
            {row.values.map((value, i) => (
              <span
                key={i}
                className={`text-right font-body text-[1.3vw] ${
                  i === row.values.length - 1 ? "font-semibold text-nova-orange" : "text-nova-gray-400"
                }`}
              >
                {value}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function LeaderboardPanel({ leaderboard }: { leaderboard: Leaderboard }) {
  return (
    <div className="flex h-full w-full flex-col bg-nova-black px-[6vw] py-[4vh] text-white">
      <header className="mb-[3vh] shrink-0">
        <Image src="/logo.svg" alt="Nova Lines" width={157} height={60} className="mb-[1.5vh] h-auto w-[9vw]" />
        <h1 className="font-heading text-[4.2vw] font-bold uppercase leading-none text-white">
          {leaderboard.title}
        </h1>
        <div className="mt-[1.5vh] h-1 w-[8vw] bg-nova-orange" />
      </header>

      <div className="grid grow grid-cols-2 gap-x-[4vw]">
        <ListColumn leaderboard={leaderboard} rows={leaderboard.rows.slice(0, 10)} />
        <ListColumn leaderboard={leaderboard} rows={leaderboard.rows.slice(10, 20)} />
      </div>
    </div>
  )
}
