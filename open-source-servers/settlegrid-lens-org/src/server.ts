/**
 * settlegrid-lens-org — Lens.org Patent & Scholarly Search MCP Server
 * Wraps Lens.org API with SettleGrid billing.
 *
 * Lens.org provides free, open access to patent and scholarly search,
 * linking 240M+ patents and scholarly works for integrated discovery.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface LensScholarlyRecord {
  lens_id: string
  title: string
  date_published: string | null
  year_published: number | null
  abstract: string | null
  source: { title: string; type: string } | null
  authors: { display_name: string; affiliations: { name: string }[] }[]
  external_ids: { type: string; value: string }[]
  scholarly_citations_count: number
  open_access: { licence: string; colour: string } | null
}

interface LensPatentRecord {
  lens_id: string
  title: string
  date_published: string | null
  abstract: string | null
  applicants: { name: string }[]
  inventors: { name: string }[]
  jurisdiction: string
  document_type: string
  classifications: { symbol: string }[]
}

interface LensSearchResult<T> {
  total: number
  data: T[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.lens.org'
const API_KEY = process.env.LENS_API_KEY || ''

async function apiPost<T>(path: string, body: object): Promise<T> {
  if (!API_KEY) throw new Error('LENS_API_KEY environment variable is required')
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

async function apiFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('LENS_API_KEY environment variable is required')
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Accept': 'application/json',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function clamp(val: number | undefined, min: number, max: number, def: number): number {
  if (val === undefined || val === null) return def
  return Math.max(min, Math.min(max, Math.floor(val)))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'lens-org' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchScholarly(query: string, limit?: number): Promise<LensSearchResult<LensScholarlyRecord>> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const l = clamp(limit, 1, 50, 10)
  return sg.wrap('search_scholarly', async () => {
    return apiPost<LensSearchResult<LensScholarlyRecord>>('/scholarly/search', {
      query: { match: { title: query.trim() } },
      size: l,
      sort: [{ relevance: 'desc' }],
    })
  })
}

async function searchPatents(query: string, limit?: number): Promise<LensSearchResult<LensPatentRecord>> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const l = clamp(limit, 1, 50, 10)
  return sg.wrap('search_patents', async () => {
    return apiPost<LensSearchResult<LensPatentRecord>>('/patent/search', {
      query: { match: { title: query.trim() } },
      size: l,
      sort: [{ relevance: 'desc' }],
    })
  })
}

async function getRecord(id: string): Promise<LensScholarlyRecord> {
  if (!id || typeof id !== 'string') throw new Error('id is required')
  return sg.wrap('get_record', async () => {
    const result = await apiPost<LensSearchResult<LensScholarlyRecord>>('/scholarly/search', {
      query: { match: { lens_id: id.trim() } },
      size: 1,
    })
    if (!result.data?.length) throw new Error(`No record found with Lens ID: ${id}`)
    return result.data[0]
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchScholarly, searchPatents, getRecord }
export type { LensScholarlyRecord, LensPatentRecord, LensSearchResult }
console.log('settlegrid-lens-org server started')
