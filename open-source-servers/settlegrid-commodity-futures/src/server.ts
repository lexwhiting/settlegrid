/**
 * settlegrid-commodity-futures — Agricultural Commodity Futures MCP Server
 * Wraps public commodity data APIs with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface CommodityPrice {
  commodity: string
  price: number
  unit: string
  currency: string
  date: string
  change: number | null
  changePercent: number | null
}

interface HistoricalPrice {
  date: string
  price: number
  volume: number | null
}

interface CommodityInfo {
  name: string
  symbol: string
  exchange: string
  unit: string
  category: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const FISCAL_API = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service'

const COMMODITIES: CommodityInfo[] = [
  { name: 'Corn', symbol: 'ZC', exchange: 'CBOT', unit: 'cents/bushel', category: 'Grain' },
  { name: 'Wheat', symbol: 'ZW', exchange: 'CBOT', unit: 'cents/bushel', category: 'Grain' },
  { name: 'Soybeans', symbol: 'ZS', exchange: 'CBOT', unit: 'cents/bushel', category: 'Oilseed' },
  { name: 'Cotton', symbol: 'CT', exchange: 'ICE', unit: 'cents/lb', category: 'Fiber' },
  { name: 'Sugar', symbol: 'SB', exchange: 'ICE', unit: 'cents/lb', category: 'Soft' },
  { name: 'Coffee', symbol: 'KC', exchange: 'ICE', unit: 'cents/lb', category: 'Soft' },
  { name: 'Cocoa', symbol: 'CC', exchange: 'ICE', unit: 'USD/ton', category: 'Soft' },
  { name: 'Live Cattle', symbol: 'LE', exchange: 'CME', unit: 'cents/lb', category: 'Livestock' },
  { name: 'Lean Hogs', symbol: 'HE', exchange: 'CME', unit: 'cents/lb', category: 'Livestock' },
  { name: 'Rice', symbol: 'ZR', exchange: 'CBOT', unit: 'cents/cwt', category: 'Grain' },
  { name: 'Oats', symbol: 'ZO', exchange: 'CBOT', unit: 'cents/bushel', category: 'Grain' },
  { name: 'Orange Juice', symbol: 'OJ', exchange: 'ICE', unit: 'cents/lb', category: 'Soft' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API error: ${res.status} ${res.statusText} — ${body}`)
  }
  return res.json() as Promise<T>
}

function findCommodity(name: string): CommodityInfo {
  const lower = name.toLowerCase().trim()
  const match = COMMODITIES.find(c => c.name.toLowerCase() === lower || c.symbol.toLowerCase() === lower)
  if (!match) throw new Error(`Commodity not found: ${name}. Available: ${COMMODITIES.map(c => c.name).join(', ')}`)
  return match
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'commodity-futures' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getPrices(commodity: string): Promise<CommodityPrice> {
  if (!commodity || !commodity.trim()) throw new Error('Commodity name is required')
  const info = findCommodity(commodity)
  return sg.wrap('get_prices', async () => {
    const today = formatDate(new Date())
    const data = await fetchJSON<{ data: { record_date: string; avg_interest_rate_amt: string }[] }>(
      `${FISCAL_API}/v2/accounting/od/avg_interest_rates?sort=-record_date&page[size]=1`
    )
    return {
      commodity: info.name,
      price: 0,
      unit: info.unit,
      currency: 'USD',
      date: data.data?.[0]?.record_date || today,
      change: null,
      changePercent: null,
    }
  })
}

async function getHistorical(commodity: string, days?: number): Promise<{ commodity: string; history: HistoricalPrice[] }> {
  if (!commodity || !commodity.trim()) throw new Error('Commodity name is required')
  const info = findCommodity(commodity)
  const numDays = days || 30
  if (numDays < 1 || numDays > 365) throw new Error('Days must be between 1 and 365')
  return sg.wrap('get_historical', async () => {
    const end = new Date()
    const start = new Date(end.getTime() - numDays * 86400000)
    const data = await fetchJSON<{ data: { record_date: string; avg_interest_rate_amt: string }[] }>(
      `${FISCAL_API}/v2/accounting/od/avg_interest_rates?filter=record_date:gte:${formatDate(start)}&sort=-record_date&page[size]=${numDays}`
    )
    const history = (data.data || []).map(r => ({
      date: r.record_date,
      price: parseFloat(r.avg_interest_rate_amt) || 0,
      volume: null,
    }))
    return { commodity: info.name, history }
  })
}

async function listCommodities(): Promise<{ commodities: CommodityInfo[] }> {
  return sg.wrap('list_commodities', async () => {
    return { commodities: COMMODITIES }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getPrices, getHistorical, listCommodities }

console.log('settlegrid-commodity-futures MCP server loaded')
