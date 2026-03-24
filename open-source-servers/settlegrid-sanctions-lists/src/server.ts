/**
 * settlegrid-sanctions-lists — Global Sanctions Lists MCP Server
 * Wraps the Trade.gov Consolidated Screening List API with SettleGrid billing.
 *
 * Search across multiple US government sanctions and screening
 * lists including SDN, DPL, Entity List, and more.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface SanctionEntity {
  id: string
  source: string
  name: string
  type: string
  country: string
  addresses: { address: string; city: string; country: string }[]
  ids: { type: string; number: string; country: string }[]
  programs: string[]
  remarks: string
  start_date: string
  federal_register_notice: string
}

interface SearchResponse {
  total: number
  offset: number
  results: SanctionEntity[]
  sources_used: string[]
}

interface SourceInfo {
  source: string
  description: string
  agency: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.trade.gov/gateway/v1/consolidated_screening_list'

const SOURCES: SourceInfo[] = [
  { source: 'SDN', description: 'Specially Designated Nationals', agency: 'OFAC' },
  { source: 'DPL', description: 'Denied Persons List', agency: 'BIS' },
  { source: 'EL', description: 'Entity List', agency: 'BIS' },
  { source: 'ISN', description: 'Nonproliferation Sanctions', agency: 'State' },
  { source: 'UVL', description: 'Unverified List', agency: 'BIS' },
  { source: 'FSE', description: 'Foreign Sanctions Evaders', agency: 'OFAC' },
  { source: 'PLC', description: 'Palestinian Legislative Council', agency: 'OFAC' },
  { source: 'SSI', description: 'Sectoral Sanctions Identifications', agency: 'OFAC' },
  { source: 'MEU', description: 'Military End User List', agency: 'BIS' },
  { source: 'CMIC', description: 'Chinese Military-Industrial Complex', agency: 'OFAC' },
]

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Trade.gov API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function clampLimit(limit?: number): number {
  if (limit === undefined) return 20
  return Math.max(1, Math.min(100, limit))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({
  toolSlug: 'sanctions-lists',
  pricing: { defaultCostCents: 2, methods: { search_entities: 2, get_entity: 2, list_sources: 1 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchEntities = sg.wrap(async (args: { query: string; source?: string; limit?: number }) => {
  const q = args.query.trim()
  if (!q) throw new Error('Query must not be empty')
  const lim = clampLimit(args.limit)
  const params = new URLSearchParams({ q, size: String(lim) })
  if (args.source) {
    const upper = args.source.trim().toUpperCase()
    if (!SOURCES.some(s => s.source === upper)) {
      throw new Error(`Unknown source: ${args.source}. Valid: ${SOURCES.map(s => s.source).join(', ')}`)
    }
    params.set('sources', upper)
  }
  return apiFetch<SearchResponse>(`${API_BASE}/search?${params}`)
}, { method: 'search_entities' })

const getEntity = sg.wrap(async (args: { id: string }) => {
  if (!args.id?.trim()) throw new Error('Entity ID is required')
  return apiFetch<SanctionEntity>(`${API_BASE}/${encodeURIComponent(args.id.trim())}`)
}, { method: 'get_entity' })

const listSources = sg.wrap(async () => {
  return { sources: SOURCES, count: SOURCES.length }
}, { method: 'list_sources' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchEntities, getEntity, listSources }
export type { SanctionEntity, SearchResponse, SourceInfo }
console.log('settlegrid-sanctions-lists MCP server ready')
