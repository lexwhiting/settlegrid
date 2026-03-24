/**
 * settlegrid-courtlistener — US Court Opinions MCP Server
 * Wraps CourtListener API with SettleGrid billing.
 *
 * Provides access to US court opinions, case law, and judge
 * information via the CourtListener REST API (v4).
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Opinion {
  id: number
  absolute_url: string
  cluster: string
  author_str: string
  type: string
  date_created: string
  snippet: string
  court: string
  case_name: string
}

interface OpinionDetail {
  id: number
  absolute_url: string
  cluster: string
  author_str: string
  type: string
  html_with_citations: string
  plain_text: string
  date_created: string
}

interface Judge {
  id: number
  name_first: string
  name_last: string
  name_full: string
  date_dob: string | null
  political_affiliation: string | null
  court: string
  position_type: string | null
}

interface SearchResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://www.courtlistener.com/api/rest/v4'
const API_KEY = process.env.COURTLISTENER_API_KEY || ''

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (API_KEY) h['Authorization'] = `Token ${API_KEY}`
  return h
}

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, { headers: getHeaders() })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`CourtListener API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function validateQuery(q: string): string {
  const trimmed = q.trim()
  if (!trimmed) throw new Error('Query must not be empty')
  if (trimmed.length > 500) throw new Error('Query too long (max 500 characters)')
  return trimmed
}

function clampLimit(limit?: number): number {
  if (limit === undefined) return 20
  return Math.max(1, Math.min(100, limit))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({
  toolSlug: 'courtlistener',
  pricing: { defaultCostCents: 2, methods: { search_opinions: 2, get_opinion: 2, search_judges: 2 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchOpinions = sg.wrap(async (args: { query: string; court?: string; limit?: number }) => {
  const q = validateQuery(args.query)
  const lim = clampLimit(args.limit)
  const params = new URLSearchParams({ q, page_size: String(lim) })
  if (args.court) params.set('court', args.court.trim())
  return apiFetch<SearchResponse<Opinion>>(`/search/?${params}`)
}, { method: 'search_opinions' })

const getOpinion = sg.wrap(async (args: { id: string }) => {
  if (!args.id) throw new Error('Opinion ID is required')
  return apiFetch<OpinionDetail>(`/opinions/${encodeURIComponent(args.id)}/`)
}, { method: 'get_opinion' })

const searchJudges = sg.wrap(async (args: { query: string }) => {
  const q = validateQuery(args.query)
  const params = new URLSearchParams({ q })
  return apiFetch<SearchResponse<Judge>>(`/people/?${params}`)
}, { method: 'search_judges' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchOpinions, getOpinion, searchJudges }
export type { Opinion, OpinionDetail, Judge, SearchResponse }
console.log('settlegrid-courtlistener MCP server ready')
