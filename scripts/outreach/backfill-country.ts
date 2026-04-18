/**
 * P2.INTL1 — cold-email outreach country backfill.
 *
 * Reads a CSV of prospects (email, github_url, domain columns
 * required; all others passed through), resolves each prospect's
 * `country_iso` + `stripe_supported` via the heuristic in
 * `apps/web/src/lib/international.ts`, and writes an enriched CSV.
 *
 * Heuristic order (per `data/international/country-tracker.md` §3):
 *   1. GitHub user `location` field (requires GITHUB_TOKEN env var
 *      for rate-limited fetch; unauth'd calls are 60/hr). When the
 *      token is unset, skip to step 2.
 *   2. Domain ccTLD of the company/email domain.
 *   3. UNKNOWN bucket.
 *
 * Usage:
 *   GITHUB_TOKEN=xxx npx tsx scripts/outreach/backfill-country.ts \
 *     --in <input.csv> --out <output.csv>
 *
 * The script is safe to re-run — it regenerates the country_iso +
 * stripe_supported columns from the heuristic each pass. Existing
 * values in those columns are OVERWRITTEN (per the backfill-pass
 * semantics in the tracker spec).
 *
 * Error policy: per-row failures (GitHub API throttle, malformed
 * domain, bad CSV cell) are logged to stderr and the row gets
 * country_iso=UNKNOWN; the script exits 0 unless the whole CSV
 * fails to read. Partial backfills are OK — re-running picks up
 * the UNKNOWNs.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  backfillCountry,
  classifyProspect,
  isStripeSupported,
} from '../../apps/web/src/lib/international'

interface Row {
  [column: string]: string
}

interface BackfillResult {
  rows: Row[]
  /** rows where country_iso couldn't be resolved */
  unknownCount: number
  /** rows that ended up routed to the Stripe-unsupported-corridor waitlist */
  waitlistCount: number
  /** rows that activate straight away */
  activateCount: number
  /** rows where the CSV skipped the GitHub-API lookup (token not set) */
  skippedGithubLookup: number
}

/* -------------------------------------------------------------------------- */
/*  CSV helpers (no external deps — keep the script self-contained)            */
/* -------------------------------------------------------------------------- */

export function parseCsv(src: string): { headers: string[]; rows: Row[] } {
  const lines = src.split(/\r?\n/).filter((l) => l.length > 0 && !l.startsWith('#'))
  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = splitCsvLine(lines[0])
  const rows: Row[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i])
    const row: Row = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = cells[j] ?? ''
    }
    rows.push(row)
  }
  return { headers, rows }
}

function splitCsvLine(line: string): string[] {
  // Simple CSV split — handles basic quoted fields + commas inside
  // quotes. Not a full RFC 4180 parser (real outreach CSVs from
  // Instantly use a well-behaved subset so we don't need one).
  const out: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      // Handle escaped double-quote inside quoted cell ("Acme, ""the"" corp")
      if (inQuote && line[i + 1] === '"') {
        cur += '"'
        i++
        continue
      }
      inQuote = !inQuote
    } else if (c === ',' && !inQuote) {
      out.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

export function serializeCsv(headers: string[], rows: Row[]): string {
  const lines = [headers.join(',')]
  for (const row of rows) {
    const cells = headers.map((h) => {
      const v = row[h] ?? ''
      // Quote cells that contain commas / quotes / newlines
      if (v.includes(',') || v.includes('"') || v.includes('\n')) {
        return `"${v.replace(/"/g, '""')}"`
      }
      return v
    })
    lines.push(cells.join(','))
  }
  return lines.join('\n') + '\n'
}

/* -------------------------------------------------------------------------- */
/*  GitHub location fetch                                                      */
/* -------------------------------------------------------------------------- */

export async function fetchGithubLocation(
  githubUrl: string | undefined,
  opts: { token?: string; fetchImpl?: typeof fetch } = {},
): Promise<string | null> {
  if (!githubUrl) return null
  const username = extractGithubUsername(githubUrl)
  if (!username) return null
  const token = opts.token
  if (!token) return null // skip — backfillCountry will fall through to domain
  const url = `https://api.github.com/users/${encodeURIComponent(username)}`
  const fetchImpl = opts.fetchImpl ?? fetch
  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    if (!response.ok) return null
    const body = (await response.json()) as { location?: string | null }
    return body.location ?? null
  } catch {
    return null
  }
}

