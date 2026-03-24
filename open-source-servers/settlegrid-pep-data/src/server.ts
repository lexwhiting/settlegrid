/**
 * settlegrid-pep-data — PEP Databases MCP Server
 * Wraps OpenSanctions API with SettleGrid billing.
 *
 * Search Politically Exposed Persons (PEP) data for KYC/AML
 * compliance. Covers heads of state, government officials,
 * senior executives, and their family members.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface PEPEntity {
  id: string
  schema: string
  name: string
  aliases: string[]
  birth_date: string | null
  countries: string[]
  datasets: string[]
  position: string | null
  first_seen: string
  last_seen: string
  properties: Record<string, string[]>
}

interface PEPSearchResponse {
  total: { value: number; relation: string }
  results: PEPEntity[]
}

interface PEPStats {
  dataset: string
  title: string
  entity_count: number
  last_change: string
  coverage: { countries: number; positions: number }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.opensanctions.org'
const PEP_DATASET = 'peps'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenSanctions API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function validateCountryCode(code: string): string {
  const upper = code.trim().toUpperCase()
  if (upper.length !== 2) throw new Error(`Invalid country code: ${code}. Must be 2 letters (ISO).`)
  return upper
}

function clampLimit(limit?: number): number {
  if (limit === undefined) return 20
  return Math.max(1, Math.min(100, limit))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({
  toolSlug: 'pep-data',
  pricing: { defaultCostCents: 2, methods: { search_peps: 2, get_entity: 2, get_stats: 1 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchPeps = sg.wrap(async (args: { query: string; country?: string; limit?: number }) => {
  const q = args.query.trim()
  if (!q) throw new Error('Query must not be empty')
  const lim = clampLimit(args.limit)
  const params = new URLSearchParams({ q, limit: String(lim), schema: 'Person' })
  if (args.country) {
    const cc = validateCountryCode(args.country)
    params.set('countries', cc)
  }
  return apiFetch<PEPSearchResponse>(`/search/${PEP_DATASET}?${params}`)
}, { method: 'search_peps' })

const getEntity = sg.wrap(async (args: { id: string }) => {
  if (!args.id?.trim()) throw new Error('Entity ID is required')
  return apiFetch<PEPEntity>(`/entities/${encodeURIComponent(args.id.trim())}`)
}, { method: 'get_entity' })

const getStats = sg.wrap(async (args: { dataset?: string }) => {
  const ds = args.dataset?.trim() || PEP_DATASET
  const data = await apiFetch<any>(`/datasets/${encodeURIComponent(ds)}`)
  return {
    dataset: ds,
    title: data.title || 'Politically Exposed Persons',
    entity_count: data.entity_count || 0,
    last_change: data.last_change || '',
    coverage: { countries: data.publisher?.country_count || 0, positions: 0 },
  } as PEPStats
}, { method: 'get_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchPeps, getEntity, getStats }
export type { PEPEntity, PEPSearchResponse, PEPStats }
console.log('settlegrid-pep-data MCP server ready')
