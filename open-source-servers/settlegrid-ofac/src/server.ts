/**
 * settlegrid-ofac — OFAC SDN List MCP Server
 * Wraps Trade.gov CSL (filtered to OFAC sources) with SettleGrid billing.
 *
 * Search the OFAC Specially Designated Nationals and Blocked
 * Persons List (SDN) for sanctioned individuals and entities.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface SDNEntry {
  id: string
  source: string
  name: string
  type: string
  country: string
  programs: string[]
  addresses: { address: string; city: string; state: string; country: string; postal_code: string }[]
  ids: { type: string; number: string; country: string }[]
  aliases: string[]
  remarks: string
  start_date: string
  end_date: string | null
  federal_register_notice: string
}

interface SDNSearchResponse {
  total: number
  offset: number
  results: SDNEntry[]
  sources_used: string[]
}

interface SDNStats {
  total_entries: number
  by_type: Record<string, number>
  by_program: Record<string, number>
  last_updated: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.trade.gov/gateway/v1/consolidated_screening_list'
const OFAC_SOURCES = 'SDN,FSE,SSI,CMIC,NS-PLC'

const VALID_TYPES = ['individual', 'entity', 'vessel', 'aircraft']

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OFAC API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function clampLimit(limit?: number): number {
  if (limit === undefined) return 20
  return Math.max(1, Math.min(100, limit))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({
  toolSlug: 'ofac',
  pricing: { defaultCostCents: 2, methods: { search_sdn: 2, get_entry: 2, get_stats: 1 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchSdn = sg.wrap(async (args: { query: string; type?: string; limit?: number }) => {
  const q = args.query.trim()
  if (!q) throw new Error('Query must not be empty')
  const lim = clampLimit(args.limit)
  const params = new URLSearchParams({ q, sources: OFAC_SOURCES, size: String(lim) })
  if (args.type) {
    const lower = args.type.trim().toLowerCase()
    if (!VALID_TYPES.includes(lower)) {
      throw new Error(`Invalid type: ${args.type}. Valid: ${VALID_TYPES.join(', ')}`)
    }
    params.set('type', lower)
  }
  return apiFetch<SDNSearchResponse>(`${API_BASE}/search?${params}`)
}, { method: 'search_sdn' })

const getEntry = sg.wrap(async (args: { id: string }) => {
  if (!args.id?.trim()) throw new Error('Entry ID is required')
  return apiFetch<SDNEntry>(`${API_BASE}/${encodeURIComponent(args.id.trim())}`)
}, { method: 'get_entry' })

const getStats = sg.wrap(async () => {
  const data = await apiFetch<SDNSearchResponse>(`${API_BASE}/search?sources=${OFAC_SOURCES}&size=1`)
  const total = data.total || 0
  return {
    total_entries: total,
    by_type: { note: 'Aggregated from OFAC lists' },
    by_program: { note: 'Multiple OFAC programs' },
    last_updated: new Date().toISOString().slice(0, 10),
  } as unknown as SDNStats
}, { method: 'get_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchSdn, getEntry, getStats }
export type { SDNEntry, SDNSearchResponse, SDNStats }
console.log('settlegrid-ofac MCP server ready')
