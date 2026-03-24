/**
 * settlegrid-un-sanctions — UN Sanctions MCP Server
 * Wraps OpenSanctions API (UN dataset) with SettleGrid billing.
 *
 * Search UN Security Council sanctions lists for designated
 * individuals and entities across all UN sanctions regimes.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface UNEntity {
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

interface UNSearchResponse {
  total: { value: number; relation: string }
  results: UNEntity[]
}

interface Dataset {
  name: string
  title: string
  entity_count: number
  last_change: string
  category: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.opensanctions.org'
const UN_DATASET = 'un_sc_sanctions'

const UN_DATASETS: Dataset[] = [
  { name: 'un_sc_sanctions', title: 'UN SC Consolidated List', entity_count: 0, last_change: '', category: 'sanctions' },
  { name: 'un_taliban', title: 'UN Taliban Sanctions', entity_count: 0, last_change: '', category: 'sanctions' },
  { name: 'un_isil', title: 'UN ISIL/Al-Qaeda Sanctions', entity_count: 0, last_change: '', category: 'sanctions' },
]

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
  toolSlug: 'un-sanctions',
  pricing: { defaultCostCents: 2, methods: { search_entities: 2, get_entity: 2, list_datasets: 1 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchEntities = sg.wrap(async (args: { query: string; list?: string; limit?: number }) => {
  const q = args.query.trim()
  if (!q) throw new Error('Query must not be empty')
  const lim = clampLimit(args.limit)
  const dataset = args.list?.trim() || UN_DATASET
  const params = new URLSearchParams({ q, limit: String(lim) })
  return apiFetch<UNSearchResponse>(`/search/${encodeURIComponent(dataset)}?${params}`)
}, { method: 'search_entities' })

const getEntity = sg.wrap(async (args: { id: string }) => {
  if (!args.id?.trim()) throw new Error('Entity ID is required')
  return apiFetch<UNEntity>(`/entities/${encodeURIComponent(args.id.trim())}`)
}, { method: 'get_entity' })

const listDatasets = sg.wrap(async () => {
  try {
    const data = await apiFetch<{ datasets: Dataset[] }>('/datasets')
    const unSets = (data.datasets || []).filter((d: Dataset) => d.name.startsWith('un_'))
    return { datasets: unSets, count: unSets.length }
  } catch {
    return { datasets: UN_DATASETS, count: UN_DATASETS.length }
  }
}, { method: 'list_datasets' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchEntities, getEntity, listDatasets }
export type { UNEntity, UNSearchResponse, Dataset }
console.log('settlegrid-un-sanctions MCP server ready')
