/**
 * settlegrid-ror — Research Organization Registry MCP Server
 * Wraps ROR API with SettleGrid billing.
 *
 * ROR is a community-led registry of open, sustainable, usable,
 * and unique identifiers for every research organization in the world.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface RorOrganization {
  id: string
  names: { value: string; types: string[]; lang: string | null }[]
  locations: { geonames_details: { country_code: string; name: string; lat: number; lng: number } }[]
  types: string[]
  established: number | null
  links: { type: string; value: string }[]
  relationships: { type: string; id: string; label: string }[]
  status: string
}

interface RorSearchResult {
  number_of_results: number
  items: RorOrganization[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.ror.org/v2/organizations'

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

function normalizeRorId(id: string): string {
  const clean = id.trim()
  if (clean.startsWith('https://ror.org/')) return clean
  if (/^[0-9a-z]{9}$/.test(clean)) return `https://ror.org/${clean}`
  throw new Error(`Invalid ROR ID format: ${id}`)
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'ror' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchOrganizations(query: string, limit?: number): Promise<RorSearchResult> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  const l = clamp(limit, 1, 40, 10)
  return sg.wrap('search_organizations', async () => {
    const result = await apiFetch<RorSearchResult>(`?query=${q}`)
    result.items = result.items.slice(0, l)
    return result
  })
}

async function getOrganization(id: string): Promise<RorOrganization> {
  if (!id || typeof id !== 'string') throw new Error('id is required')
  const rorId = normalizeRorId(id)
  return sg.wrap('get_organization', async () => {
    return apiFetch<RorOrganization>(`/${encodeURIComponent(rorId)}`)
  })
}

async function listByCountry(country: string): Promise<RorSearchResult> {
  if (!country || typeof country !== 'string') throw new Error('country is required')
  const cc = country.trim().toUpperCase()
  if (cc.length !== 2) throw new Error('country must be a 2-letter ISO country code')
  return sg.wrap('list_by_country', async () => {
    return apiFetch<RorSearchResult>(`?filter=locations.geonames_details.country_code:${cc}`)
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchOrganizations, getOrganization, listByCountry }
export type { RorOrganization, RorSearchResult }
console.log('settlegrid-ror server started')
