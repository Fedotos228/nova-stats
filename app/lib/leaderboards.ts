const PUBLISHED_SHEET_BASE =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTu8npEIOM9d_4LTDI4X0_mQI4hEIX2WeSnndTbFMvixs_4jxOkqpLNp3fxoE4fQtJIntsYz6PUYo7_/pub"

export type LeaderboardRow = {
  rank: number
  name: string
  values: string[]
}

export type Leaderboard = {
  title: string
  columns: string[]
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

// Reads a fixed-position ranked table out of the sheet until the rank column goes blank.
function readTable(
  rows: string[][],
  { rankCol, nameCol, cellCols }: { rankCol: number; nameCol: number; cellCols: number[] },
): LeaderboardRow[] {
  const out: LeaderboardRow[] = []

  for (const row of rows) {
    const rank = Number(row[rankCol])
    const name = row[nameCol]?.trim()
    if (!rank || !name) continue

    out.push({
      rank,
      name,
      values: cellCols.map((col) => row[col]?.trim() ?? ""),
    })
  }

  return out
}

async function getRpmLeaderboard(): Promise<Leaderboard> {
  const rows = await fetchSheetRows("48417670")
  const entries = readTable(rows, { rankCol: 1, nameCol: 2, cellCols: [3, 4, 5, 6] })

  return {
    title: "Top RPM",
    columns: ["Loads", "Miles", "Gross", "RPM"],
    rows: entries.map((e) => ({
      ...e,
      values: [e.values[0], toNumber(e.values[1]).toLocaleString("en-US"), formatMoney(e.values[2]), formatRpm(e.values[3])],
    })),
  }
}

async function getGrossLeaderboards(): Promise<[Leaderboard, Leaderboard]> {
  const rows = await fetchSheetRows("1691011116")

  const gross = readTable(rows, { rankCol: 2, nameCol: 3, cellCols: [4, 5, 6, 7] })
  const ytd = readTable(rows, { rankCol: 25, nameCol: 26, cellCols: [27] })

  return [
    {
      title: "Top Gross",
      columns: ["Loads", "Miles", "Gross", "RPM"],
      rows: gross.map((e) => ({
        ...e,
        values: [e.values[0], toNumber(e.values[1]).toLocaleString("en-US"), formatMoney(e.values[2]), `$${toNumber(e.values[3]).toFixed(2)}`],
      })),
    },
    {
      title: "Top YTD Gross",
      columns: ["Total"],
      rows: ytd.slice(0, 20).map((e) => ({ ...e, values: [formatMoney(e.values[0])] })),
    },
  ]
}

async function getAvgLeaderboard(): Promise<Leaderboard> {
  const rows = await fetchSheetRows("1363491589")
  const entries = readTable(rows, { rankCol: 1, nameCol: 3, cellCols: [4] })

  return {
    title: "Top Gross Average / Truck",
    columns: ["Avg / Truck"],
    rows: entries.map((e) => ({ ...e, values: [formatMoney(e.values[0])] })),
  }
}

export async function getLeaderboards() {
  const [rpm, [gross, ytd], avg] = await Promise.all([
    getRpmLeaderboard(),
    getGrossLeaderboards(),
    getAvgLeaderboard(),
  ])

  return { rpm, gross, ytd, avg }
}

export type Leaderboards = Awaited<ReturnType<typeof getLeaderboards>>
