/**
 * settlegrid-bioarxiv — bioRxiv Biology Preprints MCP Server
 * Wraps bioRxiv API with SettleGrid billing.
 *
 * bioRxiv is a free online archive and distribution service for
 * unpublished preprints in the life sciences.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface BiorxivPaper {
  doi: string
  title: string
  authors: string
  author_corresponding: string
  author_corresponding_institution: string
  date: string
  version: string
  type: string
  category: string
  jatsxml: string | null
  abstract: string
  published: string | null
}

interface BiorxivResponse {
  messages: { status: string; count: number; total: number }[]
  collection: BiorxivPaper[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.biorxiv.org'

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

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'bioarxiv' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getRecent(days?: number, limit?: number): Promise<BiorxivResponse> {
  const d = clamp(days, 1, 30, 7)
  const l = clamp(limit, 1, 100, 20)
  return sg.wrap('get_recent', async () => {
    const end = new Date()
    const start = new Date(end.getTime() - d * 86400000)
    return apiFetch<BiorxivResponse>(
      `/details/biorxiv/${formatDate(start)}/${formatDate(end)}/0/${l}`
    )
  })
}

async function searchPapers(query: string): Promise<BiorxivResponse> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  return sg.wrap('search_papers', async () => {
    const end = new Date()
    const start = new Date(end.getTime() - 365 * 86400000)
    const data = await apiFetch<BiorxivResponse>(
      `/details/biorxiv/${formatDate(start)}/${formatDate(end)}/0/50`
    )
    const q = query.toLowerCase()
    data.collection = data.collection.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.abstract.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    )
    return data
  })
}

async function getPaper(doi: string): Promise<BiorxivPaper> {
  if (!doi || typeof doi !== 'string') throw new Error('doi is required')
  const cleanDoi = doi.trim().replace(/^https?:\/\/doi\.org\//, '')
  return sg.wrap('get_paper', async () => {
    const data = await apiFetch<BiorxivResponse>(
      `/details/biorxiv/${encodeURIComponent(cleanDoi)}`
    )
    if (!data.collection || data.collection.length === 0) {
      throw new Error(`No bioRxiv paper found for DOI: ${doi}`)
    }
    return data.collection[data.collection.length - 1]
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getRecent, searchPapers, getPaper }
export type { BiorxivPaper, BiorxivResponse }
console.log('settlegrid-bioarxiv server started')
