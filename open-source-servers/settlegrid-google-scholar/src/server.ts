/**
 * settlegrid-google-scholar — Google Scholar Search MCP Server
 * Wraps Semantic Scholar API with SettleGrid billing.
 *
 * Provides academic paper search, metadata retrieval, and citation
 * lookup via the free Semantic Scholar Graph API.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Paper {
  paperId: string
  title: string
  abstract: string | null
  year: number | null
  citationCount: number
  authors: { authorId: string; name: string }[]
  url: string
  venue: string | null
  externalIds: Record<string, string>
}

interface SearchResult {
  total: number
  offset: number
  data: Paper[]
}

interface Citation {
  citingPaper: Paper
}

interface CitationsResult {
  offset: number
  data: Citation[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.semanticscholar.org/graph/v1'
const FIELDS = 'paperId,title,abstract,year,citationCount,authors,url,venue,externalIds'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
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
const sg = settlegrid.init({ toolSlug: 'google-scholar' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchPapers(query: string, limit?: number): Promise<SearchResult> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  const l = clamp(limit, 1, 100, 10)
  return sg.wrap('search_papers', async () => {
    return apiFetch<SearchResult>(`/paper/search?query=${q}&limit=${l}&fields=${FIELDS}`)
  })
}

async function getPaper(paperId: string): Promise<Paper> {
  if (!paperId || typeof paperId !== 'string') throw new Error('paperId is required')
  const id = encodeURIComponent(paperId.trim())
  return sg.wrap('get_paper', async () => {
    return apiFetch<Paper>(`/paper/${id}?fields=${FIELDS}`)
  })
}

async function getCitations(paperId: string, limit?: number): Promise<CitationsResult> {
  if (!paperId || typeof paperId !== 'string') throw new Error('paperId is required')
  const id = encodeURIComponent(paperId.trim())
  const l = clamp(limit, 1, 1000, 20)
  return sg.wrap('get_citations', async () => {
    return apiFetch<CitationsResult>(
      `/paper/${id}/citations?limit=${l}&fields=${FIELDS}`
    )
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchPapers, getPaper, getCitations }
export type { Paper, SearchResult, Citation, CitationsResult }
console.log('settlegrid-google-scholar server started')
