# builtin.com URL Reference

Public, unauthenticated endpoints used by this skill, investigated 2026-09-18.

> builtin.com's public `robots.txt` permits crawling `/jobs*` and `/job/*`. No JobPosting
> ld+json was found on the search-results page itself, only on individual detail pages.

## Search

```
GET https://builtin.com/jobs
```

Query params:

| Param | Meaning | Example |
|-------|---------|---------|
| `search` | Free-text query | `product manager` |
| `country` | Country scope | `USA`, `CAN` |
| `allLoc` | "All locations" flag — broadens beyond builtin.com's city-hub pages | `1` |
| `page` | 1-indexed pagination | `2`, `3`, … |

Confirmed via the page's own `<link rel="canonical">`, which echoes back exactly the params
passed in (e.g. `?search=product+manager&country=USA&allLoc=1`).

Returns server-rendered HTML. Each result is a `<div id="job-card-<numeric id>" data-id="job-card">`
block containing:

- Title + URL: `<a data-id="job-card-title" href="/job/<slug>/<id>">`
- Company: `<a data-id="company-title"><span>...</span></a>`
- Location: a `<span>` following a `fa-location-dot` icon
- Workplace type ("In-Office" / "Remote" / "Hybrid"): a `<span>` following a `fa-house-building` icon
- Salary (when listed): a `<span>` following a `fa-sack-dollar` icon
- Employment type (e.g. "Internship", "Full-time"): a `<span>` following a `fa-trophy` icon
- Relative post date (e.g. "2 Hours Ago"): text following a `fa-clock` icon

**No URL parameter for posting-age or workplace-type filtering was found** — the CLI filters
workplace type client-side after parsing.

## Detail

```
GET https://builtin.com/job/<slug>/<id>
```

The full posting lives in a schema.org `JobPosting` block, but the script tag's own type
attribute HTML-entity-encodes the `+`:

```html
<script type="application/ld&#x2B;json">
  { "@context": "https://schema.org", "@graph": [{ "@type": "JobPosting", ... }] }
</script>
```

A literal `application/ld+json` match misses this — decode HTML entities in the tag itself
before parsing. Fields used: `title`, `description` (HTML string), `identifier.value` (numeric
id), `hiringOrganization.name`, `jobLocation.address` (locality/region/country), `baseSalary`,
`employmentType`, `datePosted`, `validThrough`.

## Notes

- No authentication required.
- Job URLs encode a slug before the numeric id (e.g. `/job/product-manager-intern/11244029`),
  so a bare id cannot be turned back into a URL the way LinkedIn's can — `detail` requires the
  full URL from a `search` result.
- Country scope only covers USA and Canada; there is no free-text city/region query parameter
  the way LinkedIn has.
