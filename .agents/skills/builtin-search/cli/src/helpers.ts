// Data source: builtin.com's public job board. No authentication required.
// Search returns server-rendered HTML with `data-id="job-card"` markers per
// result (confirmed live 2026-09-18). Detail pages carry a schema.org
// JobPosting block in a `<script type="application/ld+json">` tag - but the
// `+` is HTML-entity-encoded in the type attribute (`application/ld&#x2B;json`),
// so a naive `application/ld\+json` regex misses it. That JSON-LD is the
// authoritative source for detail data; the surrounding HTML is not parsed.

export const SEARCH_URL = "https://builtin.com/jobs"
export const BASE_URL = "https://builtin.com"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "Mozilla/5.0 (compatible; builtin-search-cli/1.0)"

/** Fetch HTML with exponential backoff on 429/5xx. Returns "" on a 404. */
export async function htmlFetch(url: string): Promise<string> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return ""
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.text()
  }
  throw new Error("Request failed after max retries")
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  workplaceType: string | null // "In-Office" | "Remote" | "Hybrid" | null
  employmentType: string | null
  salary: string | null
}

export interface JobDetail {
  id: string
  title: string
  company: string | null
  location: string | null
  url: string
  description: string | null
  employmentType: string | null
  datePosted: string | null
  validThrough: string | null
  salary: string | null
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x2B;/gi, "+")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

function clean(html: string): string {
  return decodeHtmlEntities(stripTags(html))
}

/**
 * Parse the search-results page: split on each job card's anchor id
 * (`id="job-card-<numeric id>"`) and parse each chunk independently, so one
 * malformed card cannot break the rest.
 */
export function parseJobCards(html: string): JobCard[] {
  const results: JobCard[] = []
  const chunks = html.split(/<div id="job-card-(\d+)"/).slice(1)

  // .split() with a capturing group interleaves [id, chunk, id, chunk, ...].
  for (let i = 0; i < chunks.length; i += 2) {
    const id = chunks[i]
    const chunk = chunks[i + 1] ?? ""
    if (!id || !chunk) continue

    const titleMatch = chunk.match(
      /data-id="job-card-title"[^>]*(?:data-alias="([^"]*)")?[^>]*>([\s\S]*?)<\/a>/i,
    )
    const title = titleMatch ? clean(titleMatch[2]) : null
    if (!title) continue
    const href = chunk.match(/<a href="([^"]+)"[^>]*data-id="job-card-title"/i)?.[1]
    const url = href ? `${BASE_URL}${decodeHtmlEntities(href)}` : `${BASE_URL}/jobs`

    const companyMatch = chunk.match(/data-id="company-title"[^>]*>([\s\S]*?)<\/a>/i)
    const company = companyMatch ? clean(companyMatch[1]) || null : null

    const locMatch = chunk.match(/fa-location-dot[^<]*<\/i>\s*<\/div>\s*<div><span[^>]*>([\s\S]*?)<\/span>/i)
    const location = locMatch ? clean(locMatch[1]) || null : null

    const workplaceMatch = chunk.match(/fa-house-building[^<]*<\/i>\s*<\/div>\s*<span[^>]*>([\s\S]*?)<\/span>/i)
    const workplaceType = workplaceMatch ? clean(workplaceMatch[1]) || null : null

    const salaryMatch = chunk.match(/fa-sack-dollar[^<]*<\/i>\s*<\/div>\s*<span[^>]*>([\s\S]*?)<\/span>/i)
    const salary = salaryMatch ? clean(salaryMatch[1]) || null : null

    const employmentMatch = chunk.match(/fa-trophy[^<]*<\/i>\s*<\/div>\s*<span[^>]*>([\s\S]*?)<\/span>/i)
    const employmentType = employmentMatch ? clean(employmentMatch[1]) || null : null

    const dateMatch = chunk.match(/fa-clock[^<]*<\/i>([\s\S]*?)<\/span>/i)
    const date = dateMatch ? clean(dateMatch[1]) || null : null

    results.push({ id, title, company, location, date, url, workplaceType, employmentType, salary })
  }

  return results
}

/**
 * Parse a job detail page's schema.org JobPosting JSON-LD block. builtin.com
 * HTML-entity-encodes the `+` in the script tag's type attribute
 * (`application/ld&#x2B;json`), so this must be matched literally rather than
 * as `application/ld+json`.
 */
export function parseJobDetail(html: string, fallbackId: string, url: string): JobDetail | null {
  const m = html.match(/<script type="application\/ld&#x2B;json">([\s\S]*?)<\/script>/i)
  if (!m) return null

  let data: any
  try {
    data = JSON.parse(decodeHtmlEntities(m[1]))
  } catch {
    return null
  }
  const jp = Array.isArray(data["@graph"]) ? data["@graph"].find((n: any) => n["@type"] === "JobPosting") : data
  if (!jp) return null

  const addr = jp.jobLocation?.address
  const location = addr
    ? [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean).join(", ") || null
    : null

  let salary: string | null = null
  const bs = jp.baseSalary?.value
  if (bs) {
    const min = bs.minValue, max = bs.maxValue, unit = bs.unitText, cur = jp.baseSalary?.currency
    if (min != null && max != null) {
      salary = min === max ? `${cur} ${min}/${unit}` : `${cur} ${min}-${max}/${unit}`
    }
  }

  return {
    id: jp.identifier?.value || fallbackId,
    title: jp.title || "(untitled)",
    company: jp.hiringOrganization?.name || null,
    location,
    url,
    description: jp.description ? clean(jp.description) : null,
    employmentType: jp.employmentType || null,
    datePosted: jp.datePosted || null,
    validThrough: jp.validThrough || null,
    salary,
  }
}
