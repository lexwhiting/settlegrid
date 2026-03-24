/**
 * settlegrid-aml-data — AML/KYC Reference Data MCP Server
 * Wraps OpenSanctions API with SettleGrid billing.
 *
 * Search across sanctions, PEP, and criminal watchlists for
 * anti-money-laundering and KYC compliance screening.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface AMLEntity {
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
  referents: string[]
}

interface AMLSearchResponse {
  total: { value: number; relation: string }
  results: AMLEntity[]
}

interface AMLDataset {
  name: string
  title: string
  entity_count: number
  last_change: string
  category: string
  publisher: { name: string; country: string }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.opensanctions.org'
const DEFAULT_DATASET = 'default'

const VALID_SCHEMAS = ['Person', 'Organization', 'Company', 'LegalEntity', 'Vessel', 'Aircraft']

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
  toolSlug: 'aml-data',
  pricing: { defaultCostCents: 2, methods: { search_entities: 2, get_entity: 2, list_datasets: 1 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchEntities = sg.wrap(async (args: { query: string; schema?: string; limit?: number }) => {
  const q = args.query.trim()
  if (!q) throw new Error('Query must not be empty')
  const lim = clampLimit(args.limit)
  const params = new URLSearchParams({ q, limit: String(lim) })
  if (args.schema) {
    const s = args.schema.trim()
    const match = VALID_SCHEMAS.find(v => v.toLowerCase() === s.toLowerCase())
    if (!match) throw new Error(`Invalid schema: ${s}. Valid: ${VALID_SCHEMAS.join(', ')}`)
    params.set('schema', match)
  }
  return apiFetch<AMLSearchResponse>(`/search/${DEFAULT_DATASET}?${params}`)
}, { method: 'search_entities' })

const getEntity = sg.wrap(async (args: { id: string }) => {
  if (!args.id?.trim()) throw new Error('Entity ID is required')
  return apiFetch<AMLEntity>(`/entities/${encodeURIComponent(args.id.trim())}`)
}, { method: 'get_entity' })

const listDatasets = sg.wrap(async () => {
  try {
    const data = await apiFetch<{ datasets: AMLDataset[] }>('/datasets')
    const sets = data.datasets || []
    return {
      datasets: sets.map((d: AMLDataset) => ({
        name: d.name,
        title: d.title,
        entity_count: d.entity_count,
        last_change: d.last_change,
        category: d.category || 'sanctions',
      })),
      count: sets.length,
    }
  } catch (err) {
    throw new Error(`Failed to fetch datasets: ${err}`)
  }
}, { method: 'list_datasets' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchEntities, getEntity, listDatasets }
export type { AMLEntity, AMLSearchResponse, AMLDataset }
console.log('settlegrid-aml-data MCP server ready')
