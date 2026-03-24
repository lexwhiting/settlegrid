/**
 * settlegrid-core-api — CORE Open Access Papers MCP Server
 * Wraps CORE API with SettleGrid billing.
 *
 * CORE aggregates millions of open access research papers from
 * repositories and journals worldwide.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface CorePaper {
  id: string
  doi: string | null
  title: string
  authors: { name: string }[]
  abstract: string | null
  yearPublished: number | null
  downloadUrl: string | null
  sourceFulltextUrls: string[]
  language: string | null
}

interface CoreSearchResult {
  totalHits: number
  results: CorePaper[]
}

interface CoreJournal {
  id: string
  title: string
  identifiers: string[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.core.ac.uk/v3'
const API_KEY = process.env.CORE_API_KEY || ''

async function apiFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('CORE_API_KEY environment variable is required')
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
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
const sg = settlegrid.init({ toolSlug: 'core-api' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchPapers(query: string, limit?: number): Promise<CoreSearchResult> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  const l = clamp(limit, 1, 100, 10)
  return sg.wrap('search_papers', async () => {
    return apiFetch<CoreSearchResult>(`/search/works?q=${q}&limit=${l}`)
  })
}

async function getPaper(id: string): Promise<CorePaper> {
  if (!id || typeof id !== 'string') throw new Error('id is required')
  const cleanId = encodeURIComponent(id.trim())
  return sg.wrap('get_paper', async () => {
    return apiFetch<CorePaper>(`/works/${cleanId}`)
  })
}

async function searchJournals(query: string): Promise<{ results: CoreJournal[] }> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  return sg.wrap('search_journals', async () => {
    return apiFetch<{ results: CoreJournal[] }>(`/journals/search?q=${q}&limit=10`)
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchPapers, getPaper, searchJournals }
export type { CorePaper, CoreSearchResult, CoreJournal }
console.log('settlegrid-core-api server started')
