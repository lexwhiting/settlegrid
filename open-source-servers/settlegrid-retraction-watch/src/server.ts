/**
 * settlegrid-retraction-watch — Retraction Watch MCP Server
 * Wraps OpenAlex API with SettleGrid billing for retracted papers.
 *
 * Search and analyze retracted research papers to help maintain
 * scientific integrity and identify problematic research.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface RetractedPaper {
  id: string
  doi: string | null
  title: string
  publication_year: number | null
  cited_by_count: number
  is_retracted: boolean
  type: string
  authorships: { author: { id: string; display_name: string } }[]
  primary_location: { source: { display_name: string } | null } | null
  open_access: { is_oa: boolean; oa_url: string | null }
}

interface RetractionSearchResult {
  meta: { count: number; per_page: number; page: number }
  results: RetractedPaper[]
}

interface RetractionStats {
  totalRetracted: number
  year: number | null
  byType: Record<string, number>
  topJournals: { name: string; count: number }[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.openalex.org'
const EMAIL = 'contact@settlegrid.ai'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const sep = url.includes('?') ? '&' : '?'
  const res = await fetch(`${url}${sep}mailto=${EMAIL}`, {
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
const sg = settlegrid.init({ toolSlug: 'retraction-watch' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchRetractions(query: string, limit?: number): Promise<RetractionSearchResult> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  const l = clamp(limit, 1, 50, 10)
  return sg.wrap('search_retractions', async () => {
    return apiFetch<RetractionSearchResult>(
      `/works?search=${q}&filter=is_retracted:true&per_page=${l}&sort=publication_year:desc`
    )
  })
}

async function getRetraction(id: string): Promise<RetractedPaper> {
  if (!id || typeof id !== 'string') throw new Error('id is required')
  const cleanId = id.trim()
  return sg.wrap('get_retraction', async () => {
    const path = cleanId.startsWith('10.') ? `/works/doi:${cleanId}` : `/works/${cleanId}`
    const paper = await apiFetch<RetractedPaper>(path)
    if (!paper.is_retracted) {
      console.warn(`Note: Paper ${id} is not marked as retracted`)
    }
    return paper
  })
}

async function getStats(year?: number): Promise<RetractionStats> {
  return sg.wrap('get_stats', async () => {
    const yearFilter = year ? `,publication_year:${year}` : ''
    const data = await apiFetch<any>(
      `/works?filter=is_retracted:true${yearFilter}&group_by=type&per_page=0`
    )
    const byType: Record<string, number> = {}
    for (const g of (data.group_by || [])) {
      byType[g.key] = g.count
    }
    return {
      totalRetracted: data.meta?.count || 0,
      year: year || null,
      byType,
      topJournals: [],
    }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchRetractions, getRetraction, getStats }
export type { RetractedPaper, RetractionSearchResult, RetractionStats }
console.log('settlegrid-retraction-watch server started')
