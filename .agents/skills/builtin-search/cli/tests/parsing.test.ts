import { describe, expect, test } from "bun:test"
import { parseJobCards, parseJobDetail } from "../src/helpers.js"

// Fixture trimmed from a real builtin.com search-results response (2026-09-18),
// keeping only the markup parseJobCards actually reads.
const SEARCH_FIXTURE = `
<div id="job-card-11244029" data-id="job-card" class="job-bounded-responsive">
  <div class="left-side-tile-item-2"><a href="/company/rundoo" data-id="company-title"><span>Rundoo</span></a></div>
  <h2><a href="/job/product-manager-intern/11244029" data-id="job-card-title">Product Manager Intern</a></h2>
  <span><i class="fa-regular fa-clock"></i>2 Hours Ago</span>
  <div class="d-flex justify-content-center"><i class="fa-regular fa-house-building"></i></div>
  <span class="font-barlow text-gray-04">In-Office</span>
  <div class="d-flex justify-content-center"><i class="fa-regular fa-location-dot"></i></div>
  <div><span class="font-barlow text-gray-04">Redwood City, CA, USA</span></div>
  <div class="d-flex justify-content-center"><i class="fa-regular fa-sack-dollar"></i></div>
  <span class="font-barlow text-gray-04">122K-122K Annually</span>
  <div class="d-flex justify-content-center"><i class="fa-regular fa-trophy"></i></div>
  <span class="font-barlow text-gray-04">Internship</span>
</div>
<div id="job-card-99887766" data-id="job-card" class="job-bounded-responsive">
  <div class="left-side-tile-item-2"><a href="/company/acme" data-id="company-title"><span>Acme AI</span></a></div>
  <h2><a href="/job/senior-ai-product-manager/99887766" data-id="job-card-title">Senior AI Product Manager</a></h2>
  <span><i class="fa-regular fa-clock"></i>1 Day Ago</span>
  <div class="d-flex justify-content-center"><i class="fa-regular fa-house-building"></i></div>
  <span class="font-barlow text-gray-04">Remote</span>
  <div class="d-flex justify-content-center"><i class="fa-regular fa-location-dot"></i></div>
  <div><span class="font-barlow text-gray-04">United States</span></div>
</div>
`

// Fixture trimmed from a real builtin.com detail page's JSON-LD block
// (2026-09-18). The `+` in `application/ld+json` is HTML-entity-encoded in
// the live markup - this fixture preserves that quirk deliberately.
const DETAIL_FIXTURE = `
<html><head>
<script type="application/ld&#x2B;json">
{
  "@context": "https://schema.org",
  "@graph": [{
    "@type": "JobPosting",
    "title": "Senior AI Product Manager",
    "description": "<p>Own the AI roadmap.</p><ul><li>Ship agents</li></ul>",
    "identifier": {"@type": "PropertyValue", "name": "Acme AI", "value": "99887766"},
    "datePosted": "2026-09-17",
    "validThrough": "2026-10-17T00:00:00+00:00",
    "employmentType": "FULL_TIME",
    "hiringOrganization": {"@type": "Organization", "name": "Acme AI"},
    "jobLocation": {"@type": "Place", "address": {"@type": "PostalAddress", "addressCountry": "USA"}},
    "baseSalary": {"@type": "MonetaryAmount", "currency": "USD", "value": {"@type": "QuantitativeValue", "minValue": 150000, "maxValue": 190000, "unitText": "YEAR"}}
  }]
}
</script>
</head><body></body></html>
`

describe("parseJobCards", () => {
  test("parses both cards with all fields", () => {
    const cards = parseJobCards(SEARCH_FIXTURE)
    expect(cards).toHaveLength(2)

    expect(cards[0]).toMatchObject({
      id: "11244029",
      title: "Product Manager Intern",
      company: "Rundoo",
      location: "Redwood City, CA, USA",
      workplaceType: "In-Office",
      employmentType: "Internship",
      salary: "122K-122K Annually",
      url: "https://builtin.com/job/product-manager-intern/11244029",
    })
    expect(cards[0].date).toBe("2 Hours Ago")

    expect(cards[1]).toMatchObject({
      id: "99887766",
      title: "Senior AI Product Manager",
      company: "Acme AI",
      location: "United States",
      workplaceType: "Remote",
    })
  })

  test("returns an empty array for a page with no job cards", () => {
    expect(parseJobCards("<html><body>no results</body></html>")).toEqual([])
  })

  test("one malformed card does not break parsing of the rest", () => {
    const malformed = `<div id="job-card-1" data-id="job-card">no title here</div>${SEARCH_FIXTURE}`
    const cards = parseJobCards(malformed)
    expect(cards).toHaveLength(2)
    expect(cards[0].id).toBe("11244029")
  })
})

describe("parseJobDetail", () => {
  test("parses the JSON-LD block despite the HTML-entity-encoded content type", () => {
    const job = parseJobDetail(DETAIL_FIXTURE, "fallback-id", "https://builtin.com/job/x/99887766")
    expect(job).not.toBeNull()
    expect(job).toMatchObject({
      id: "99887766",
      title: "Senior AI Product Manager",
      company: "Acme AI",
      location: "USA",
      employmentType: "FULL_TIME",
      datePosted: "2026-09-17",
      validThrough: "2026-10-17T00:00:00+00:00",
      salary: "USD 150000-190000/YEAR",
    })
    expect(job!.description).toContain("Own the AI roadmap.")
  })

  test("returns null when no JSON-LD block is present", () => {
    expect(parseJobDetail("<html><body>nothing here</body></html>", "id", "https://builtin.com/x")).toBeNull()
  })
})
