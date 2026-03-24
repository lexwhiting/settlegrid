/**
 * settlegrid-math-genealogy — Mathematics Genealogy MCP Server
 * Wraps OpenAlex API with SettleGrid billing for mathematics research.
 *
 * Access mathematician profiles, their published works, and academic
 * connections via the OpenAlex scholarly database.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface MathAuthor {
  id: string
  display_name: string
  works_count: number
  cited_by_count: number
  last_known_institutions: { id: string; display_name: string; country_code: string }[]
  x_concepts: { id: string; display_name: string; score: number }[]
  summary_stats: { h_index: number; i10_index: number } | null
}

interface MathWork {
  id: string
  doi: string | null
  title: string
  publication_year: number | null
  cited_by_count: number
  type: string
  primary_location: { source: { display_name: string } | null } | null
  authorships: { author: { id: string; display_name: string } }[]
  abstract_inverted_index: Record<string, number[]> | null
}

interface AuthorSearchResult {
  meta: { count: number }
  results: MathAuthor[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.openalex.org'
const MATH_CONCEPT = 'C33923547'
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
const sg = settlegrid.init({ toolSlug: 'math-genealogy' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchMathematicians(name: string): Promise<AuthorSearchResult> {
  if (!name || typeof name !== 'string') throw new Error('name is required')
  const q = encodeURIComponent(name.trim())
  return sg.wrap('search_mathematicians', async () => {
    return apiFetch<AuthorSearchResult>(
      `/authors?search=${q}&filter=concepts.id:${MATH_CONCEPT}&per_page=10&sort=cited_by_count:desc`
    )
  })
}

async function getAuthor(id: string): Promise<MathAuthor> {
  if (!id || typeof id !== 'string') throw new Error('id is required')
  return sg.wrap('get_author', async () => {
    return apiFetch<MathAuthor>(`/authors/${encodeURIComponent(id.trim())}`)
  })
}

async function getWorks(authorId: string, limit?: number): Promise<{ meta: { count: number }; results: MathWork[] }> {
  if (!authorId || typeof authorId !== 'string') throw new Error('authorId is required')
  const l = clamp(limit, 1, 50, 20)
  return sg.wrap('get_works', async () => {
    return apiFetch<{ meta: { count: number }; results: MathWork[] }>(
      `/works?filter=authorships.author.id:${encodeURIComponent(authorId.trim())}&per_page=${l}&sort=publication_year:desc`
    )
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchMathematicians, getAuthor, getWorks }
export type { MathAuthor, MathWork, AuthorSearchResult }
console.log('settlegrid-math-genealogy server started')
