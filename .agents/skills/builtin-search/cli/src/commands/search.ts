import { SEARCH_URL, htmlFetch, parseJobCards, writeError, type JobCard } from "../helpers.js"

export interface SearchOpts {
  query?: string
  location: string // "usa" | "canada" | "remote" (builtin.com's own scope model - see SKILL.md)
  remote?: string // client-side workplace-type filter: "remote" | "hybrid" | "onsite"
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

const LOCATION_TO_COUNTRY: Record<string, string | null> = {
  usa: "USA",
  canada: "CAN",
  remote: null, // no country filter - broadest scope, then client-filtered by workplaceType below
}

function buildUrl(opts: SearchOpts): string {
  const params = new URLSearchParams()
  if (opts.query) params.set("search", opts.query)
  const country = LOCATION_TO_COUNTRY[opts.location.toLowerCase()]
  if (country) params.set("country", country)
  params.set("allLoc", "1")
  if (opts.page > 1) params.set("page", String(opts.page))
  return `${SEARCH_URL}?${params.toString()}`
}

function workplaceMatches(card: JobCard, mode: string): boolean {
  const wt = (card.workplaceType || "").toLowerCase()
  if (mode === "remote") return wt === "remote"
  if (mode === "hybrid") return wt === "hybrid"
  if (mode === "onsite") return wt === "in-office"
  return true
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 40).padEnd(40)
    const company = (c.company || "—").slice(0, 22).padEnd(22)
    const loc = (c.location || "—").slice(0, 20).padEnd(20)
    const wt = (c.workplaceType || "—").padEnd(10)
    return `${c.id.padEnd(10)} ${title} ${company} ${loc} ${wt}`
  })
  const header =
    "ID".padEnd(10) + " " + "TITLE".padEnd(40) + " " + "COMPANY".padEnd(22) + " " + "LOCATION".padEnd(20) + " TYPE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const html = await htmlFetch(buildUrl(opts))
    let cards = parseJobCards(html)
    if (opts.remote) cards = cards.filter((c) => workplaceMatches(c, opts.remote!))
    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.workplaceType || "—"}${c.salary ? " · " + c.salary : ""}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify({ meta: { count: cards.length, page: opts.page }, results: cards }, null, 2) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
