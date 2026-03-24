/**
 * settlegrid-ssrn — SSRN Social Science Papers MCP Server
 * Wraps Semantic Scholar API with SettleGrid billing.
 *
 * Provides access to social science research through Semantic Scholar,
 * including SSRN papers, economics, law, and management research.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface SsrnPaper {
  paperId: string
  title: string
  abstract: string | null
  year: number | null
  citationCount: number
  authors: { authorId: string; name: string }[]
  url: string
  venue: string | null
  fieldsOfStudy: string[] | null
  externalIds: Record<string, string>
}

interface SsrnSearchResult {
  total: number
  offset: number
  data: SsrnPaper[]
}

interface SsrnAuthor {
  authorId: string
  name: string
  affiliations: string[]
  paperCount: number
  citationCount: number
  hIndex: number
  papers: SsrnPaper[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.semanticscholar.org/graph/v1'
const PAPER_FIELDS = 'paperId,title,abstract,year,citationCount,authors,url,venue,fieldsOfStudy,externalIds'
const AUTHOR_FIELDS = 'authorId,name,affiliations,paperCount,citationCount,hIndex'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
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
const sg = settlegrid.init({ toolSlug: 'ssrn' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchPapers(query: string, limit?: number): Promise<SsrnSearchResult> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  const l = clamp(limit, 1, 100, 10)
  return sg.wrap('search_papers', async () => {
    return apiFetch<SsrnSearchResult>(
      `/paper/search?query=${q}&limit=${l}&fields=${PAPER_FIELDS}&fieldsOfStudy=Economics,Sociology,Political+Science,Law,Business`
    )
  })
}

async function getPaper(id: string): Promise<SsrnPaper> {
  if (!id || typeof id !== 'string') throw new Error('id is required')
  const cleanId = encodeURIComponent(id.trim())
  return sg.wrap('get_paper', async () => {
    return apiFetch<SsrnPaper>(`/paper/${cleanId}?fields=${PAPER_FIELDS}`)
  })
}

async function getAuthor(authorId: string): Promise<SsrnAuthor> {
  if (!authorId || typeof authorId !== 'string') throw new Error('authorId is required')
  const cleanId = encodeURIComponent(authorId.trim())
  return sg.wrap('get_author', async () => {
    const author = await apiFetch<any>(`/author/${cleanId}?fields=${AUTHOR_FIELDS}`)
    const papersData = await apiFetch<any>(
      `/author/${cleanId}/papers?fields=${PAPER_FIELDS}&limit=10`
    )
    return { ...author, papers: papersData.data || [] }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchPapers, getPaper, getAuthor }
export type { SsrnPaper, SsrnSearchResult, SsrnAuthor }
console.log('settlegrid-ssrn server started')
