import { BASE_URL, htmlFetch, parseJobDetail, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string // a builtin.com job path (/job/<slug>/<id>) or a bare numeric id is not resolvable alone - a full URL is required
  format: "json" | "plain"
}

/** builtin.com job URLs encode a slug before the numeric id, so a bare id
 * cannot be turned back into a URL without knowing the slug (unlike LinkedIn).
 * Accept a full URL (with or without the https://builtin.com prefix). */
function normalizeUrl(input: string): string | null {
  if (/^https?:\/\//i.test(input)) return input
  if (input.startsWith("/job/")) return `${BASE_URL}${input}`
  return null
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const url = normalizeUrl(opts.id)
  if (!url) {
    writeError(
      `builtin.com detail requires a full job URL (e.g. https://builtin.com/job/product-manager/12345), not a bare id - the url field from 'search' results works directly`,
      "BAD_ID",
    )
    return 1
  }
  try {
    const html = await htmlFetch(url)
    if (!html) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const fallbackId = url.match(/\/(\d+)\/?$/)?.[1] || url
    const job = parseJobDetail(html, fallbackId, url)
    if (!job) {
      writeError("Could not parse job posting data (page structure may have changed)", "PARSE_FAILED")
      return 1
    }

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        job.employmentType ? `Employment: ${job.employmentType}` : "",
        job.salary ? `Salary: ${job.salary}` : "",
        job.datePosted ? `Posted: ${job.datePosted}` : "",
        job.validThrough ? `Apply by: ${job.validThrough}` : "",
        "",
        job.description || "(no description)",
        "",
        `URL: ${job.url}`,
      ].filter((l) => l !== "")
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
