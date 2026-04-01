/**
 * Tool handlers for the consolidated serve route.
 *
 * Each handler receives a params object (from query string or POST body)
 * and returns a JSON-serialisable result.  External-API handlers use
 * AbortController with a 10-second timeout.
 */

// ── Shared helpers ──────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 10_000

interface Params {
  [key: string]: unknown
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.length > 0 ? v : fallback
}

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithTimeout(url, init)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Upstream ${res.status}: ${body.slice(0, 300)}`)
  }
  return res.json() as Promise<T>
}

// ── Handler type ────────────────────────────────────────────────────────────

type Handler = (params: Params) => Promise<unknown>

// ── 1. Wikipedia ────────────────────────────────────────────────────────────

const wikipedia: Handler = async (p) => {
  const query = str(p.query, str(p.title))
  if (!query) throw new Error('query parameter required (e.g. "Albert Einstein")')
  const title = encodeURIComponent(query.trim().replace(/ /g, '_'))
  return jsonFetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`,
    { headers: { 'User-Agent': 'settlegrid-serve/1.0' } },
  )
}

// ── 2. REST Countries ───────────────────────────────────────────────────────

const restCountries: Handler = async (p) => {
  const query = str(p.query, str(p.name))
  if (!query) throw new Error('query parameter required (e.g. "Germany")')
  return jsonFetch(
    `https://restcountries.com/v3.1/name/${encodeURIComponent(query)}`,
  )
}

// ── 3. SpaceX ───────────────────────────────────────────────────────────────

const spacex: Handler = async () => {
  return jsonFetch('https://api.spacexdata.com/v4/launches/latest')
}

// ── 4. Hacker News ──────────────────────────────────────────────────────────

