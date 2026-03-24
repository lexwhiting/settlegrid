/**
 * settlegrid-unpaywall — Unpaywall Open Access Finder MCP Server
 * Wraps Unpaywall API with SettleGrid billing.
 *
 * Unpaywall harvests open access content from thousands of repositories
 * and publishers, finding free legal copies of research papers.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface UnpaywallResult {
  doi: string
  title: string
  is_oa: boolean
  oa_status: string
  journal_name: string | null
  publisher: string | null
  published_date: string | null
  year: number | null
  best_oa_location: OaLocation | null
  oa_locations: OaLocation[]
  z_authors: { given: string; family: string }[] | null
}

interface OaLocation {
  url: string
  url_for_pdf: string | null
  url_for_landing_page: string | null
  evidence: string
  host_type: string
  is_best: boolean
  license: string | null
  version: string
  repository_institution: string | null
}

interface OaCheckResult {
  doi: string
  isOpenAccess: boolean
  oaStatus: string
  freeUrl: string | null
  pdfUrl: string | null
  license: string | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.unpaywall.org/v2'
const EMAIL = 'contact@settlegrid.ai'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const sep = url.includes('?') ? '&' : '?'
  const res = await fetch(`${url}${sep}email=${EMAIL}`, {
    headers: { 'Accept': 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function validateDoi(doi: string): string {
  const clean = doi.trim().replace(/^https?:\/\/doi\.org\//, '')
  if (!clean.startsWith('10.')) throw new Error(`Invalid DOI: ${doi}. Must start with 10.`)
  return clean
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'unpaywall' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getAccess(doi: string): Promise<UnpaywallResult> {
  const cleanDoi = validateDoi(doi)
  return sg.wrap('get_access', async () => {
    return apiFetch<UnpaywallResult>(`/${encodeURIComponent(cleanDoi)}`)
  })
}

async function checkOa(doi: string): Promise<OaCheckResult> {
  const cleanDoi = validateDoi(doi)
  return sg.wrap('check_oa', async () => {
    const data = await apiFetch<UnpaywallResult>(`/${encodeURIComponent(cleanDoi)}`)
    return {
      doi: cleanDoi,
      isOpenAccess: data.is_oa,
      oaStatus: data.oa_status,
      freeUrl: data.best_oa_location?.url || null,
      pdfUrl: data.best_oa_location?.url_for_pdf || null,
      license: data.best_oa_location?.license || null,
    }
  })
}

async function searchOa(query: string): Promise<{ results: any[] }> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  return sg.wrap('search_oa', async () => {
    const q = encodeURIComponent(query.trim())
    const res = await fetch(
      `https://api.openalex.org/works?search=${q}&filter=open_access.is_oa:true&per_page=10&mailto=${EMAIL}`,
      { headers: { 'Accept': 'application/json' } }
    )
    if (!res.ok) throw new Error(`Search API error: ${res.status}`)
    const data = await res.json() as any
    return { results: data.results || [] }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getAccess, checkOa, searchOa }
export type { UnpaywallResult, OaLocation, OaCheckResult }
console.log('settlegrid-unpaywall server started')
