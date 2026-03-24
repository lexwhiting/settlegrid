/**
 * settlegrid-uk-legislation — UK Legislation MCP Server
 * Wraps legislation.gov.uk with SettleGrid billing.
 *
 * Search and retrieve UK Acts of Parliament, statutory
 * instruments, and other legislation.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface UKLegislation {
  title: string
  type: string
  year: number
  number: number
  url: string
  enacted_date: string
}

interface UKLegislationDetail {
  title: string
  type: string
  year: number
  number: number
  url: string
  enacted_date: string
  body: string
  sections: { number: string; title: string }[]
}

interface UKSearchResult {
  query: string
  total: number
  results: UKLegislation[]
}

interface FeedEntry {
  title: string
  id: string
  updated: string
  link: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://www.legislation.gov.uk'

const VALID_TYPES = ['ukpga', 'uksi', 'asp', 'nisi', 'nia', 'asc', 'anaw', 'ukla', 'ukmo']

function validateType(type: string): string {
  const lower = type.trim().toLowerCase()
  if (!VALID_TYPES.includes(lower)) {
    throw new Error(`Invalid legislation type: ${type}. Valid: ${VALID_TYPES.join(', ')}`)
  }
  return lower
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`UK Legislation API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function clampLimit(limit?: number): number {
  if (limit === undefined) return 20
  return Math.max(1, Math.min(100, limit))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({
  toolSlug: 'uk-legislation',
  pricing: { defaultCostCents: 1, methods: { search_legislation: 1, get_act: 1, get_recent: 1 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchLegislation = sg.wrap(async (args: { query: string; type?: string; limit?: number }) => {
  const q = args.query.trim()
  if (!q) throw new Error('Query must not be empty')
  const lim = clampLimit(args.limit)
  const params = new URLSearchParams({ text: q, 'results-count': String(lim) })
  if (args.type) params.set('type', validateType(args.type))
  const url = `${API_BASE}/search/data.json?${params}`
  try {
    const data = await apiFetch<any>(url)
    const entries = data?.searchResults?.results || data?.results || []
    const results = (Array.isArray(entries) ? entries : []).slice(0, lim).map((e: any) => ({
      title: e.title || '', type: e.type || '', year: e.year || 0,
      number: e.number || 0, url: e.uri || e.url || '', enacted_date: e.enacted || '',
    }))
    return { query: q, total: results.length, results }
  } catch {
    return { query: q, total: 0, results: [] } as UKSearchResult
  }
}, { method: 'search_legislation' })

const getAct = sg.wrap(async (args: { type: string; year: number; number: number }) => {
  const t = validateType(args.type)
  if (!args.year || args.year < 1200 || args.year > 2100) throw new Error('Invalid year')
  if (!args.number || args.number < 1) throw new Error('Invalid act number')
  const url = `${API_BASE}/${t}/${args.year}/${args.number}/data.json`
  try {
    const data = await apiFetch<any>(url)
    return {
      title: data?.title || '',
      type: t,
      year: args.year,
      number: args.number,
      url: `${API_BASE}/${t}/${args.year}/${args.number}`,
      enacted_date: data?.enacted || '',
      body: JSON.stringify(data).slice(0, 5000),
      sections: [],
    } as UKLegislationDetail
  } catch (err) {
    throw new Error(`Failed to fetch ${t}/${args.year}/${args.number}: ${err}`)
  }
}, { method: 'get_act' })

const getRecent = sg.wrap(async (args: { type?: string }) => {
  const t = args.type ? validateType(args.type) : 'ukpga'
  const url = `${API_BASE}/new/${t}/data.json`
  try {
    const data = await apiFetch<any>(url)
    const entries = data?.entries || data?.results || []
    const results = (Array.isArray(entries) ? entries : []).slice(0, 20).map((e: any) => ({
      title: e.title || '', type: t, year: e.year || 0,
      number: e.number || 0, url: e.uri || '', enacted_date: e.updated || '',
    }))
    return { query: '', total: results.length, results }
  } catch {
    return { query: '', total: 0, results: [] } as UKSearchResult
  }
}, { method: 'get_recent' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchLegislation, getAct, getRecent }
export type { UKLegislation, UKLegislationDetail, UKSearchResult }
console.log('settlegrid-uk-legislation MCP server ready')