const hackerNews: Handler = async () => {
  const ids: number[] = await jsonFetch(
    'https://hacker-news.firebaseio.com/v0/topstories.json',
  )
  const top5 = ids.slice(0, 5)
  const stories = await Promise.all(
    top5.map((id) =>
      jsonFetch<Record<string, unknown>>(
        `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
      ),
    ),
  )
  return { stories }
}

// ── 5. Dad Jokes ────────────────────────────────────────────────────────────

const dadJokes: Handler = async (p) => {
  const term = str(p.query, str(p.term))
  if (term) {
    return jsonFetch(
      `https://icanhazdadjoke.com/search?term=${encodeURIComponent(term)}&limit=5`,
      { headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-serve/1.0' } },
    )
  }
  return jsonFetch('https://icanhazdadjoke.com/', {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-serve/1.0' },
  })
}

// ── 6. ISS Tracker ──────────────────────────────────────────────────────────

const issTracker: Handler = async () => {
  return jsonFetch('http://api.open-notify.org/iss-now.json')
}

// ── 7. Random User ──────────────────────────────────────────────────────────

const randomUser: Handler = async (p) => {
  const count = Math.min(Math.max(Number(p.results) || 1, 1), 10)
  return jsonFetch(`https://randomuser.me/api/?results=${count}`)
}

// ── 8. Open Food Facts ──────────────────────────────────────────────────────

const openFoodFacts: Handler = async (p) => {
  const barcode = str(p.barcode, str(p.query, '737628064502'))
  return jsonFetch(
    `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`,
  )
}

// ── 9. Coinpaprika ──────────────────────────────────────────────────────────

const coinpaprika: Handler = async (p) => {
  const id = str(p.coin, str(p.query, 'btc-bitcoin'))
  return jsonFetch(
    `https://api.coinpaprika.com/v1/tickers/${encodeURIComponent(id)}`,
  )
}

// ── 10. OpenAQ ──────────────────────────────────────────────────────────────

const openaq: Handler = async (p) => {
  const country = str(p.country, 'US')
  const limit = Math.min(Math.max(Number(p.limit) || 5, 1), 20)
  return jsonFetch(
    `https://api.openaq.org/v2/latest?limit=${limit}&country=${encodeURIComponent(country)}`,
  )
}

// ── 11. WHOIS (mock) ────────────────────────────────────────────────────────

const whois: Handler = async (p) => {
  const domain = str(p.domain, str(p.query, 'example.com'))
  return {
    domain,
    registrar: 'Example Registrar LLC',
    createdDate: '2005-03-15T00:00:00Z',
    expiresDate: '2027-03-15T00:00:00Z',
    updatedDate: '2024-11-20T00:00:00Z',
    status: ['clientTransferProhibited'],
    nameServers: ['ns1.example.com', 'ns2.example.com'],
    registrantOrg: 'Privacy Protected',
    registrantCountry: 'US',
    dnssec: 'unsigned',
    note: 'Placeholder WHOIS response for showcase purposes',
  }
}

// ── 12. Wayback Machine ─────────────────────────────────────────────────────

const waybackMachine: Handler = async (p) => {
  const query = str(p.url, str(p.query, 'example.com'))
  return jsonFetch(
    `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(query)}&output=json&limit=5`,
  )
}

// ── 13. MDN Search ──────────────────────────────────────────────────────────

const mdnSearch: Handler = async (p) => {
  const query = str(p.query, str(p.q))
  if (!query) throw new Error('query parameter required (e.g. "Array.map")')
  return jsonFetch(
    `https://developer.mozilla.org/api/v1/search?q=${encodeURIComponent(query)}&locale=en-US`,
  )
}

// ── 14. SSL Labs ────────────────────────────────────────────────────────────

const sslLabs: Handler = async (p) => {
  const host = str(p.host, str(p.query, str(p.domain)))
  if (!host) throw new Error('host parameter required (e.g. "google.com")')
  return jsonFetch(
    `https://api.ssllabs.com/api/v3/getEndpointData?host=${encodeURIComponent(host)}&fromCache=on`,
  )
}

// ── 15. Security Headers ────────────────────────────────────────────────────

const securityHeaders: Handler = async (p) => {
  const url = str(p.url, str(p.query, str(p.domain)))
  if (!url) throw new Error('url parameter required (e.g. "https://example.com")')
  const target = url.startsWith('http') ? url : `https://${url}`
  try {
    const res = await fetchWithTimeout(target, { method: 'HEAD', redirect: 'follow' })
    const headerNames = [
      'strict-transport-security',
      'content-security-policy',
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
      'referrer-policy',
      'permissions-policy',
      'cross-origin-opener-policy',
      'cross-origin-resource-policy',
    ]
    const headers: Record<string, string | null> = {}
    let score = 0
    for (const name of headerNames) {
      const value = res.headers.get(name)
      headers[name] = value
      if (value) score += 1
    }
    const grade =
      score >= 8 ? 'A+' : score >= 7 ? 'A' : score >= 6 ? 'B' :
      score >= 4 ? 'C' : score >= 2 ? 'D' : 'F'
    return { url: target, statusCode: res.status, headers, score, maxScore: headerNames.length, grade }
  } catch (err) {
    return {
      url: target,
      error: err instanceof Error ? err.message : 'Failed to reach host',
      headers: null,
      score: 0,
      grade: 'F',
    }
  }
}

// ── 16. Solar System ────────────────────────────────────────────────────────

const solarSystem: Handler = async (p) => {
  const body = str(p.body, str(p.query))
  if (body) {
    return jsonFetch(
      `https://api.le-systeme-solaire.net/rest/bodies/${encodeURIComponent(body)}`,
    )
  }
  return jsonFetch(
    'https://api.le-systeme-solaire.net/rest/bodies/?filter[]=isPlanet,eq,true',
  )
}

// ── 17. Forex Rates ─────────────────────────────────────────────────────────

const forexRates: Handler = async (p) => {
  const from = str(p.from, 'EUR')
  const to = str(p.to)
  const url = to
    ? `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    : `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}`
  return jsonFetch(url)
}

// ── 18. Central Bank Rates ──────────────────────────────────────────────────

const centralBankRates: Handler = async (p) => {
  const from = str(p.from, 'USD')
  const amount = Math.max(Number(p.amount) || 1, 0.01)
  return jsonFetch(
    `https://api.frankfurter.app/latest?amount=${amount}&from=${encodeURIComponent(from)}`,
  )
}

// ── 19. IP Range ────────────────────────────────────────────────────────────

const ipRange: Handler = async (p) => {
  const ip = str(p.ip, str(p.query))
  const url = ip
    ? `https://ipapi.co/${encodeURIComponent(ip)}/json/`
    : 'https://ipapi.co/json/'
  return jsonFetch(url)
}

// ── 20. Cron Explain (local logic) ──────────────────────────────────────────

