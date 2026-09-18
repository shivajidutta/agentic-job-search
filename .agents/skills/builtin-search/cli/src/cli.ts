#!/usr/bin/env bun
// Self-contained CLI for searching jobs on builtin.com's public job board.
// No external CLI framework, so it runs anywhere `bun` is available with
// zero install beyond the repo clone. builtin.com's public robots.txt
// permits crawling /jobs* and /job/* (checked 2026-09-18).

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { q: "query", l: "location", n: "limit" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--") || a.startsWith("-")) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      ;(flags._ as string[]).push(a)
    }
  }
  return flags
}

const HELP = `builtin-cli — search jobs on builtin.com (USA, Canada, or remote scope)

USAGE
  bun run src/cli.ts search --location <usa|canada|remote> [flags]
  bun run src/cli.ts detail <job-url> [--format json|plain]

SEARCH FLAGS
  --location, -l <usa|canada|remote>   Scope. REQUIRED. builtin.com filters by country, not
                                        free-text city - "remote" searches all countries and
                                        is not itself a workplace-type filter (use --remote for that).
  --query, -q <text>                   Keywords (job title, skill, or role). Recommended.
  --remote <remote|hybrid|onsite>      Client-side workplace-type filter (checked against each
                                        card's own badge - builtin.com has no URL param for this).
  --page <n>                           1-indexed page. Default 1.
  --limit, -n <n>                      Cap results emitted (client-side).
  --format <fmt>                       json (default) | table | plain.

Not supported: posting-age filtering (--jobage) - builtin.com's date-filter parameter was not
confirmed during setup, so it's left out rather than guessed and silently applied wrong.

EXAMPLES
  bun run src/cli.ts search -q "AI product manager" -l usa --remote remote --format table
  bun run src/cli.ts search -q "senior product manager" -l canada --format table
  bun run src/cli.ts search -q "founding product manager" -l remote --format table
  bun run src/cli.ts detail https://builtin.com/job/product-manager-intern/11244029 --format plain

No authentication required; builtin.com's public robots.txt permits this access pattern
(checked 2026-09-18). Keep volume reasonable.
`

const KNOWN_FLAGS: Record<string, Set<string>> = {
  search: new Set(["location", "query", "remote", "page", "limit", "format", "help", "h"]),
  detail: new Set(["format", "help", "h"]),
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  const knownFlags = KNOWN_FLAGS[cmd]
  if (knownFlags) {
    for (const key of Object.keys(flags)) {
      if (key === "_" || knownFlags.has(key)) continue
      process.stderr.write(
        JSON.stringify({
          error: `unknown flag --${key} for '${cmd}' - flags are never silently ignored, because a discarded filter changes what the search returns; see --help for the supported flags`,
          code: "UNKNOWN_FLAG",
        }) + "\n",
      )
      return 1
    }
  }

  if (cmd === "search") {
    const location = typeof flags.location === "string" ? flags.location.toLowerCase() : undefined
    if (!location) {
      process.stderr.write(
        JSON.stringify({
          error: 'the --location/-l flag is required: "usa", "canada", or "remote"',
          code: "NO_LOCATION",
        }) + "\n",
      )
      return 1
    }
    if (!["usa", "canada", "remote"].includes(location)) {
      process.stderr.write(
        JSON.stringify({
          error: `--location must be "usa", "canada", or "remote", got "${location}" - builtin.com filters by country, not free-text city`,
          code: "BAD_LOCATION",
        }) + "\n",
      )
      return 1
    }
    if (flags.remote !== undefined && !["remote", "hybrid", "onsite"].includes(String(flags.remote).toLowerCase())) {
      process.stderr.write(
        JSON.stringify({
          error: `--remote must be "remote", "hybrid", or "onsite", got "${flags.remote}"`,
          code: "BAD_REMOTE",
        }) + "\n",
      )
      return 1
    }

    const parseIntFlag = (name: string, raw: string | boolean | string[]): number | null => {
      const val = typeof raw === "string" ? Number(raw.trim()) : NaN
      if (!Number.isInteger(val) || val < 1) {
        process.stderr.write(
          JSON.stringify({ error: `--${name} must be a whole number of at least 1, got "${raw}"`, code: "BAD_ARG" }) + "\n",
        )
        return null
      }
      return val
    }

    if (flags.page !== undefined) {
      const v = parseIntFlag("page", flags.page)
      if (v === null) return 1
      flags.page = String(v)
    }
    if (flags.limit !== undefined) {
      const v = parseIntFlag("limit", flags.limit)
      if (v === null) return 1
      flags.limit = String(v)
    }

    const fmt = (flags.format as string) || "json"
    const opts: SearchOpts = {
      query: typeof flags.query === "string" ? flags.query : undefined,
      location,
      remote: typeof flags.remote === "string" ? flags.remote.toLowerCase() : undefined,
      page: flags.page ? Math.max(1, parseInt(flags.page as string, 10)) : 1,
      limit: flags.limit ? parseInt(flags.limit as string, 10) : undefined,
      format: (["json", "table", "plain"].includes(fmt) ? fmt : "json") as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const id = (flags._ as string[])[1]
    if (!id) {
      process.stderr.write(JSON.stringify({ error: "detail requires a <job-url>", code: "NO_ID" }) + "\n")
      return 1
    }
    const fmt = (flags.format as string) || "json"
    const opts: DetailOpts = { id, format: (fmt === "plain" ? "plain" : "json") as DetailOpts["format"] }
    return runDetail(opts)
  }

  process.stderr.write(JSON.stringify({ error: `Unknown command "${cmd}"`, code: "BAD_CMD" }) + "\n")
  return 1
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    process.stderr.write(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e), code: "INTERNAL_ERROR" }) + "\n",
    )
    process.exit(1)
  })
