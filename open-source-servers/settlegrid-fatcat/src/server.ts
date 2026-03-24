/**
 * settlegrid-fatcat — Fatcat Scholarly Catalog MCP Server
 * Wraps Fatcat API with SettleGrid billing.
 *
 * Fatcat is an open catalog of scholarly metadata maintained by the
 * Internet Archive, covering papers, journals, authors, and file archives.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface FatcatRelease {
  ident: string
  title: string
  release_type: string | null
  release_stage: string | null
  release_year: number | null
  release_date: string | null
  doi: string | null
  pmid: string | null
  isbn13: string | null
  contribs: { raw_name: string; role: string; index: number }[]
  container: { ident: string; name: string; issnl: string | null } | null
  abstracts: { content: string; mimetype: string; lang: string }[]
  refs: { index: number; target_release_id: string | null; extra: any }[]
  ext_ids: Record<string, string>
}

interface FatcatContainer {
  ident: string
  name: string
  issnl: string | null
  issne: string | null
  issnp: string | null
  publisher: string | null
  container_type: string | null
  wikidata_qid: string | null
  edit_extra: any
}

interface FatcatSearchResult {
  count: number
  results: FatcatRelease[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.fatcat.wiki/v0'

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

function validateIdent(id: string): string {
  const clean = id.trim()
  if (!/^[a-z0-9]{26}$/.test(clean)) {
    throw new Error(`Invalid Fatcat ID format: ${id}. Expected 26-character lowercase alphanumeric.`)
  }
  return clean
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'fatcat' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchReleases(query: string, limit?: number): Promise<FatcatSearchResult> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  const l = clamp(limit, 1, 50, 10)
  return sg.wrap('search_releases', async () => {
    const data = await apiFetch<any>(
      `/release/search?q=${q}&limit=${l}&expand=container`
    )
    return {
      count: data.count_returned || 0,
      results: (data.results || []).map((r: any) => ({
        ident: r.ident || '',
        title: r.title || 'Untitled',
        release_type: r.release_type || null,
        release_stage: r.release_stage || null,
        release_year: r.release_year || null,
        release_date: r.release_date || null,
        doi: r.doi || null,
        pmid: r.pmid || null,
        isbn13: r.isbn13 || null,
        contribs: r.contribs || [],
        container: r.container || null,
        abstracts: r.abstracts || [],
        refs: [],
        ext_ids: r.ext_ids || {},
      })),
    }
  })
}

async function getRelease(id: string): Promise<FatcatRelease> {
  if (!id || typeof id !== 'string') throw new Error('id is required')
  const cleanId = validateIdent(id)
  return sg.wrap('get_release', async () => {
    return apiFetch<FatcatRelease>(
      `/release/${cleanId}?expand=container,refs`
    )
  })
}

async function getContainer(id: string): Promise<FatcatContainer> {
  if (!id || typeof id !== 'string') throw new Error('id is required')
  const cleanId = validateIdent(id)
  return sg.wrap('get_container', async () => {
    return apiFetch<FatcatContainer>(`/container/${cleanId}`)
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchReleases, getRelease, getContainer }
export type { FatcatRelease, FatcatContainer, FatcatSearchResult }
console.log('settlegrid-fatcat server started')