const cronExplain: Handler = async (p) => {
  const expression = str(p.expression, str(p.query, str(p.cron)))
  if (!expression) throw new Error('expression parameter required (e.g. "0 * * * *")')

  const parts = expression.trim().split(/\s+/)
  if (parts.length < 5 || parts.length > 6) {
    throw new Error('Cron expression must have 5 or 6 fields')
  }

  const [min, hour, dom, month, dow] = parts
  const desc: string[] = []

  if (min === '0' && hour === '*') desc.push('At the start of every hour')
  else if (min === '*' && hour === '*') desc.push('Every minute')
  else if (min === '*/5') desc.push('Every 5 minutes')
  else if (min === '*/15') desc.push('Every 15 minutes')
  else if (min === '*/30') desc.push('Every 30 minutes')
  else if (min === '0' && hour !== '*') desc.push(`At ${hour}:00`)
  else if (min === '*') desc.push('Every minute')
  else desc.push(`At minute ${min}`)

  if (hour !== '*' && !desc[0]?.includes(':')) desc.push(`during hour ${hour}`)
  if (dom !== '*') desc.push(`on day ${dom} of the month`)
  if (month !== '*') desc.push(`in month ${month}`)
  if (dow !== '*') {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayNum = parseInt(dow, 10)
    desc.push(`on ${Number.isFinite(dayNum) ? (days[dayNum] ?? `day ${dow}`) : dow}`)
  }

  return {
    expression,
    fields: { minute: min, hour, day_of_month: dom, month, day_of_week: dow },
    description: desc.join(' '),
  }
}

// ── 21. JSON Tools (local logic) ────────────────────────────────────────────

const MAX_JSON_SIZE = 100_000

const jsonTools: Handler = async (p) => {
  const action = str(p.action, 'validate')
  const input = str(p.json, str(p.input, str(p.query)))

  if (action === 'validate') {
    if (!input) throw new Error('json parameter required')
    if (input.length > MAX_JSON_SIZE) throw new Error(`Input too large (max ${MAX_JSON_SIZE} chars)`)
    try {
      const parsed = JSON.parse(input)
      return { valid: true, type: Array.isArray(parsed) ? 'array' : typeof parsed, size: input.length }
    } catch (e) {
      return { valid: false, error: (e as Error).message, size: input.length }
    }
  }

  if (action === 'format' || action === 'prettify') {
    if (!input) throw new Error('json parameter required')
    if (input.length > MAX_JSON_SIZE) throw new Error(`Input too large (max ${MAX_JSON_SIZE} chars)`)
    const parsed = JSON.parse(input)
    const formatted = JSON.stringify(parsed, null, 2)
    return { formatted, originalSize: input.length, formattedSize: formatted.length }
  }

  if (action === 'minify') {
    if (!input) throw new Error('json parameter required')
    if (input.length > MAX_JSON_SIZE) throw new Error(`Input too large (max ${MAX_JSON_SIZE} chars)`)
    const parsed = JSON.parse(input)
    const minified = JSON.stringify(parsed)
    return { minified, originalSize: input.length, minifiedSize: minified.length }
  }

  throw new Error('action must be "validate", "format", or "minify"')
}

// ── 22. Diff Tool (local logic) ─────────────────────────────────────────────

const MAX_DIFF_SIZE = 200_000

interface DiffLine {
  type: 'add' | 'remove' | 'equal'
  line: number
  content: string
}

const diffTool: Handler = async (p) => {
  const original = str(p.original, str(p.a, ''))
  const modified = str(p.modified, str(p.b, ''))
  if (!original && !modified) throw new Error('original and modified parameters required')
  if (original.length > MAX_DIFF_SIZE || modified.length > MAX_DIFF_SIZE) {
    throw new Error(`Input too large (max ${MAX_DIFF_SIZE} chars each)`)
  }

  const origLines = original.split('\n')
  const modLines = modified.split('\n')

  if (origLines.length > 2000 || modLines.length > 2000) {
    throw new Error('Inputs too large (max 2000 lines each)')
  }

  const lines: DiffLine[] = []
  const maxLen = Math.max(origLines.length, modLines.length)

  for (let i = 0; i < maxLen && lines.length < 500; i++) {
    if (i >= origLines.length) {
      lines.push({ type: 'add', line: i + 1, content: modLines[i] })
    } else if (i >= modLines.length) {
      lines.push({ type: 'remove', line: i + 1, content: origLines[i] })
    } else if (origLines[i] === modLines[i]) {
      lines.push({ type: 'equal', line: i + 1, content: origLines[i] })
    } else {
      lines.push({ type: 'remove', line: i + 1, content: origLines[i] })
      lines.push({ type: 'add', line: i + 1, content: modLines[i] })
    }
  }

  const added = lines.filter((l) => l.type === 'add').length
  const removed = lines.filter((l) => l.type === 'remove').length

  return {
    identical: added === 0 && removed === 0,
    summary: { added, removed, unchanged: lines.filter((l) => l.type === 'equal').length },
    lines: lines.slice(0, 200),
  }
}

