const PUBLISHED_SHEET_BASE =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTu8npEIOM9d_4LTDI4X0_mQI4hEIX2WeSnndTbFMvixs_4jxOkqpLNp3fxoE4fQtJIntsYz6PUYo7_/pub"

export type LeaderboardRow = {
  rank: number
  name: string
  value: string
  raw: number
}

export type Leaderboard = {
  title: string
  rows: LeaderboardRow[]
}

// Parses CSV text into rows of cells, handling quoted fields (e.g. `"$66,905.00"`).
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        cell += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ",") {
      row.push(cell)
      cell = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else {
      cell += char
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows
}

async function fetchSheetRows(gid: string): Promise<string[][]> {
  const url = `${PUBLISHED_SHEET_BASE}?gid=${gid}&single=true&output=csv`
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`Failed to fetch sheet ${gid}: ${res.status}`)
  return parseCsv(await res.text())
}

function toNumber(raw: string) {
  return Number(raw.replace(/[^0-9.-]/g, ""))
}

function formatMoney(raw: string) {
  return `$${toNumber(raw).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
}

function formatRpm(raw: string) {
  return `$${toNumber(raw).toFixed(2)}`
}

function formatMoneyDecimal(raw: string) {
  return `$${toNumber(raw).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Reads a fixed-position ranked table out of the sheet until the rank column goes blank.
function readTable(
  rows: string[][],
  { rankCol, nameCol, valueCol }: { rankCol: number; nameCol: number; valueCol: number },
): { rank: number; name: string; raw: string }[] {
  const out: { rank: number; name: string; raw: string }[] = []

  for (const row of rows) {
    const rank = Number(row[rankCol])
    const name = row[nameCol]?.trim()
    if (!rank || !name) continue

    out.push({ rank, name, raw: row[valueCol]?.trim() ?? "" })
  }

  return out
}

async function getRpmLeaderboard(): Promise<Leaderboard> {
  const rows = await fetchSheetRows("48417670")
  const entries = readTable(rows, { rankCol: 1, nameCol: 2, valueCol: 6 })

  return {
    title: "Top RPM",
    rows: entries.map((e) => ({ rank: e.rank, name: e.name, value: formatRpm(e.raw), raw: toNumber(e.raw) })),
  }
}

async function getGrossLeaderboard(): Promise<Leaderboard> {
  const rows = await fetchSheetRows("1691011116")
  const entries = readTable(rows, { rankCol: 2, nameCol: 3, valueCol: 6 })

  return {
    title: "Top Gross",
    rows: entries.map((e) => ({ rank: e.rank, name: e.name, value: formatMoneyDecimal(e.raw), raw: toNumber(e.raw) })),
  }
}

async function getAvgLeaderboard(): Promise<Leaderboard> {
  const rows = await fetchSheetRows("1363491589")
  const entries = readTable(rows, { rankCol: 1, nameCol: 3, valueCol: 4 })

  return {
    title: "Top Gross Average / Truck",
    rows: entries.map((e) => ({ rank: e.rank, name: e.name, value: formatMoney(e.raw), raw: toNumber(e.raw) })),
  }
}

export async function getLeaderboards() {
  const [rpm, gross, avg] = await Promise.all([getRpmLeaderboard(), getGrossLeaderboard(), getAvgLeaderboard()])

  return { rpm, gross, avg }
}

export type Leaderboards = Awaited<ReturnType<typeof getLeaderboards>>
