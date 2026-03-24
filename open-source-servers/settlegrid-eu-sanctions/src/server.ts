/**
 * settlegrid-eu-sanctions — EU Sanctions MCP Server
 * Wraps OpenSanctions API (EU dataset) with SettleGrid billing.
 *
 * Search EU sanctions lists for sanctioned individuals, entities,
 * and organizations using the OpenSanctions aggregation.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface SanctionEntity {
  id: string
  schema: string
  name: string
  aliases: string[]
  birth_date: string | null
  countries: string[]
  datasets: string[]
  first_seen: string
  last_seen: string
  properties: Record<string, string[]>
}

interface SearchResponse {
  total: { value: number; relation: string }
  results: SanctionEntity[]
}

interface DatasetStats {
  name: string
  title: string
  entity_count: number
  last_change: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.opensanctions.org'
const EU_DATASET = 'eu_fsf'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenSanctions API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function clampLimit(limit?: number): number {
  if (limit === undefined) return 20
  return Math.max(1, Math.min(100, limit))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({
  toolSlug: 'eu-sanctions',
  pricing: { defaultCostCents: 2, methods: { search_entities: 2, get_entity: 2, get_stats: 1 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchEntities = sg.wrap(async (args: { query: string; limit?: number }) => {
  const q = args.query.trim()
  if (!q) throw new Error('Query must not be empty')
  const lim = clampLimit(args.limit)
  const params = new URLSearchParams({ q, limit: String(lim) })
  return apiFetch<SearchResponse>(`/search/${EU_DATASET}?${params}`)
}, { method: 'search_entities' })

const getEntity = sg.wrap(async (args: { id: string }) => {
  if (!args.id?.trim()) throw new Error('Entity ID is required')
  return apiFetch<SanctionEntity>(`/entities/${encodeURIComponent(args.id.trim())}`)
}, { method: 'get_entity' })

const getStats = sg.wrap(async () => {
  const data = await apiFetch<DatasetStats>(`/datasets/${EU_DATASET}`)
  return {
    dataset: EU_DATASET,
    title: data.title || 'EU Financial Sanctions',
    entity_count: data.entity_count || 0,
    last_change: data.last_change || '',
  }
}, { method: 'get_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchEntities, getEntity, getStats }
export type { SanctionEntity, SearchResponse, DatasetStats }
console.log('settlegrid-eu-sanctions MCP server ready')