// ── 23. Encoding (local logic) ──────────────────────────────────────────────

const encoding: Handler = async (p) => {
  const action = str(p.action, 'encode_base64')
  const input = str(p.text, str(p.input, str(p.encoded, str(p.query))))

  if (!input) throw new Error('text or encoded parameter required')

  switch (action) {
    case 'encode_base64': {
      const encoded = Buffer.from(input, 'utf-8').toString('base64')
      return { original: input, encoded, bytes: Buffer.byteLength(input, 'utf-8') }
    }
    case 'decode_base64': {
      const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
      const decoded = Buffer.from(normalized, 'base64').toString('utf-8')
      return { encoded: input, decoded, bytes: Buffer.byteLength(decoded, 'utf-8') }
    }
    case 'encode_url':
      return { original: input, encoded: encodeURIComponent(input) }
    case 'decode_url':
      return { encoded: input, decoded: decodeURIComponent(input) }
    case 'encode_hex': {
      const hex = Buffer.from(input, 'utf-8').toString('hex')
      return { original: input, hex, bytes: hex.length / 2 }
    }
    case 'decode_hex': {
      const decoded = Buffer.from(input, 'hex').toString('utf-8')
      return { hex: input, decoded }
    }
    default:
      throw new Error('action must be one of: encode_base64, decode_base64, encode_url, decode_url, encode_hex, decode_hex')
  }
}

// ── 24. Semver (local logic) ────────────────────────────────────────────────

interface SemVer {
  major: number
  minor: number
  patch: number
  prerelease: string[]
  build: string[]
}

function parseSemver(v: string): SemVer | null {
  const match = v.trim().replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-([\w.]+))?(?:\+([\w.]+))?$/)
  if (!match) return null
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] ? match[4].split('.') : [],
    build: match[5] ? match[5].split('.') : [],
  }
}

function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  if (!pa || !pb) throw new Error(`Invalid semver: ${!pa ? a : b}`)
  if (pa.major !== pb.major) return pa.major - pb.major
  if (pa.minor !== pb.minor) return pa.minor - pb.minor
  if (pa.patch !== pb.patch) return pa.patch - pb.patch
  if (pa.prerelease.length === 0 && pb.prerelease.length === 0) return 0
  if (pa.prerelease.length === 0) return 1
  if (pb.prerelease.length === 0) return -1
  for (let i = 0; i < Math.max(pa.prerelease.length, pb.prerelease.length); i++) {
    if (i >= pa.prerelease.length) return -1
    if (i >= pb.prerelease.length) return 1
    const ai = pa.prerelease[i]
    const bi = pb.prerelease[i]
    const an = parseInt(ai, 10)
    const bn = parseInt(bi, 10)
    if (!isNaN(an) && !isNaN(bn)) {
      if (an !== bn) return an - bn
    } else if (ai !== bi) return ai < bi ? -1 : 1
  }
  return 0
}

const semver: Handler = async (p) => {
  const action = str(p.action, 'parse')
  const version = str(p.version, str(p.query, str(p.v)))

  if (action === 'parse') {
    if (!version) throw new Error('version parameter required (e.g. "1.2.3")')
    const v = parseSemver(version)
    if (!v) throw new Error(`Invalid semver: ${version}`)
    return { raw: version, ...v, formatted: `${v.major}.${v.minor}.${v.patch}${v.prerelease.length ? '-' + v.prerelease.join('.') : ''}` }
  }

  if (action === 'compare') {
    const a = str(p.a, version)
    const b = str(p.b)
    if (!a || !b) throw new Error('a and b parameters required')
    const result = compareSemver(a, b)
    return { a, b, result, description: result === 0 ? 'equal' : result > 0 ? `${a} is newer` : `${b} is newer` }
  }

  if (action === 'bump') {
    if (!version) throw new Error('version parameter required')
    const type = str(p.type, 'patch') as 'major' | 'minor' | 'patch'
    const v = parseSemver(version)
    if (!v) throw new Error(`Invalid semver: ${version}`)
    const bumped = { ...v, prerelease: [] as string[], build: [] as string[] }
    if (type === 'major') { bumped.major++; bumped.minor = 0; bumped.patch = 0 }
    else if (type === 'minor') { bumped.minor++; bumped.patch = 0 }
    else { bumped.patch++ }
    return { original: version, type, bumped: `${bumped.major}.${bumped.minor}.${bumped.patch}` }
  }

  if (action === 'sort') {
    const versions = p.versions
    if (!Array.isArray(versions)) throw new Error('versions array required')
    const sorted = (versions as string[]).slice(0, 100).sort(compareSemver)
    return { ascending: sorted, descending: [...sorted].reverse(), latest: sorted[sorted.length - 1] }
  }

  throw new Error('action must be "parse", "compare", "bump", or "sort"')
}

