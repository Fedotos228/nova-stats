import type { Leaderboard, LeaderboardRow } from "../lib/leaderboards"

// Exact per-rank cell fill colors lifted from the source spreadsheet template
// (a green -> yellow -> orange scale baked into the rank and value columns).
const RANK_COLORS = [
  "#36B854",
  "#36B854",
  "#46BD59",
  "#56C25F",
  "#66C764",
  "#76CC6A",
  "#86D16F",
  "#96D674",
  "#A6DB7A",
  "#B6E080",
  "#C6E586",
  "#D6EA8C",
  "#E6EF91",
  "#F0E188",
  "#F9D27F",
  "#FFBF76",
  "#FFAC6E",
  "#FF9966",
  "#FF8D5F",
  "#FF8138",
]

// Column widths, taken verbatim from the template's A:F column widths (15.13, 6.38, 48.88, 18.88, 133, 15.13).
const COLUMNS = "6.375% 2.688% 20.59% 7.953% 56.03% 6.375%"

function Row({ row, maxValue }: { row: LeaderboardRow; maxValue: number }) {
  const color = RANK_COLORS[row.rank - 1] ?? "#FF8138"

  return (
    <div className="grid items-stretch" style={{ gridTemplateColumns: COLUMNS, flex: "34.5 0 0" }}>
      <span />
      <span
        className="flex items-center justify-center text-center font-bold text-black"
        style={{ backgroundColor: color, fontFamily: '"Comic Sans MS", cursive', fontSize: "2.71vh" }}
      >
        {row.rank}
      </span>
      <span
        className="flex items-center justify-center truncate text-center font-bold text-black"
        style={{ fontFamily: "Arial, sans-serif", fontSize: "2.98vh" }}
      >
        {row.name}
      </span>
      <span
        className="flex items-center justify-center text-center font-bold text-black"
        style={{ backgroundColor: color, fontFamily: '"Comic Sans MS", cursive', fontSize: "2.45vh" }}
      >
        {row.value}
      </span>
      <span className="flex items-center px-[0.4vw]">
        <span className="h-[80%] bg-[#F88B24]" style={{ width: `${(row.raw / maxValue) * 100}%` }} />
      </span>
      <span />
    </div>
  )
}

export function LeaderboardPanel({ leaderboard }: { leaderboard: Leaderboard }) {
  const rows = leaderboard.rows.slice(0, 20)
  const maxValue = Math.max(...rows.map((row) => row.raw))

  return (
    <div className="flex h-full w-full flex-col bg-[#EEEEEE]">
      <header className="flex shrink-0 items-end" style={{ flex: "47.25 0 0", paddingLeft: "9.06%" }}>
        <h1
          className="whitespace-nowrap font-bold"
          style={{ fontFamily: "Arial, sans-serif", fontSize: "6.1vh", color: "#980000" }}
        >
          {leaderboard.title}
        </h1>
      </header>

      <div className="flex flex-1 flex-col">
        {rows.map((row) => (
          <Row key={row.rank} row={row} maxValue={maxValue} />
        ))}
      </div>
    </div>
  )
}
