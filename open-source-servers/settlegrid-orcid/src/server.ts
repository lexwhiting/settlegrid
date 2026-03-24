/**
 * settlegrid-orcid — ORCID Researcher Profiles MCP Server
 * Wraps ORCID Public API with SettleGrid billing.
 *
 * ORCID provides unique persistent identifiers for researchers,
 * connecting them with their contributions and affiliations.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface OrcidProfile {
  orcid: string
  name: { givenNames: string; familyName: string } | null
  biography: string | null
  emails: string[]
  affiliations: { organization: string; role: string; startYear: number | null }[]
}

interface OrcidWork {
  putCode: number
  title: string
  type: string
  year: number | null
  doi: string | null
  journal: string | null
  url: string | null
}

interface OrcidSearchResult {
  total: number
  results: { orcid: string; givenNames: string; familyName: string }[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://pub.orcid.org/v3.0'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function validateOrcid(orcid: string): string {
  const clean = orcid.trim()
  if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(clean)) {
    throw new Error(`Invalid ORCID format: ${orcid}. Expected: 0000-0002-1825-0097`)
  }
  return clean
}

function clamp(val: number | undefined, min: number, max: number, def: number): number {
  if (val === undefined || val === null) return def
  return Math.max(min, Math.min(max, Math.floor(val)))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'orcid' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchResearchers(query: string, limit?: number): Promise<OrcidSearchResult> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  const l = clamp(limit, 1, 50, 10)
  return sg.wrap('search_researchers', async () => {
    const raw = await apiFetch<any>(`/search/?q=${q}&rows=${l}`)
    const results = (raw.result || []).map((r: any) => ({
      orcid: r['orcid-identifier']?.path || '',
      givenNames: r['orcid-identifier']?.['given-names'] || '',
      familyName: r['orcid-identifier']?.['family-name'] || '',
    }))
    return { total: raw['num-found'] || 0, results }
  })
}

async function getProfile(orcid: string): Promise<OrcidProfile> {
  const id = validateOrcid(orcid)
  return sg.wrap('get_profile', async () => {
    const raw = await apiFetch<any>(`/${id}/person`)
    const name = raw.name ? {
      givenNames: raw.name['given-names']?.value || '',
      familyName: raw.name['family-name']?.value || '',
    } : null
    const biography = raw.biography?.content || null
    const emails = (raw.emails?.email || []).map((e: any) => e.email)
    return { orcid: id, name, biography, emails, affiliations: [] }
  })
}

async function getWorks(orcid: string, limit?: number): Promise<{ total: number; works: OrcidWork[] }> {
  const id = validateOrcid(orcid)
  const l = clamp(limit, 1, 200, 20)
  return sg.wrap('get_works', async () => {
    const raw = await apiFetch<any>(`/${id}/works`)
    const groups = raw.group || []
    const works: OrcidWork[] = groups.slice(0, l).map((g: any) => {
      const ws = g['work-summary']?.[0] || {}
      return {
        putCode: ws['put-code'] || 0,
        title: ws.title?.title?.value || 'Untitled',
        type: ws.type || 'unknown',
        year: ws['publication-date']?.year?.value ? parseInt(ws['publication-date'].year.value) : null,
        doi: (ws['external-ids']?.['external-id'] || []).find((e: any) => e['external-id-type'] === 'doi')?.['external-id-value'] || null,
        journal: ws['journal-title']?.value || null,
        url: ws.url?.value || null,
      }
    })
    return { total: groups.length, works }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchResearchers, getProfile, getWorks }
export type { OrcidProfile, OrcidWork, OrcidSearchResult }
console.log('settlegrid-orcid server started')