// ── 25. Code Reviewer Pro (mock) ────────────────────────────────────────────

const codeReviewerPro: Handler = async (p) => {
  const code = str(p.code, str(p.query, str(p.input)))
  const language = str(p.language, 'javascript')

  return {
    language,
    linesAnalyzed: code ? code.split('\n').length : 0,
    issues: [
      {
        severity: 'warning',
        line: 3,
        message: 'Consider using const instead of let for variables that are not reassigned',
        rule: 'prefer-const',
        suggestion: 'Replace let with const',
      },
      {
        severity: 'info',
        line: 7,
        message: 'Function could benefit from explicit return type annotation',
        rule: 'explicit-return-type',
        suggestion: 'Add return type annotation',
      },
      {
        severity: 'warning',
        line: 12,
        message: 'Avoid using magic numbers; extract to named constants',
        rule: 'no-magic-numbers',
        suggestion: 'Extract 86400 to a constant like SECONDS_PER_DAY',
      },
    ],
    summary: {
      errors: 0,
      warnings: 2,
      info: 1,
      score: 82,
      grade: 'B+',
    },
    recommendations: [
      'Add JSDoc comments to exported functions',
      'Consider adding error boundary handling',
      'Unit test coverage appears low for edge cases',
    ],
  }
}

// ── 26. Data Enrichment (mock) ──────────────────────────────────────────────

const dataEnrichment: Handler = async (p) => {
  const email = str(p.email, '')
  const domain = str(p.domain, str(p.query, ''))
  const company = str(p.company, '')

  if (email) {
    const parts = email.split('@')
    const domainPart = parts[1] ?? 'unknown.com'
    return {
      email,
      verified: true,
      deliverable: true,
      disposable: false,
      domain: domainPart,
      person: {
        firstName: 'Jane',
        lastName: 'Smith',
        title: 'Senior Software Engineer',
        company: domainPart.split('.')[0]?.charAt(0).toUpperCase() + (domainPart.split('.')[0]?.slice(1) ?? ''),
        linkedIn: `https://linkedin.com/in/janesmith`,
        location: 'San Francisco, CA',
      },
      companyInfo: {
        name: domainPart.split('.')[0]?.charAt(0).toUpperCase() + (domainPart.split('.')[0]?.slice(1) ?? ''),
        industry: 'Technology',
        size: '51-200',
        founded: 2018,
      },
    }
  }

  if (domain || company) {
    const name = company || (domain ? domain.split('.')[0] ?? 'Unknown' : 'Unknown')
    return {
      domain: domain || `${name.toLowerCase()}.com`,
      company: {
        name: name.charAt(0).toUpperCase() + name.slice(1),
        industry: 'Technology',
        sector: 'Software',
        size: '51-200 employees',
        revenue: '$10M - $50M',
        founded: 2018,
        headquarters: 'San Francisco, CA',
        description: `${name.charAt(0).toUpperCase() + name.slice(1)} is a technology company specializing in innovative software solutions.`,
        socialProfiles: {
          linkedIn: `https://linkedin.com/company/${name.toLowerCase()}`,
          twitter: `https://twitter.com/${name.toLowerCase()}`,
        },
        technologies: ['React', 'Node.js', 'PostgreSQL', 'AWS'],
      },
    }
  }

  throw new Error('Provide email, domain, or company parameter')
}

// ── 27. Image Classifier (mock) ─────────────────────────────────────────────

const imageClassifier: Handler = async (p) => {
  const url = str(p.url, str(p.image, str(p.query)))

  return {
    imageUrl: url || 'https://example.com/sample.jpg',
    classifications: [
      { label: 'golden retriever', confidence: 0.92, category: 'animal' },
      { label: 'dog', confidence: 0.98, category: 'animal' },
      { label: 'pet', confidence: 0.95, category: 'concept' },
      { label: 'outdoor', confidence: 0.78, category: 'scene' },
      { label: 'grass', confidence: 0.71, category: 'nature' },
    ],
    metadata: {
      modelVersion: '2.1.0',
      processingTimeMs: 342,
      totalClasses: 5,
      topCategory: 'animal',
    },
    moderationFlags: {
      nsfw: false,
      violence: false,
      hate: false,
      selfHarm: false,
    },
  }
}

