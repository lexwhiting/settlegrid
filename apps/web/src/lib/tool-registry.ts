/**
 * Tool Registry — maps showcase tool slugs to their executable handlers.
 *
 * Each handler is a pure function (no SettleGrid SDK wrapper) that performs
 * the actual API call or local computation. Used by /api/tools/[slug]/call.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ToolMethod {
  handler: (args: Record<string, unknown>) => Promise<unknown>
}

export interface ToolDefinition {
  methods: Record<string, ToolMethod>
}

// ─── Shared helpers ────────────────────────────────────────────────────────────

async function fetchJSON<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'settlegrid-tool-api/1.0',
      ...headers,
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Upstream API ${res.status}: ${body.slice(0, 300)}`)
  }
  return res.json() as Promise<T>
}

function requireString(args: Record<string, unknown>, key: string): string {
  const val = args[key]
  if (!val || typeof val !== 'string') throw new Error(`${key} is required`)
  return (val as string).trim()
}

// ─── 1. json-tools (local computation) ─────────────────────────────────────────

const JSON_MAX_SIZE = 100_000

function safeParse(input: string, label: string): unknown {
  if (typeof input !== 'string') throw new Error(`${label} must be a string`)
  if (input.length > JSON_MAX_SIZE) throw new Error(`${label} too large (max ${JSON_MAX_SIZE} chars)`)
  try { return JSON.parse(input) } catch (e) { throw new Error(`Invalid JSON in ${label}: ${(e as Error).message}`) }
}

function countNodes(obj: unknown): number {
  if (obj === null || typeof obj !== 'object') return 1
  if (Array.isArray(obj)) return 1 + obj.reduce((s: number, v: unknown) => s + countNodes(v), 0)
  return 1 + Object.values(obj as Record<string, unknown>).reduce((s: number, v: unknown) => s + countNodes(v), 0)
}

interface DiffEntry { path: string; type: 'added' | 'removed' | 'changed'; oldValue?: unknown; newValue?: unknown }

function deepDiff(a: unknown, b: unknown, path = ''): DiffEntry[] {
  const diffs: DiffEntry[] = []
  if (a === b) return diffs
  if (a === null || b === null || typeof a !== typeof b) {
    diffs.push({ path: path || '$', type: 'changed', oldValue: a, newValue: b }); return diffs
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const maxLen = Math.max(a.length, b.length)
    for (let i = 0; i < maxLen && diffs.length < 100; i++) {
      const p = `${path}[${i}]`
      if (i >= a.length) diffs.push({ path: p, type: 'added', newValue: b[i] })
      else if (i >= b.length) diffs.push({ path: p, type: 'removed', oldValue: a[i] })
      else diffs.push(...deepDiff(a[i], b[i], p))
    }
    return diffs
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>, bObj = b as Record<string, unknown>
    const allKeys = new Set([...Object.keys(aObj), ...Object.keys(bObj)])
    for (const key of allKeys) {
      if (diffs.length >= 100) break
      const p = path ? `${path}.${key}` : key
      if (!(key in aObj)) diffs.push({ path: p, type: 'added', newValue: bObj[key] })
      else if (!(key in bObj)) diffs.push({ path: p, type: 'removed', oldValue: aObj[key] })
      else diffs.push(...deepDiff(aObj[key], bObj[key], p))
    }
    return diffs
  }
  if (a !== b) diffs.push({ path: path || '$', type: 'changed', oldValue: a, newValue: b })
  return diffs
}

// ─── 2. semver (local computation) ──────────────────────────────────────────────

interface SemVer { major: number; minor: number; patch: number; prerelease: string[]; build: string[] }

function parseSemver(v: string): SemVer | null {
  const match = v.trim().replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-([\w.]+))?(?:\+([\w.]+))?$/)
  if (!match) return null
  return { major: parseInt(match[1]), minor: parseInt(match[2]), patch: parseInt(match[3]), prerelease: match[4] ? match[4].split('.') : [], build: match[5] ? match[5].split('.') : [] }
}

function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a), pb = parseSemver(b)
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
    const ai = pa.prerelease[i], bi = pb.prerelease[i]
    const an = parseInt(ai), bn = parseInt(bi)
    if (!isNaN(an) && !isNaN(bn)) { if (an !== bn) return an - bn }
    else if (ai !== bi) return ai < bi ? -1 : 1
  }
  return 0
}

// ─── 3. diff-tool (local computation) ───────────────────────────────────────────

interface DiffLine { type: 'add' | 'remove' | 'equal'; lineNumber: number; content: string }

function computeLCS(a: string[], b: string[]): boolean[][] {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[])
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  const inLCS: boolean[][] = [Array(m).fill(false) as boolean[], Array(n).fill(false) as boolean[]]
  let i = m, j = n
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { inLCS[0][i - 1] = true; inLCS[1][j - 1] = true; i--; j-- }
    else if (dp[i - 1][j] > dp[i][j - 1]) i--
    else j--
  }
  return inLCS
}

// ─── 4. encoding (local computation) ────────────────────────────────────────────

const HTML_ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const HTML_REVERSE: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&copy;': '\u00a9', '&reg;': '\u00ae', '&trade;': '\u2122' }

// ─── 5. ip-range (local computation) ────────────────────────────────────────────

function ipToInt(ip: string): number {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) throw new Error(`Invalid IP: ${ip}`)
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

function intToIp(int: number): string {
  return `${(int >>> 24) & 255}.${(int >>> 16) & 255}.${(int >>> 8) & 255}.${int & 255}`
}

function parseCidrNotation(cidr: string) {
  const [ip, prefixStr] = cidr.split('/')
  const prefix = parseInt(prefixStr)
  if (isNaN(prefix) || prefix < 0 || prefix > 32) throw new Error(`Invalid prefix: ${prefixStr}`)
  const ipInt = ipToInt(ip)
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0
  const networkInt = (ipInt & mask) >>> 0
  const broadcastInt = (networkInt | (~mask >>> 0)) >>> 0
  return { ip, prefix, networkInt, broadcastInt, mask }
}

const PRIVATE_RANGES = [
  { cidr: '10.0.0.0/8', name: 'Class A Private' },
  { cidr: '172.16.0.0/12', name: 'Class B Private' },
  { cidr: '192.168.0.0/16', name: 'Class C Private' },
  { cidr: '127.0.0.0/8', name: 'Loopback' },
  { cidr: '169.254.0.0/16', name: 'Link-Local' },
]

function isPrivateIp(ip: string) {
  const ipInt = ipToInt(ip)
  for (const r of PRIVATE_RANGES) {
    const parsed = parseCidrNotation(r.cidr)
    if (ipInt >= parsed.networkInt && ipInt <= parsed.broadcastInt) return { isPrivate: true, range: r.name }
  }
  return { isPrivate: false, range: null }
}

// ─── 6. central-bank-rates (hardcoded) ──────────────────────────────────────────

const CENTRAL_BANK_RATES: Record<string, { rate_pct: number; bank: string; last_change: string; direction: string; currency: string }> = {
  us: { rate_pct: 5.50, bank: 'Federal Reserve', last_change: '2023-07-26', direction: 'hold', currency: 'USD' },
  eu: { rate_pct: 4.50, bank: 'European Central Bank', last_change: '2023-09-14', direction: 'hold', currency: 'EUR' },
  uk: { rate_pct: 5.25, bank: 'Bank of England', last_change: '2023-08-03', direction: 'hold', currency: 'GBP' },
  japan: { rate_pct: 0.10, bank: 'Bank of Japan', last_change: '2024-03-19', direction: 'hike', currency: 'JPY' },
  china: { rate_pct: 3.45, bank: "People's Bank of China", last_change: '2023-08-21', direction: 'cut', currency: 'CNY' },
  brazil: { rate_pct: 10.75, bank: 'Banco Central do Brasil', last_change: '2024-03-20', direction: 'cut', currency: 'BRL' },
  india: { rate_pct: 6.50, bank: 'Reserve Bank of India', last_change: '2023-02-08', direction: 'hold', currency: 'INR' },
  australia: { rate_pct: 4.35, bank: 'Reserve Bank of Australia', last_change: '2023-11-07', direction: 'hold', currency: 'AUD' },
  canada: { rate_pct: 5.00, bank: 'Bank of Canada', last_change: '2023-07-12', direction: 'hold', currency: 'CAD' },
  switzerland: { rate_pct: 1.50, bank: 'Swiss National Bank', last_change: '2024-03-21', direction: 'cut', currency: 'CHF' },
  turkey: { rate_pct: 45.00, bank: 'CBRT', last_change: '2024-01-25', direction: 'hike', currency: 'TRY' },
  argentina: { rate_pct: 80.00, bank: 'BCRA', last_change: '2024-03-11', direction: 'cut', currency: 'ARS' },
}

// ─── cron-explain helpers ───────────────────────────────────────────────────────

const CRON_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const CRON_PRESETS: Record<string, string> = {
  every_minute: '* * * * *',
  hourly: '0 * * * *',
  daily: '0 0 * * *',
  weekly: '0 0 * * 1',
  monthly: '0 0 1 * *',
  weekdays: '0 0 * * 1-5',
}

// ─── TOOL REGISTRY ─────────────────────────────────────────────────────────────

export const TOOL_REGISTRY: Record<string, ToolDefinition> = {

  // ── 1. json-tools ─────────────────────────────────────────────────────────────
  'json-tools': {
    methods: {
      validate: {
        handler: async (args) => {
          const json = requireString(args, 'json')
          try {
            const parsed = JSON.parse(json)
            return { valid: true, type: Array.isArray(parsed) ? 'array' : typeof parsed, nodes: countNodes(parsed), size: json.length }
          } catch (e) {
            return { valid: false, error: (e as Error).message, size: json.length }
          }
        },
      },
      format: {
        handler: async (args) => {
          const json = requireString(args, 'json')
          const parsed = safeParse(json, 'json')
          const formatted = JSON.stringify(parsed, null, 2)
          return { formatted, originalSize: json.length, formattedSize: formatted.length, type: Array.isArray(parsed) ? 'array' : typeof parsed }
        },
      },
      diff: {
        handler: async (args) => {
          const a = requireString(args, 'a'), b = requireString(args, 'b')
          const objA = safeParse(a, 'a'), objB = safeParse(b, 'b')
          const diffs = deepDiff(objA, objB)
          return { identical: diffs.length === 0, changeCount: diffs.length, added: diffs.filter(d => d.type === 'added').length, removed: diffs.filter(d => d.type === 'removed').length, changed: diffs.filter(d => d.type === 'changed').length, differences: diffs.slice(0, 50) }
        },
      },
    },
  },

  // ── 2. semver ─────────────────────────────────────────────────────────────────
  'semver': {
    methods: {
      parse_version: {
        handler: async (args) => {
          const version = requireString(args, 'version')
          const v = parseSemver(version)
          if (!v) throw new Error(`Invalid semver: ${version}`)
          return { raw: version, ...v, formatted: `${v.major}.${v.minor}.${v.patch}${v.prerelease.length ? '-' + v.prerelease.join('.') : ''}` }
        },
      },
      compare_versions: {
        handler: async (args) => {
          const a = requireString(args, 'a'), b = requireString(args, 'b')
          const result = compareSemver(a, b)
          return { a, b, result, description: result === 0 ? 'equal' : result > 0 ? `${a} is newer` : `${b} is newer` }
        },
      },
      sort_versions: {
        handler: async (args) => {
          const versions = args.versions
          if (!Array.isArray(versions)) throw new Error('versions array required')
          const sorted = [...(versions as string[])].sort(compareSemver)
          return { ascending: sorted, descending: [...sorted].reverse(), latest: sorted[sorted.length - 1] }
        },
      },
      bump_version: {
        handler: async (args) => {
          const version = requireString(args, 'version')
          const type = requireString(args, 'type') as 'major' | 'minor' | 'patch'
          const v = parseSemver(version)
          if (!v) throw new Error(`Invalid version: ${version}`)
          const bumped = { ...v, prerelease: [] as string[], build: [] as string[] }
          switch (type) {
            case 'major': bumped.major++; bumped.minor = 0; bumped.patch = 0; break
            case 'minor': bumped.minor++; bumped.patch = 0; break
            case 'patch': bumped.patch++; break
            default: throw new Error(`Invalid bump type: ${type}`)
          }
          const result = `${bumped.major}.${bumped.minor}.${bumped.patch}`
          return { original: version, type, bumped: result }
        },
      },
    },
  },

  // ── 3. cron-explain ───────────────────────────────────────────────────────────
  'cron-explain': {
    methods: {
      explain: {
        handler: async (args) => {
          const expression = requireString(args, 'expression')
          const parts = expression.split(/\s+/)
          if (parts.length < 5 || parts.length > 6) throw new Error('Cron must have 5 or 6 fields')
          const [min, hour, dom, month, dow] = parts
          const desc: string[] = []
          if (min === '0' && hour === '*') desc.push('At the start of every hour')
          else if (min === '0' && hour !== '*') desc.push(`At ${hour}:00`)
          else if (min === '*') desc.push('Every minute')
          else desc.push(`At minute ${min}`)
          if (hour !== '*' && !desc[0].includes(':')) desc.push(`during hour ${hour}`)
          if (dom !== '*') desc.push(`on day ${dom} of the month`)
          if (month !== '*') desc.push(`in month ${month}`)
          if (dow !== '*') desc.push(`on ${CRON_DAYS[parseInt(dow)] ?? `day ${dow}`}`)
          return { expression, fields: { minute: min, hour, day_of_month: dom, month, day_of_week: dow }, description: desc.join(' ') }
        },
      },
      build: {
        handler: async (args) => {
          const frequency = requireString(args, 'frequency')
          const min = typeof args.minute === 'number' ? args.minute : 0
          const hr = typeof args.hour === 'number' ? args.hour : 0
          const dow = typeof args.day_of_week === 'number' ? args.day_of_week : 1
          const presets: Record<string, string> = {
            every_minute: '* * * * *',
            hourly: `${min} * * * *`,
            daily: `${min} ${hr} * * *`,
            weekly: `${min} ${hr} * * ${dow}`,
            monthly: `${min} ${hr} 1 * *`,
            weekdays: `${min} ${hr} * * 1-5`,
          }
          const expr = presets[frequency]
          if (!expr) throw new Error(`Unknown frequency. Available: ${Object.keys(CRON_PRESETS).join(', ')}`)
          return { frequency, expression: expr }
        },
      },
    },
  },

  // ── 4. diff-tool ──────────────────────────────────────────────────────────────
  'diff-tool': {
    methods: {
      diff: {
        handler: async (args) => {
          const original = requireString(args, 'original')
          const modified = requireString(args, 'modified')
          if (original.length > 200_000 || modified.length > 200_000) throw new Error('Input too large (max 200,000 chars)')
          const origLines = original.split('\n'), modLines = modified.split('\n')
          if (origLines.length > 2000 || modLines.length > 2000) throw new Error('Files too large (max 2000 lines each)')
          const inLCS = computeLCS(origLines, modLines)
          const lines: DiffLine[] = []
          let oi = 0, mi = 0, lineNum = 1
          while (oi < origLines.length || mi < modLines.length) {
            if (oi < origLines.length && inLCS[0][oi]) {
              if (mi < modLines.length && inLCS[1][mi]) { lines.push({ type: 'equal', lineNumber: lineNum, content: origLines[oi] }); oi++; mi++; lineNum++ }
              else if (mi < modLines.length) { lines.push({ type: 'add', lineNumber: lineNum, content: modLines[mi] }); mi++; lineNum++ }
            } else if (oi < origLines.length) { lines.push({ type: 'remove', lineNumber: lineNum, content: origLines[oi] }); oi++; lineNum++ }
            else if (mi < modLines.length) { lines.push({ type: 'add', lineNumber: lineNum, content: modLines[mi] }); mi++; lineNum++ }
          }
          const added = lines.filter(l => l.type === 'add').length
          const removed = lines.filter(l => l.type === 'remove').length
          const unchanged = lines.filter(l => l.type === 'equal').length
          return { summary: { added, removed, unchanged, totalLines: lines.length }, identical: added === 0 && removed === 0, lines: lines.slice(0, 500) }
        },
      },
      patch: {
        handler: async (args) => {
          const original = requireString(args, 'original')
          const diffJson = requireString(args, 'diff')
          let parsed: { lines: DiffLine[] }
          try { parsed = JSON.parse(diffJson) } catch { throw new Error('diff must be valid JSON from the diff method output') }
          if (!Array.isArray(parsed.lines)) throw new Error('diff must contain a "lines" array')
          const result: string[] = []
          for (const line of parsed.lines) {
            if (line.type === 'equal' || line.type === 'add') result.push(line.content)
          }
          return { result: result.join('\n'), linesApplied: parsed.lines.length, originalLines: original.split('\n').length, resultLines: result.length }
        },
      },
    },
  },

  // ── 5. wikipedia ──────────────────────────────────────────────────────────────
  'wikipedia': {
    methods: {
      get_summary: {
        handler: async (args) => {
          const title = requireString(args, 'title')
          const lang = typeof args.lang === 'string' ? args.lang.trim().toLowerCase() : 'en'
          const encoded = encodeURIComponent(title.replace(/ /g, '_'))
          const data = await fetchJSON<Record<string, unknown>>(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encoded}`)
          const urls = data.content_urls as Record<string, Record<string, string>> | undefined
          const thumb = data.thumbnail as Record<string, unknown> | undefined
          return { title: data.title, description: data.description ?? null, extract: data.extract, url: urls?.desktop?.page ?? null, thumbnail: thumb ? { url: thumb.source, width: thumb.width, height: thumb.height } : null, lastModified: data.timestamp, language: lang }
        },
      },
      search: {
        handler: async (args) => {
          const query = requireString(args, 'query')
          const lang = typeof args.lang === 'string' ? args.lang.trim().toLowerCase() : 'en'
          const limit = Math.min(Math.max(typeof args.limit === 'number' ? args.limit : 10, 1), 50)
          const data = await fetchJSON<Record<string, unknown>>(`https://${lang}.wikipedia.org/w/api.php?format=json&origin=*&action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${limit}&srprop=snippet|size|wordcount|timestamp`)
          const q = data.query as Record<string, unknown> | undefined
          const results = ((q?.search as Array<Record<string, unknown>>) ?? []).map(r => ({
            title: r.title, pageId: r.pageid, snippet: (r.snippet as string || '').replace(/<\/?span[^>]*>/g, ''), wordCount: r.wordcount, lastModified: r.timestamp, url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(String(r.title).replace(/ /g, '_'))}`,
          }))
          return { query, language: lang, totalHits: (q?.searchinfo as Record<string, unknown>)?.totalhits ?? 0, results }
        },
      },
      get_random: {
        handler: async (args) => {
          const lang = typeof args.lang === 'string' ? args.lang.trim().toLowerCase() : 'en'
          const data = await fetchJSON<Record<string, unknown>>(`https://${lang}.wikipedia.org/api/rest_v1/page/random/summary`)
          const urls = data.content_urls as Record<string, Record<string, string>> | undefined
          const thumb = data.thumbnail as Record<string, unknown> | undefined
          return { title: data.title, description: data.description ?? null, extract: data.extract, url: urls?.desktop?.page ?? null, thumbnail: thumb ? { url: thumb.source, width: thumb.width, height: thumb.height } : null, lastModified: data.timestamp, language: lang }
        },
      },
    },
  },

  // ── 6. hacker-news ────────────────────────────────────────────────────────────
  'hacker-news': {
    methods: {
      get_top_stories: {
        handler: async () => {
          const data = await fetchJSON<number[]>('https://hacker-news.firebaseio.com/v0/topstories.json')
          return { count: Math.min(data.length, 30), results: data.slice(0, 30) }
        },
      },
      get_item: {
        handler: async (args) => {
          const id = typeof args.id === 'number' ? args.id : parseInt(String(args.id))
          if (isNaN(id)) throw new Error('id must be a number')
          return fetchJSON(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
        },
      },
      get_user: {
        handler: async (args) => {
          const username = requireString(args, 'username')
          return fetchJSON(`https://hacker-news.firebaseio.com/v0/user/${encodeURIComponent(username)}.json`)
        },
      },
    },
  },

  // ── 7. rest-countries ─────────────────────────────────────────────────────────
  'rest-countries': {
    methods: {
      get_all: {
        handler: async (args) => {
          const fields = typeof args.fields === 'string' ? `?fields=${args.fields}` : ''
          const data = await fetchJSON<unknown[]>(`https://restcountries.com/v3.1/all${fields}`)
          const items = data.slice(0, 50)
          return { count: items.length, results: items }
        },
      },
      get_by_name: {
        handler: async (args) => {
          const name = requireString(args, 'name')
          const data = await fetchJSON<unknown[]>(`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}`)
          const items = data.slice(0, 5)
          return { name, count: items.length, results: items }
        },
      },
    },
  },

  // ── 8. random-user ────────────────────────────────────────────────────────────
  'random-user': {
    methods: {
      generate_users: {
        handler: async (args) => {
          const count = typeof args.count === 'number' ? Math.min(Math.max(args.count, 1), 20) : 5
          const nat = typeof args.nationality === 'string' ? args.nationality.trim() : ''
          const data = await fetchJSON<Record<string, unknown>>(`https://randomuser.me/api/?results=${count}&nat=${encodeURIComponent(nat)}&noinfo`)
          const items = ((data.results as Array<Record<string, unknown>>) ?? []).slice(0, 20)
          return { count: items.length, results: items.map(item => ({ name: item.name, email: item.email, location: item.location, phone: item.phone, picture: item.picture })) }
        },
      },
      generate_user: {
        handler: async (args) => {
          const nat = typeof args.nationality === 'string' ? args.nationality.trim() : ''
          const data = await fetchJSON<Record<string, unknown>>(`https://randomuser.me/api/?results=1&nat=${encodeURIComponent(nat)}&noinfo`)
          const items = ((data.results as Array<Record<string, unknown>>) ?? []).slice(0, 1)
          return { count: items.length, results: items.map(item => ({ name: item.name, email: item.email, location: item.location, phone: item.phone, login: item.login, dob: item.dob, picture: item.picture })) }
        },
      },
    },
  },

  // ── 9. forex-rates ────────────────────────────────────────────────────────────
  'forex-rates': {
    methods: {
      get_rates: {
        handler: async (args) => {
          const params = new URLSearchParams()
          if (typeof args.base === 'string') params.set('from', args.base.trim().toUpperCase())
          if (typeof args.symbols === 'string') params.set('to', args.symbols.split(',').map(s => s.trim().toUpperCase()).join(','))
          const qs = params.toString()
          return fetchJSON(`https://api.frankfurter.app/latest${qs ? '?' + qs : ''}`)
        },
      },
      convert: {
        handler: async (args) => {
          const from = requireString(args, 'from').toUpperCase()
          const to = requireString(args, 'to').toUpperCase()
          const amount = typeof args.amount === 'number' ? args.amount : parseFloat(String(args.amount))
          if (isNaN(amount) || amount <= 0) throw new Error('amount must be a positive number')
          const data = await fetchJSON<Record<string, unknown>>(`https://api.frankfurter.app/latest?from=${from}&to=${to}`)
          const rates = data.rates as Record<string, number>
          const rate = rates[to]
          if (!rate) throw new Error(`No rate found for ${to}`)
          return { from, to, amount, result: Math.round(amount * rate * 100) / 100, rate, date: data.date }
        },
      },
      get_historical: {
        handler: async (args) => {
          const date = requireString(args, 'date')
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date must be YYYY-MM-DD')
          const base = typeof args.base === 'string' ? `?from=${args.base.trim().toUpperCase()}` : ''
          return fetchJSON(`https://api.frankfurter.app/${date}${base}`)
        },
      },
    },
  },

  // ── 10. coinpaprika ───────────────────────────────────────────────────────────
  'coinpaprika': {
    methods: {
      list_coins: {
        handler: async () => {
          const data = await fetchJSON<Array<Record<string, unknown>>>('https://api.coinpaprika.com/v1/coins')
          const items = data.slice(0, 50)
          return { count: items.length, results: items.map(c => ({ id: c.id, name: c.name, symbol: c.symbol, rank: c.rank, is_active: c.is_active, type: c.type })) }
        },
      },
      get_ticker: {
        handler: async (args) => {
          const coinId = requireString(args, 'coin_id')
          const data = await fetchJSON<Record<string, unknown>>(`https://api.coinpaprika.com/v1/tickers/${encodeURIComponent(coinId)}`)
          return { id: data.id, name: data.name, symbol: data.symbol, rank: data.rank, quotes: data.quotes }
        },
      },
      search_coins: {
        handler: async (args) => {
          const query = requireString(args, 'query')
          const data = await fetchJSON<Record<string, unknown>>(`https://api.coinpaprika.com/v1/search?q=${encodeURIComponent(query)}&c=currencies&limit=10`)
          const items = ((data.currencies as Array<Record<string, unknown>>) ?? []).slice(0, 10)
          return { count: items.length, results: items.map(c => ({ id: c.id, name: c.name, symbol: c.symbol, rank: c.rank })) }
        },
      },
    },
  },

  // ── 11. central-bank-rates ────────────────────────────────────────────────────
  'central-bank-rates': {
    methods: {
      get_rate: {
        handler: async (args) => {
          const country = requireString(args, 'country').toLowerCase()
          const rate = CENTRAL_BANK_RATES[country]
          if (!rate) throw new Error(`Unknown country. Available: ${Object.keys(CENTRAL_BANK_RATES).join(', ')}`)
          return { country, ...rate }
        },
      },
      get_all_rates: {
        handler: async () => {
          return { count: Object.keys(CENTRAL_BANK_RATES).length, rates: Object.entries(CENTRAL_BANK_RATES).map(([k, v]) => ({ country: k, ...v })) }
        },
      },
    },
  },

  // ── 12. mdn-search ────────────────────────────────────────────────────────────
  'mdn-search': {
    methods: {
      search_docs: {
        handler: async (args) => {
          const query = requireString(args, 'query')
          const data = await fetchJSON<Record<string, unknown>>(`https://developer.mozilla.org/api/v1/search?q=${encodeURIComponent(query)}&locale=en-US`)
          const items = ((data.documents as Array<Record<string, unknown>>) ?? []).slice(0, 10)
          return { count: items.length, results: items.map(d => ({ title: d.title, slug: d.slug, summary: d.summary, mdn_url: d.mdn_url })) }
        },
      },
      get_document: {
        handler: async (args) => {
          const slug = requireString(args, 'slug')
          const data = await fetchJSON<Record<string, unknown>>(`https://developer.mozilla.org/api/v1/doc/en-US/${encodeURIComponent(slug)}`)
          return { title: data.title, summary: data.summary, mdn_url: data.mdn_url, modified: data.modified }
        },
      },
    },
  },

  // ── 13. open-food-facts ───────────────────────────────────────────────────────
  'open-food-facts': {
    methods: {
      search_products: {
        handler: async (args) => {
          const query = requireString(args, 'query')
          const data = await fetchJSON<Record<string, unknown>>(`https://world.openfoodfacts.org/api/v2/search?search_terms=${encodeURIComponent(query)}&page_size=10&json=true`)
          const items = ((data.products as Array<Record<string, unknown>>) ?? []).slice(0, 10)
          return { count: items.length, results: items.map(p => ({ code: p.code, product_name: p.product_name, brands: p.brands, nutriscore_grade: p.nutriscore_grade, nutriments: p.nutriments })) }
        },
      },
      get_product: {
        handler: async (args) => {
          const barcode = requireString(args, 'barcode')
          const data = await fetchJSON<Record<string, unknown>>(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`)
          const p = (data.product as Record<string, unknown>) ?? data
          return { code: p.code ?? data.code, product_name: p.product_name, brands: p.brands, ingredients_text: p.ingredients_text, nutriments: p.nutriments, allergens: p.allergens }
        },
      },
    },
  },

  // ── 14. wayback-machine ───────────────────────────────────────────────────────
  'wayback-machine': {
    methods: {
      check_url: {
        handler: async (args) => {
          const url = requireString(args, 'url')
          return fetchJSON(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`)
        },
      },
      get_snapshot: {
        handler: async (args) => {
          const url = requireString(args, 'url')
          const timestamp = typeof args.timestamp === 'string' ? args.timestamp.trim() : ''
          return fetchJSON(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}&timestamp=${encodeURIComponent(timestamp)}`)
        },
      },
    },
  },

  // ── 15. security-headers ──────────────────────────────────────────────────────
  'security-headers': {
    methods: {
      scan_headers: {
        handler: async (args) => {
          const url = requireString(args, 'url')
          // Directly fetch the URL and inspect headers (more reliable than securityheaders.com API)
          const SECURITY_HEADERS = [
            'strict-transport-security', 'content-security-policy', 'x-content-type-options',
            'x-frame-options', 'x-xss-protection', 'referrer-policy', 'permissions-policy',
          ]
          try {
            const res = await fetch(url, { method: 'HEAD', redirect: 'follow' })
            const found: Record<string, string> = {}
            const missing: string[] = []
            for (const h of SECURITY_HEADERS) {
              const val = res.headers.get(h)
              if (val) found[h] = val
              else missing.push(h)
            }
            const score = Math.round((Object.keys(found).length / SECURITY_HEADERS.length) * 100)
            return { url, score, headers: found, missing, totalChecked: SECURITY_HEADERS.length }
          } catch (e) {
            throw new Error(`Could not fetch ${url}: ${(e as Error).message}`)
          }
        },
      },
      check_csp: {
        handler: async (args) => {
          const url = requireString(args, 'url')
          try {
            const res = await fetch(url, { method: 'HEAD', redirect: 'follow' })
            const csp = res.headers.get('content-security-policy')
            const cspReport = res.headers.get('content-security-policy-report-only')
            return { url, hasCSP: !!csp, csp: csp ?? null, cspReportOnly: cspReport ?? null, directives: csp ? Object.fromEntries(csp.split(';').map(d => d.trim()).filter(Boolean).map(d => { const [key, ...vals] = d.split(/\s+/); return [key, vals.join(' ')] })) : null }
          } catch (e) {
            throw new Error(`Could not fetch ${url}: ${(e as Error).message}`)
          }
        },
      },
    },
  },

  // ── 16. ssl-labs ──────────────────────────────────────────────────────────────
  'ssl-labs': {
    methods: {
      analyze_host: {
        handler: async (args) => {
          const host = requireString(args, 'host')
          return fetchJSON(`https://api.ssllabs.com/api/v3/analyze?host=${encodeURIComponent(host)}&all=done`)
        },
      },
      get_endpoint: {
        handler: async (args) => {
          const host = requireString(args, 'host')
          const ip = requireString(args, 'ip')
          return fetchJSON(`https://api.ssllabs.com/api/v3/getEndpointData?host=${encodeURIComponent(host)}&s=${encodeURIComponent(ip)}`)
        },
      },
    },
  },

  // ── 17. whois ─────────────────────────────────────────────────────────────────
  'whois': {
    methods: {
      lookup_domain: {
        handler: async (args) => {
          const domain = requireString(args, 'domain')
          return fetchJSON(`https://whoisjs.com/api/v1/${encodeURIComponent(domain)}`)
        },
      },
      check_availability: {
        handler: async (args) => {
          const domain = requireString(args, 'domain')
          const data = await fetchJSON<Record<string, unknown>>(`https://whoisjs.com/api/v1/${encodeURIComponent(domain)}`)
          return { name: data.name, registrar: data.registrar, status: data.status }
        },
      },
    },
  },

  // ── 18. iss-tracker ───────────────────────────────────────────────────────────
  'iss-tracker': {
    methods: {
      get_position: {
        handler: async () => {
          const data = await fetchJSON<Record<string, unknown>>('http://api.open-notify.org/iss-now.json')
          const pos = data.iss_position as Record<string, string>
          return { latitude: parseFloat(pos.latitude), longitude: parseFloat(pos.longitude), timestamp: new Date((data.timestamp as number) * 1000).toISOString(), unix_timestamp: data.timestamp }
        },
      },
      get_crew: {
        handler: async () => {
          const data = await fetchJSON<Record<string, unknown>>('http://api.open-notify.org/astros.json')
          return { total: data.number, people: data.people }
        },
      },
    },
  },

  // ── 19. solar-system ──────────────────────────────────────────────────────────
  'solar-system': {
    methods: {
      list_bodies: {
        handler: async (args) => {
          const params = new URLSearchParams()
          if (typeof args.filter === 'string') params.set('filter[]', `bodyType,eq,${args.filter}`)
          const qs = params.toString()
          return fetchJSON(`https://api.le-systeme-solaire.net/rest/bodies${qs ? '?' + qs : ''}`)
        },
      },
      get_body: {
        handler: async (args) => {
          const id = requireString(args, 'id')
          return fetchJSON(`https://api.le-systeme-solaire.net/rest/bodies/${encodeURIComponent(id)}`)
        },
      },
      get_planets: {
        handler: async () => {
          return fetchJSON('https://api.le-systeme-solaire.net/rest/bodies?filter[]=isPlanet,eq,true')
        },
      },
    },
  },

  // ── 20. openaq ────────────────────────────────────────────────────────────────
  'openaq': {
    methods: {
      get_latest: {
        handler: async (args) => {
          const city = typeof args.city === 'string' ? args.city.trim() : ''
          const country = typeof args.country === 'string' ? args.country.trim() : ''
          const data = await fetchJSON<Record<string, unknown>>(`https://api.openaq.org/v2/latest?limit=10&city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`)
          const items = ((data.results as Array<Record<string, unknown>>) ?? []).slice(0, 10)
          return { count: items.length, results: items.map(r => ({ location: r.location, city: r.city, country: r.country, measurements: r.measurements })) }
        },
      },
      get_locations: {
        handler: async (args) => {
          const city = typeof args.city === 'string' ? args.city.trim() : ''
          const country = typeof args.country === 'string' ? args.country.trim() : ''
          const data = await fetchJSON<Record<string, unknown>>(`https://api.openaq.org/v2/locations?limit=10&city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`)
          const items = ((data.results as Array<Record<string, unknown>>) ?? []).slice(0, 10)
          return { count: items.length, results: items.map(r => ({ id: r.id, name: r.name, city: r.city, country: r.country, parameters: r.parameters })) }
        },
      },
      get_measurements: {
        handler: async (args) => {
          const locationId = typeof args.location_id === 'number' ? args.location_id : parseInt(String(args.location_id))
          if (isNaN(locationId)) throw new Error('location_id is required and must be a number')
          const data = await fetchJSON<Record<string, unknown>>(`https://api.openaq.org/v2/measurements?location_id=${locationId}&limit=20`)
          const items = ((data.results as Array<Record<string, unknown>>) ?? []).slice(0, 20)
          return { count: items.length, results: items.map(r => ({ parameter: r.parameter, value: r.value, unit: r.unit, date: r.date })) }
        },
      },
    },
  },

  // ── 21. encoding ──────────────────────────────────────────────────────────────
  'encoding': {
    methods: {
      encode_base64: {
        handler: async (args) => {
          const text = requireString(args, 'text')
          const encoded = Buffer.from(text, 'utf-8').toString('base64')
          return { original: text, encoded, urlSafe: encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''), bytes: Buffer.byteLength(text, 'utf-8') }
        },
      },
      decode_base64: {
        handler: async (args) => {
          const encoded = requireString(args, 'encoded')
          const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/')
          const decoded = Buffer.from(normalized, 'base64').toString('utf-8')
          return { encoded, decoded, bytes: Buffer.byteLength(decoded, 'utf-8') }
        },
      },
      encode_url: {
        handler: async (args) => {
          const text = requireString(args, 'text')
          return { original: text, encoded: encodeURIComponent(text), encodedFull: encodeURI(text) }
        },
      },
      decode_url: {
        handler: async (args) => {
          const encoded = requireString(args, 'encoded')
          return { encoded, decoded: decodeURIComponent(encoded) }
        },
      },
      encode_html: {
        handler: async (args) => {
          const text = requireString(args, 'text')
          const encoded = text.replace(/[&<>"']/g, ch => HTML_ENTITIES[ch] || ch)
          return { original: text, encoded }
        },
      },
      decode_html: {
        handler: async (args) => {
          const encoded = requireString(args, 'encoded')
          const decoded = encoded.replace(/&\w+;/g, ent => HTML_REVERSE[ent] || ent)
          return { encoded, decoded }
        },
      },
      encode_hex: {
        handler: async (args) => {
          const text = requireString(args, 'text')
          const hex = Buffer.from(text, 'utf-8').toString('hex')
          return { original: text, hex, bytes: hex.length / 2 }
        },
      },
      detect_encoding: {
        handler: async (args) => {
          const s = typeof args.sample === 'string' ? args.sample : ''
          const hasUtf8 = /[\u0080-\uffff]/.test(s)
          const hasBom = s.startsWith('\ufeff')
          const isAscii = /^[\x00-\x7f]*$/.test(s)
          return { likely: hasBom ? 'UTF-8 with BOM' : isAscii ? 'ASCII' : hasUtf8 ? 'UTF-8' : 'ASCII', isAscii, hasUnicode: hasUtf8, hasBom, byteLength: Buffer.byteLength(s, 'utf-8'), charLength: s.length }
        },
      },
    },
  },

  // ── 22. ip-range ──────────────────────────────────────────────────────────────
  'ip-range': {
    methods: {
      parse_cidr: {
        handler: async (args) => {
          const cidr = requireString(args, 'cidr')
          const { ip, prefix, networkInt, broadcastInt, mask } = parseCidrNotation(cidr)
          const hostCount = broadcastInt - networkInt - 1
          return { cidr, network: intToIp(networkInt), broadcast: intToIp(broadcastInt), netmask: intToIp(mask), wildcardMask: intToIp((~mask) >>> 0), firstHost: prefix >= 31 ? intToIp(networkInt) : intToIp(networkInt + 1), lastHost: prefix >= 31 ? intToIp(broadcastInt) : intToIp(broadcastInt - 1), hostCount: Math.max(0, hostCount), totalAddresses: broadcastInt - networkInt + 1, prefix, ...isPrivateIp(ip) }
        },
      },
      ip_in_range: {
        handler: async (args) => {
          const ip = requireString(args, 'ip')
          const cidr = requireString(args, 'cidr')
          const ipInt = ipToInt(ip)
          const { networkInt, broadcastInt } = parseCidrNotation(cidr)
          return { ip, cidr, inRange: ipInt >= networkInt && ipInt <= broadcastInt }
        },
      },
      subnet_info: {
        handler: async (args) => {
          const ip = requireString(args, 'ip')
          const mask = typeof args.mask === 'number' ? args.mask : parseInt(String(args.mask))
          if (isNaN(mask)) throw new Error('mask is required')
          const cidr = `${ip}/${mask}`
          const { prefix, networkInt, broadcastInt, mask: m } = parseCidrNotation(cidr)
          const hostCount = broadcastInt - networkInt - 1
          return { cidr, network: intToIp(networkInt), broadcast: intToIp(broadcastInt), netmask: intToIp(m), firstHost: prefix >= 31 ? intToIp(networkInt) : intToIp(networkInt + 1), lastHost: prefix >= 31 ? intToIp(broadcastInt) : intToIp(broadcastInt - 1), hostCount: Math.max(0, hostCount), totalAddresses: broadcastInt - networkInt + 1, prefix, ...isPrivateIp(ip) }
        },
      },
      ip_to_int: {
        handler: async (args) => {
          const ip = requireString(args, 'ip')
          const int = ipToInt(ip)
          return { ip, integer: int, hex: '0x' + int.toString(16).padStart(8, '0'), binary: int.toString(2).padStart(32, '0'), ...isPrivateIp(ip) }
        },
      },
      int_to_ip: {
        handler: async (args) => {
          const int = typeof args.int === 'number' ? args.int : parseInt(String(args.int))
          if (isNaN(int)) throw new Error('int is required')
          const ip = intToIp(int >>> 0)
          return { integer: int, ip, ...isPrivateIp(ip) }
        },
      },
    },
  },

  // ── 23. dad-jokes ─────────────────────────────────────────────────────────────
  'dad-jokes': {
    methods: {
      get_random: {
        handler: async () => {
          const data = await fetchJSON<Record<string, unknown>>('https://icanhazdadjoke.com/')
          return { id: data.id, joke: data.joke, status: data.status }
        },
      },
      search_jokes: {
        handler: async (args) => {
          const term = requireString(args, 'term')
          const data = await fetchJSON<Record<string, unknown>>(`https://icanhazdadjoke.com/search?term=${encodeURIComponent(term)}&limit=10`)
          const items = ((data.results as Array<Record<string, unknown>>) ?? []).slice(0, 10)
          return { count: items.length, results: items.map(j => ({ id: j.id, joke: j.joke })) }
        },
      },
    },
  },

  // ── 24. spacex ────────────────────────────────────────────────────────────────
  'spacex': {
    methods: {
      get_latest_launch: {
        handler: async () => {
          const l = await fetchJSON<Record<string, unknown>>('https://api.spacexdata.com/v4/launches/latest')
          return { id: l.id, name: l.name, dateUtc: l.date_utc, success: l.success, details: ((l.details as string) ?? '').slice(0, 500) || null, rocket: l.rocket, flightNumber: l.flight_number, upcoming: l.upcoming, links: { webcast: (l.links as Record<string, unknown>)?.webcast, wikipedia: (l.links as Record<string, unknown>)?.wikipedia, article: (l.links as Record<string, unknown>)?.article } }
        },
      },
      get_upcoming_launches: {
        handler: async (args) => {
          const data = await fetchJSON<Array<Record<string, unknown>>>('https://api.spacexdata.com/v4/launches/upcoming')
          const limit = Math.min(Math.max(typeof args.limit === 'number' ? args.limit : 5, 1), 10)
          const launches = data.slice(0, limit).map(l => ({ id: l.id, name: l.name, dateUtc: l.date_utc, details: ((l.details as string) ?? '').slice(0, 500) || null, rocket: l.rocket, flightNumber: l.flight_number }))
          return { count: launches.length, launches }
        },
      },
      get_rockets: {
        handler: async () => {
          const data = await fetchJSON<Array<Record<string, unknown>>>('https://api.spacexdata.com/v4/rockets')
          return { count: data.length, rockets: data.map(r => ({ id: r.id, name: r.name, type: r.type, active: r.active, stages: r.stages, costPerLaunch: r.cost_per_launch, successRate: r.success_rate_pct, firstFlight: r.first_flight, description: ((r.description as string) ?? '').slice(0, 300) })) }
        },
      },
    },
  },
}

/** Returns the list of all registered tool slugs. */
export function getRegisteredSlugs(): string[] {
  return Object.keys(TOOL_REGISTRY)
}
