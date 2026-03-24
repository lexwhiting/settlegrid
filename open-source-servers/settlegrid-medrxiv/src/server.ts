/**
 * settlegrid-medrxiv — medRxiv Medical Preprints MCP Server
 * Wraps medRxiv API with SettleGrid billing.
 *
 * medRxiv is a free online archive for complete but unpublished
 * manuscripts in the medical, clinical, and related health sciences.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface MedrxivPaper {
  doi: string
  title: string
  authors: string
  author_corresponding: string
  author_corresponding_institution: string
  date: string
  version: string
  type: string
  category: string
  abstract: string
  published: string | null
}

interface MedrxivResponse {
  messages: { status: string; count: number; total: number }[]
  collection: MedrxivPaper[]
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
const sg = settlegrid.init({ toolSlug: 'medrxiv' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getRecent(days?: number, limit?: number): Promise<MedrxivResponse> {
  const d = clamp(days, 1, 30, 7)
  const l = clamp(limit, 1, 100, 20)
  return sg.wrap('get_recent', async () => {
    const end = new Date()
    const start = new Date(end.getTime() - d * 86400000)
    return apiFetch<MedrxivResponse>(
      `/details/medrxiv/${formatDate(start)}/${formatDate(end)}/0/${l}`
    )
  })
}

async function searchPapers(query: string): Promise<MedrxivResponse> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  return sg.wrap('search_papers', async () => {
    const end = new Date()
    const start = new Date(end.getTime() - 365 * 86400000)
    const data = await apiFetch<MedrxivResponse>(
      `/details/medrxiv/${formatDate(start)}/${formatDate(end)}/0/50`
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

async function getPaper(doi: string): Promise<MedrxivPaper> {
  if (!doi || typeof doi !== 'string') throw new Error('doi is required')
  const cleanDoi = doi.trim().replace(/^https?:\/\/doi\.org\//, '')
  return sg.wrap('get_paper', async () => {
    const data = await apiFetch<MedrxivResponse>(
      `/details/medrxiv/${encodeURIComponent(cleanDoi)}`
    )
    if (!data.collection || data.collection.length === 0) {
      throw new Error(`No medRxiv paper found for DOI: ${doi}`)
    }
    return data.collection[data.collection.length - 1]
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getRecent, searchPapers, getPaper }
export type { MedrxivPaper, MedrxivResponse }
console.log('settlegrid-medrxiv server started')
