---
name: builtin-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs on builtin.com — a startup/tech-
  focused job board covering the USA and Canada, plus a remote scope spanning both. Invoke for
  open positions, vacancies, and hiring at startups and tech companies. Trigger phrases:
  find a job on builtin, builtin.com jobs, tech startup jobs, search builtin, look up this
  builtin job posting.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/builtin-search/cli/src/cli.ts *)
---

# Built In Search Skill

Search live job listings from builtin.com's public job board, scoped to the USA, Canada,
or a broader remote search across both. No authentication, no API key, and **zero runtime
dependencies** — it runs with just `bun`.

builtin.com's public `robots.txt` permits crawling `/jobs*` and `/job/*` (checked 2026-09-18).
Keep volume reasonable; this is not a bulk-data-collection tool.

## When to use this skill

- Search for startup/tech job openings in the USA, Canada, or remotely
- Filter by workplace type (remote/hybrid/onsite) after searching
- Get the full description, salary range, and posting dates for a specific listing

## Commands

### Search job listings

```bash
bun run .agents/skills/builtin-search/cli/src/cli.ts search --location <usa|canada|remote> [flags]
```

Key flags:
- `--location <usa|canada|remote>` / `-l` — **required.** builtin.com filters by country, not
  free-text city or region. `remote` searches the broadest scope; it is not itself a workplace-type
  filter (use `--remote` for that).
- `--query <text>` / `-q <text>` — keyword search (title, skill, role). Recommended.
- `--remote <remote|hybrid|onsite>` — client-side workplace-type filter, checked against each
  result's own badge (builtin.com has no URL parameter for this).
- `--page <n>` — page number (1-indexed).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

**Not supported:** posting-age filtering (`--jobage`). builtin.com's date-filter URL parameter
was not confirmed during setup, so it is left out rather than guessed and silently misapplied —
see `url-reference.md`.

### Fetch full job detail

```bash
bun run .agents/skills/builtin-search/cli/src/cli.ts detail <job-url> [--format json|plain]
```

Requires the **full job URL** (e.g. `https://builtin.com/job/product-manager-intern/11244029`) —
the `url` field from a `search` result works directly. A bare numeric id is not enough:
builtin.com job URLs encode a slug before the id, unlike LinkedIn's. Returns the full
description, employment type, salary, and posting/expiry dates.

## Usage examples

```bash
# AI PM roles, USA, remote workplace type
bun run .agents/skills/builtin-search/cli/src/cli.ts search -q "AI product manager" -l usa --remote remote --format table

# Senior product manager roles in Canada
bun run .agents/skills/builtin-search/cli/src/cli.ts search -q "senior product manager" -l canada --format table

# Founding PM roles, broadest scope
bun run .agents/skills/builtin-search/cli/src/cli.ts search -q "founding product manager" -l remote --format table

# Full details for a specific job
bun run .agents/skills/builtin-search/cli/src/cli.ts detail https://builtin.com/job/product-manager-intern/11244029 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing URLs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data is from builtin.com's public `/jobs` search page and `/job/<slug>/<id>` detail pages —
  no credentials required.
- Detail pages carry a schema.org `JobPosting` block, but its script tag HTML-entity-encodes
  the `+` in `application/ld+json` — see `url-reference.md` for the exact quirk.
- Country scope only: USA and Canada, plus a combined "remote" scope. No free-text city/region
  search the way LinkedIn has.
