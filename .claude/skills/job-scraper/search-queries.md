# Search Queries for Job Scraper

## Installed portal CLIs (primary for `/scrape`)

`/scrape` discovers every portal skill under `.agents/skills/*/SKILL.md` and runs its CLI first. Shipped country-agnostic CLIs include `linkedin-search`, `freehire-search`, and `builtin-search` (added 2026-09-18); Danish demos stay disabled (not targeting Denmark).

**Portal gap (confirmed 2026-09-18):** Shivaji also wants trueup.io, indeed, handshake, glassdoor, and Google Jobs covered. None of these get a dedicated CLI — `/scrape` falls back to the WebSearch `site:` queries below for all of them:
- `handshake.com` — dead end, school-gated, no public listings to scrape.
- `indeed.com` — test-fetched live: robots.txt permits it, but bot detection is active and inconsistent (1 of 4 plain requests succeeded, the rest got blocked, worsening with repeated attempts). Decided against building on this - a paid unlocker service would be needed for reliability, and the cost isn't worth it given LinkedIn/builtin.com/freehire already give coverage.
- `glassdoor.com` — test-fetched live: hard 403 every time, even with full browser headers, landing on a JS security challenge page. Not scrapeable without a paid anti-bot bypass service. More useful to Shivaji as a company-research source (reviews, culture) than a listings source anyway - see `04-job-evaluation.md`'s Company Research Checklist.
- `trueup.io` — client-side-rendered app; its job-data API wasn't found after checking several JS bundles. Left on WebSearch fallback; worth revisiting only if Shivaji finds the actual API URL via browser dev tools.
- `google.com/jobs` — not a real portal, a Search results widget with no public API. WebSearch already reaches it indirectly.

The `site:` query templates in this file are the **WebSearch fallback** — for portals without a CLI, company career pages, or when a CLI fails.

**Language scope:** English only (see CLAUDE.md Languages table) — no translation needed.

## Search Sites

Primary:
- **linkedin.com/jobs** — also covered by the `linkedin-search` CLI
- **builtin.com** — covered by the `builtin-search` CLI (USA/Canada/remote scope; see its SKILL.md for limits)
- **trueup.io** — tech/startup job aggregator, no CLI yet (WebSearch fallback; harder than expected, see portal gap note above)
- **indeed.com**, **glassdoor.com**, **google.com/jobs** — general boards, no CLI yet (WebSearch fallback)
- **freehire.me** — covered by the `freehire-search` CLI

Secondary:
- **handshake.com** — WebSearch fallback
- Direct Google searches with `site:` filters for individual company career pages, as needed (no standing target-company list — priority is landing a role, not a specific employer)

## Query Categories

Queries are grouped by priority, organized by function rather than exact title, since AI PM job titles vary a lot across companies ("naming chaos" — the same underlying role gets posted as "AI PM," "ML Product Manager," "Copilot PM," etc.). Combine each query with the location terms in the Location Filter below.

### Priority 1: AI Product Manager (core title match)

Direct title matches for the primary target.

```
site:linkedin.com/jobs "AI Product Manager" OR "Senior AI Product Manager" OR "Senior Product Manager, AI" remote
site:linkedin.com/jobs "AI PM" OR "Sr AI PM" remote
site:builtin.com "AI Product Manager" OR "Senior Product Manager" AI remote
site:trueup.io "AI Product Manager" remote
"Agentic AI Product Manager" OR "0-to-1 AI Product Manager" remote
```

### Priority 2: Wider AI PM titles (same job, different name)

Catches postings that describe the same role without using "AI PM" in the title.

```
"Founding Product Manager" AI startup remote
"Copilot Product Manager" OR "AI Ops Product Manager" remote
"ML Product Manager" OR "Applied AI Product Manager" remote
"Product Manager, LLM" OR "Enterprise AI PM" remote
```

### Priority 3: Skill-keyword search (title-agnostic)

Matches on the function itself via the skill vocabulary current AI PM job descriptions converge on, regardless of what the title says. Pair with a PM/seniority term to avoid noise from unrelated engineering postings.

```
("AI product manager" OR "agentic" OR "AI agents") AND ("evals" OR "human-in-the-loop" OR "guardrails" OR "RAG")
("AI product manager" OR "ML product manager") AND ("agent orchestration" OR "context engineering" OR "AI adoption")
site:linkedin.com/jobs "product manager" "agentic workflows" OR "AI-native" remote
```

### Priority 4: Growth-adjacent and senior-scope (wider net)

Broader roles per candidate-specific working rule #4 — senior scope (Director/VP) can surface but is flagged as a stretch to defend in an interview; growth-titled roles are adjacent to the actual work history.

```
"Growth Product Manager" AI OR agents remote
"Director, Product Management" AI OR agentic remote
"Head of AI Product" OR "Product Lead, AI" remote
```

## Location Filter

Fully remote-first search, per candidate profile:
- **Primary:** Global remote roles, with emphasis on Europe, North America (US and Canada)
- **Also acceptable:** Toronto / GTA, remote or hybrid
- No relocation

## Language Filter

English only — see CLAUDE.md Languages table (English, Hindi). No non-English query variants needed.

## Date Filter

Only include jobs posted within the last 14 days, or with an application deadline that has not yet passed. If a posting date cannot be determined, include it but flag as "date unknown".

## Adapting Queries

If the user specifies a focus area, select queries from the matching category and also generate 2-3 custom queries for that focus. For example:
- "/scrape agentic" -> Priority 3 queries + custom agentic-specific queries
- "/scrape director" -> Priority 4 queries + custom senior-scope queries