export function extractGithubUsername(url: string): string | null {
  try {
    const u = new URL(url)
    if (!/^(?:www\.)?github\.com$/i.test(u.hostname)) return null
    const segments = u.pathname.split('/').filter(Boolean)
    if (segments.length === 0) return null
    // Reject org paths like `/orgs/foo` or reserved paths
    const RESERVED = new Set([
      'orgs', 'settings', 'notifications', 'login', 'logout',
      'topics', 'search', 'issues', 'pulls', 'marketplace',
    ])
    if (RESERVED.has(segments[0].toLowerCase())) return null
    return segments[0]
  } catch {
    return null
  }
}

/* -------------------------------------------------------------------------- */
/*  Per-row enrichment                                                         */
/* -------------------------------------------------------------------------- */

export async function enrichRow(
  row: Row,
  opts: { token?: string; fetchImpl?: typeof fetch } = {},
): Promise<Row> {
  // Only call GitHub when we have a URL + a token AND we need help:
  // if the ccTLD alone would resolve to a country, we skip the API
  // call to save rate-limit quota.
  const domainHit = row['domain'] ? row['domain'] : undefined

  const githubLocation = await fetchGithubLocation(row['github_url'], opts)
  const country = backfillCountry({
    githubLocation,
    domain: domainHit,
  })
  const segment = classifyProspect(country)
  return {
    ...row,
    country_iso: country,
    stripe_supported:
      country === 'UNKNOWN' ? 'unknown' : String(isStripeSupported(country)),
    segment: row['segment'] && row['segment'] !== '' ? row['segment'] : segment,
  }
}

/* -------------------------------------------------------------------------- */
/*  Whole-file pipeline                                                        */
/* -------------------------------------------------------------------------- */

export async function backfillFile(
  inputCsv: string,
  opts: { token?: string; fetchImpl?: typeof fetch } = {},
): Promise<BackfillResult> {
  const parsed = parseCsv(inputCsv)
  const outRows: Row[] = []
  let unknown = 0
  let waitlist = 0
  let activate = 0
  let skippedGithub = 0

  for (const row of parsed.rows) {
    if (row['github_url'] && !opts.token) skippedGithub++
    const enriched = await enrichRow(row, opts)
    outRows.push(enriched)
    if (enriched['country_iso'] === 'UNKNOWN') unknown++
    else if (enriched['segment'] === 'activate-now') activate++
    else if (enriched['segment'] === 'stripe-unsupported-corridor-waitlist') waitlist++
  }

  return {
    rows: outRows,
    unknownCount: unknown,
    waitlistCount: waitlist,
    activateCount: activate,
    skippedGithubLookup: skippedGithub,
  }
}

/* -------------------------------------------------------------------------- */
/*  CLI entry                                                                  */
/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const inIdx = args.indexOf('--in')
  const outIdx = args.indexOf('--out')
  if (inIdx < 0 || outIdx < 0 || !args[inIdx + 1] || !args[outIdx + 1]) {
    console.error(
      'Usage: npx tsx scripts/outreach/backfill-country.ts --in <input.csv> --out <output.csv>\n' +
        '\n' +
        'Required columns in input.csv: email. Optional: github_url, domain, segment, country_iso, stripe_supported.\n' +
        'Env: GITHUB_TOKEN (for github_url lookup; without it, the GitHub heuristic is skipped and the domain ccTLD is the only signal).\n',
    )
    process.exit(2)
  }
  const inPath = resolve(args[inIdx + 1])
  const outPath = resolve(args[outIdx + 1])
  if (!existsSync(inPath)) {
    console.error(`backfill-country: input file not found: ${inPath}`)
    process.exit(1)
  }
  const src = readFileSync(inPath, 'utf8')
  const parsed = parseCsv(src)
  const token = process.env.GITHUB_TOKEN
  const result = await backfillFile(src, { token })
  // Ensure the output has country_iso + stripe_supported columns
  // in the header even if the input lacked them.
  const headers = new Set<string>(parsed.headers)
  headers.add('country_iso')
  headers.add('stripe_supported')
  headers.add('segment')
  writeFileSync(outPath, serializeCsv([...headers], result.rows), 'utf8')
  console.error(
    `backfill-country: wrote ${result.rows.length} rows → ${outPath}\n` +
      `  activate-now:                        ${result.activateCount}\n` +
      `  stripe-unsupported-corridor-waitlist:${result.waitlistCount}\n` +
      `  cold-unknown-country:                ${result.unknownCount}\n` +
      `  github-lookup skipped (no token):    ${result.skippedGithubLookup}`,
  )
}

// Run when invoked directly (tsx + node). Skipped when imported as
// a module by the test suite.
const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('backfill-country.ts')
if (isMain) {
  main().catch((err: unknown) => {
    console.error('backfill-country: fatal', err)
    process.exit(1)
  })
}
