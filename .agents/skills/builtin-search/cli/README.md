# builtin-cli

CLI for searching jobs on builtin.com, a startup/tech-focused job board covering the USA
and Canada (plus a remote scope that spans both and more).

**Data source**: builtin.com's public `/jobs` search page (server-rendered HTML) and `/job/<slug>/<id>` detail pages (schema.org JobPosting JSON-LD).
**Authentication**: None required.
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and only pulls dev type defs.

> builtin.com's public `robots.txt` permits crawling `/jobs*` and `/job/*` (checked 2026-09-18).
> Keep volume reasonable and run on your own responsibility.

## Installation

```bash
cd .agents/skills/builtin-search/cli
bun install   # optional — only installs TypeScript dev types
```

The CLI runs without any install because it has zero runtime dependencies.

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search for job listings (`--location` required) |
| `detail` | Fetch full detail for a single job listing (needs the full job URL) |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts `--format json|plain`.
All errors are written to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

## Quick examples

```bash
# AI PM roles, USA, remote workplace type
bun run src/cli.ts search -q "AI product manager" -l usa --remote remote --format table

# Senior product manager roles in Canada
bun run src/cli.ts search -q "senior product manager" -l canada --format table

# Founding PM roles, broadest scope
bun run src/cli.ts search -q "founding product manager" -l remote --format table

# Full detail for one job (use the url field from search results)
bun run src/cli.ts detail https://builtin.com/job/product-manager-intern/11244029 --format plain
```

See `../SKILL.md` for the full flag reference and known limitations.

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--location` | `-l` | **Required.** `usa`, `canada`, or `remote` — builtin.com filters by country, not free-text city. |
| `--query` | `-q` | Keywords (title / skill / role). Recommended. |
| `--remote` | | Client-side workplace-type filter: `remote` \| `hybrid` \| `onsite`. |
| `--page` | | 1-indexed page. |
| `--limit` | `-n` | Cap results emitted. |
| `--format` | | `json` \| `table` \| `plain`. |

**Not supported:** `--jobage` (posting-age filter). builtin.com's date-filter URL parameter
was not confirmed during setup, so it is left out rather than guessed and silently misapplied.