// ── 28. Market Sentinel (mock) ──────────────────────────────────────────────

const marketSentinel: Handler = async (p) => {
  const ticker = str(p.ticker, str(p.symbol, str(p.query, 'AAPL')))
  const now = new Date().toISOString()

  return {
    ticker: ticker.toUpperCase(),
    timestamp: now,
    sentiment: {
      overall: 0.72,
      bullish: 0.65,
      bearish: 0.15,
      neutral: 0.20,
      label: 'bullish',
    },
    signals: [
      { type: 'momentum', direction: 'up', strength: 0.8, description: 'Strong upward momentum detected on 4H chart' },
      { type: 'volume', direction: 'up', strength: 0.6, description: 'Above-average trading volume' },
      { type: 'social', direction: 'up', strength: 0.55, description: 'Positive social media sentiment trending' },
    ],
    news: [
      { title: `${ticker.toUpperCase()} Reports Strong Q4 Earnings`, sentiment: 0.85, source: 'Reuters', hoursAgo: 2 },
      { title: `Analysts Upgrade ${ticker.toUpperCase()} Target Price`, sentiment: 0.78, source: 'Bloomberg', hoursAgo: 6 },
      { title: `${ticker.toUpperCase()} Announces New Product Line`, sentiment: 0.65, source: 'CNBC', hoursAgo: 14 },
    ],
    riskLevel: 'moderate',
    recommendation: 'Monitor for entry opportunity on pullback',
  }
}

// ── 29. Translation Engine (mock) ───────────────────────────────────────────

const translationEngine: Handler = async (p) => {
  const text = str(p.text, str(p.query, str(p.input, 'Hello, world!')))
  const from = str(p.from, str(p.source, 'en'))
  const to = str(p.to, str(p.target, 'es'))

  const translations: Record<string, string> = {
    'en:es': 'Hola, mundo!',
    'en:fr': 'Bonjour, le monde!',
    'en:de': 'Hallo, Welt!',
    'en:ja': 'こんにちは、世界！',
    'en:zh': '你好，世界！',
    'en:ko': '안녕하세요, 세계!',
    'en:pt': 'Olá, mundo!',
    'en:it': 'Ciao, mondo!',
    'en:ru': 'Привет, мир!',
    'en:ar': 'مرحبا بالعالم!',
  }

  const key = `${from}:${to}`
  const defaultTranslation = text === 'Hello, world!'
    ? (translations[key] ?? `[${to}] ${text}`)
    : `[${to}] ${text}`

  return {
    sourceLanguage: from,
    targetLanguage: to,
    originalText: text,
    translatedText: defaultTranslation,
    confidence: text === 'Hello, world!' ? 0.98 : 0.85,
    detectedLanguage: from,
    alternativeTranslations: [],
    wordCount: text.split(/\s+/).length,
    characterCount: text.length,
  }
}

// ── Handler Map ─────────────────────────────────────────────────────────────

export const handlers: Record<string, Handler> = {
  'wikipedia': wikipedia,
  'rest-countries': restCountries,
  'spacex': spacex,
  'hacker-news': hackerNews,
  'dad-jokes': dadJokes,
  'iss-tracker': issTracker,
  'random-user': randomUser,
  'open-food-facts': openFoodFacts,
  'coinpaprika': coinpaprika,
  'openaq': openaq,
  'whois': whois,
  'wayback-machine': waybackMachine,
  'mdn-search': mdnSearch,
  'ssl-labs': sslLabs,
  'security-headers': securityHeaders,
  'solar-system': solarSystem,
  'forex-rates': forexRates,
  'central-bank-rates': centralBankRates,
  'ip-range': ipRange,
  'cron-explain': cronExplain,
  'json-tools': jsonTools,
  'diff-tool': diffTool,
  'encoding': encoding,
  'semver': semver,
  // 5 showcase mock tools
  'code-reviewer-pro': codeReviewerPro,
  'data-enrichment': dataEnrichment,
  'image-classifier': imageClassifier,
  'market-sentinel': marketSentinel,
  'translation-engine': translationEngine,
}
