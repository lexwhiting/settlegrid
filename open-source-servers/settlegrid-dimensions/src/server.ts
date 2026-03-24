/**
 * settlegrid-dimensions — Dimensions Research Analytics MCP Server
 * Wraps OpenAlex API with SettleGrid billing for research analytics.
 *
 * Provides publication search, detailed metadata, and research statistics
 * across disciplines via the OpenAlex scholarly database.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Publication {
  id: string
  doi: string | null
  title: string
  publication_year: number | null
  cited_by_count: number
  type: string
  authorships: { author: { id: string; display_name: string }; institutions: { display_name: string }[] }[]
  primary_location: { source: { display_name: string; type: string } | null } | null
  open_access: { is_oa: boolean; oa_url: string | null }
  concepts: { id: string; display_name: string; score: number }[]
}

interface PublicationSearch {
  meta: { count: number; per_page: number; page: number }
  results: Publication[]
}

interface FieldStats {
  field: string | null
  totalWorks: number
  totalCitations: number
  oaPercentage: number
  topConcepts: { name: string; count: number }[]
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
const sg = settlegrid.init({ toolSlug: 'dimensions' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchPublications(query: string, limit?: number): Promise<PublicationSearch> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  const l = clamp(limit, 1, 50, 10)
  return sg.wrap('search_publications', async () => {
    return apiFetch<PublicationSearch>(
      `/works?search=${q}&per_page=${l}&sort=cited_by_count:desc`
    )
  })
}

async function getPublication(id: string): Promise<Publication> {
  if (!id || typeof id !== 'string') throw new Error('id is required')
  const cleanId = id.trim()
  return sg.wrap('get_publication', async () => {
    const path = cleanId.startsWith('10.') ? `/works/doi:${cleanId}` : `/works/${cleanId}`
    return apiFetch<Publication>(path)
  })
}

async function getStats(field?: string): Promise<FieldStats> {
  return sg.wrap('get_stats', async () => {
    let filter = ''
    if (field) {
      const concepts = await apiFetch<any>(`/concepts?search=${encodeURIComponent(field)}&per_page=1`)
      if (concepts.results?.[0]) {
        filter = `&filter=concepts.id:${concepts.results[0].id}`
      }
    }
    const data = await apiFetch<any>(`/works?per_page=0${filter}&group_by=open_access.is_oa`)
    const groups = data.group_by || []
    const oaTrue = groups.find((g: any) => g.key === 'true')?.count || 0
    const oaFalse = groups.find((g: any) => g.key === 'false')?.count || 0
    const total = oaTrue + oaFalse
    return {
      field: field || null,
      totalWorks: data.meta?.count || total,
      totalCitations: 0,
      oaPercentage: total > 0 ? Math.round((oaTrue / total) * 100) : 0,
      topConcepts: [],
    }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchPublications, getPublication, getStats }
export type { Publication, PublicationSearch, FieldStats }
console.log('settlegrid-dimensions server started')
