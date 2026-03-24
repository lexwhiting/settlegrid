/**
 * settlegrid-etf-data — ETF Data MCP Server
 * Wraps Financial Modeling Prep API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface ETFHolding {
  asset: string
  name: string
  weight: number
  sharesNumber: number
}

interface ETFProfile {
  symbol: string
  name: string
  price: number
  expenseRatio: number
  aum: number
  avgVolume: number
  sector: string
  description: string
}

interface ETFSearch {
  symbol: string
  name: string
  exchange: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://financialmodelingprep.com/api/v3'
const KEY = process.env.FMP_API_KEY
if (!KEY) throw new Error('FMP_API_KEY environment variable is required')

async function fetchJSON<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${API}${path}${sep}apikey=${KEY}`)
  if (!res.ok) throw new Error(`FMP API error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'etf-data' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getHoldings(symbol: string, limit?: number): Promise<ETFHolding[]> {
  if (!symbol) throw new Error('ETF symbol is required')
  return sg.wrap('get_holdings', async () => {
    const data = await fetchJSON<any[]>(`/etf-holder/${encodeURIComponent(symbol.toUpperCase())}`)
    return data.slice(0, limit || 20).map((d: any) => ({
      asset: d.asset || '', name: d.name || '',
      weight: d.weightPercentage ? parseFloat(d.weightPercentage) : 0,
      sharesNumber: d.sharesNumber || 0,
    }))
  })
}

async function getProfile(symbol: string): Promise<ETFProfile> {
  if (!symbol) throw new Error('ETF symbol is required')
  return sg.wrap('get_profile', async () => {
    const data = await fetchJSON<any[]>(`/profile/${encodeURIComponent(symbol.toUpperCase())}`)
    if (!data.length) throw new Error(`No profile for ${symbol}`)
    const d = data[0]
    return {
      symbol: d.symbol, name: d.companyName || '', price: d.price || 0,
      expenseRatio: d.lastDiv || 0, aum: d.mktCap || 0, avgVolume: d.volAvg || 0,
      sector: d.sector || 'ETF', description: d.description || '',
    }
  })
}

async function searchETFs(query: string): Promise<ETFSearch[]> {
  if (!query) throw new Error('Search query is required')
  return sg.wrap('search_etfs', async () => {
    const data = await fetchJSON<any[]>(`/search?query=${encodeURIComponent(query)}&limit=15&exchange=ETF`)
    return data.map((d: any) => ({
      symbol: d.symbol || '', name: d.name || '', exchange: d.exchangeShortName || '',
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getHoldings, getProfile, searchETFs }
console.log('settlegrid-etf-data server started')
