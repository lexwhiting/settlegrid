/**
 * settlegrid-repec — RePEc Economics Papers MCP Server
 * Wraps OpenAlex API with SettleGrid billing for economics research.
 *
 * Provides access to economics working papers, journal articles,
 * and research via OpenAlex filtered for economics content.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface EconPaper {
  id: string
  doi: string | null
  title: string
  publication_year: number | null
  cited_by_count: number
  authorships: { author: { id: string; display_name: string } }[]
  primary_location: { source: { display_name: string } | null } | null
  abstract_inverted_index: Record<string, number[]> | null
  type: string
  open_access: { is_oa: boolean; oa_url: string | null }
}

interface EconSearchResult {
  meta: { count: number; per_page: number; page: number }
  results: EconPaper[]
}

interface EconJournal {
  id: string
  display_name: string
  issn: string[] | null
  works_count: number
  cited_by_count: number
  type: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.openalex.org'
const ECON_CONCEPT = 'C162324750'
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

function reconstructAbstract(index: Record<string, number[]> | null): string | null {
  if (!index) return null
  const words: [string, number][] = []
  for (const [word, positions] of Object.entries(index)) {
    for (const pos of positions) words.push([word, pos])
  }
  words.sort((a, b) => a[1] - b[1])
  return words.map(w => w[0]).join(' ')
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'repec' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchPapers(query: string, limit?: number): Promise<EconSearchResult> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  const l = clamp(limit, 1, 50, 10)
  return sg.wrap('search_papers', async () => {
    return apiFetch<EconSearchResult>(
      `/works?search=${q}&filter=concepts.id:${ECON_CONCEPT}&per_page=${l}&sort=cited_by_count:desc`
    )
  })
}

async function getPaper(id: string): Promise<EconPaper> {
  if (!id || typeof id !== 'string') throw new Error('id is required')
  const cleanId = id.trim()
  return sg.wrap('get_paper', async () => {
    const path = cleanId.startsWith('10.') ? `/works/doi:${cleanId}` : `/works/${cleanId}`
    return apiFetch<EconPaper>(path)
  })
}

async function listJournals(limit?: number): Promise<{ results: EconJournal[] }> {
  const l = clamp(limit, 1, 50, 20)
  return sg.wrap('list_journals', async () => {
    return apiFetch<{ results: EconJournal[] }>(
      `/sources?filter=concepts.id:${ECON_CONCEPT},type:journal&per_page=${l}&sort=cited_by_count:desc`
    )
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchPapers, getPaper, listJournals }
export type { EconPaper, EconSearchResult, EconJournal }
console.log('settlegrid-repec server started')
