/**
 * settlegrid-datacite — DataCite DOI Metadata MCP Server
 * Wraps DataCite REST API with SettleGrid billing.
 *
 * DataCite is a global DOI registration agency providing persistent
 * identifiers for research data, publications, and other scholarly outputs.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface DataciteDoi {
  id: string
  type: string
  attributes: {
    doi: string
    titles: { title: string }[]
    creators: { name: string; nameType: string }[]
    publicationYear: number | null
    types: { resourceTypeGeneral: string; resourceType: string }
    publisher: string | null
    url: string | null
    descriptions: { description: string; descriptionType: string }[]
    subjects: { subject: string }[]
    registered: string | null
  }
}

interface DataciteSearchResult {
  meta: { total: number; totalPages: number }
  data: DataciteDoi[]
}

interface DataciteStats {
  total: number
  byYear: Record<string, number>
  byType: Record<string, number>
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.datacite.org'

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

function validateDoi(doi: string): string {
  const clean = doi.trim().replace(/^https?:\/\/doi\.org\//, '')
  if (!clean.startsWith('10.')) throw new Error(`Invalid DOI: ${doi}. Must start with 10.`)
  return clean
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'datacite' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getDoi(doi: string): Promise<DataciteDoi> {
  const cleanDoi = validateDoi(doi)
  return sg.wrap('get_doi', async () => {
    const result = await apiFetch<{ data: DataciteDoi }>(`/dois/${encodeURIComponent(cleanDoi)}`)
    return result.data
  })
}

async function searchDois(query: string, limit?: number): Promise<DataciteSearchResult> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  const l = clamp(limit, 1, 100, 10)
  return sg.wrap('search_dois', async () => {
    return apiFetch<DataciteSearchResult>(`/dois?query=${q}&page[size]=${l}`)
  })
}

async function getStats(clientId?: string): Promise<DataciteStats> {
  return sg.wrap('get_stats', async () => {
    const filter = clientId ? `&client-id=${encodeURIComponent(clientId)}` : ''
    const data = await apiFetch<any>(`/dois?page[size]=0${filter}`)
    const meta = data.meta || {}
    return {
      total: meta.total || 0,
      byYear: meta['published'] || {},
      byType: meta['resource-types'] || {},
    }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getDoi, searchDois, getStats }
export type { DataciteDoi, DataciteSearchResult, DataciteStats }
console.log('settlegrid-datacite server started')
