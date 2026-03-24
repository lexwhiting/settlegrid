/**
 * settlegrid-usda-nass — USDA NASS Crop Statistics MCP Server
 * Wraps the USDA NASS QuickStats API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface NassRecord {
  commodity_desc: string
  state_name: string
  year: number
  statisticcat_desc: string
  unit_desc: string
  Value: string
  short_desc: string
}

interface NassResponse {
  data: NassRecord[]
}

interface CommodityList {
  commodities: string[]
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://quickstats.nass.usda.gov/api'
const API_KEY = process.env.NASS_API_KEY

// ─── Helpers ────────────────────────────────────────────────────────────────
function requireApiKey(): string {
  if (!API_KEY) throw new Error('NASS_API_KEY environment variable is required. Get one at https://quickstats.nass.usda.gov/api')
  return API_KEY
}

function validateCommodity(c: string): string {
  const upper = c.trim().toUpperCase()
  if (!upper) throw new Error('Commodity name is required')
  return upper
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NASS API error: ${res.status} ${res.statusText} — ${body}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'usda-nass' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getStats(commodity: string, year?: number, state?: string): Promise<NassResponse> {
  const key = requireApiKey()
  const comm = validateCommodity(commodity)
  return sg.wrap('get_stats', async () => {
    const params = new URLSearchParams({ key, commodity_desc: comm, format: 'JSON' })
    if (year) {
      if (year < 1900 || year > 2100) throw new Error('Year must be between 1900 and 2100')
      params.set('year', String(year))
    }
    if (state) params.set('state_name', state.trim().toUpperCase())
    const data = await fetchJSON<NassResponse>(`${API}/api_GET/?${params}`)
    return data
  })
}

async function listCommodities(): Promise<CommodityList> {
  const key = requireApiKey()
  return sg.wrap('list_commodities', async () => {
    const params = new URLSearchParams({ key })
    const data = await fetchJSON<Record<string, string[]>>(`${API}/get_param_values/?param=commodity_desc&${params}`)
    return { commodities: data.commodity_desc || [] }
  })
}

async function searchData(query: string): Promise<NassResponse> {
  const key = requireApiKey()
  if (!query || !query.trim()) throw new Error('Search query is required')
  return sg.wrap('search_data', async () => {
    const params = new URLSearchParams({ key, short_desc: query.trim().toUpperCase(), format: 'JSON' })
    const data = await fetchJSON<NassResponse>(`${API}/api_GET/?${params}`)
    return data
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getStats, listCommodities, searchData }

console.log('settlegrid-usda-nass MCP server loaded')
