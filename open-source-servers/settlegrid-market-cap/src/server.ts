/**
 * settlegrid-market-cap — Market Capitalization MCP Server
 * Wraps Financial Modeling Prep API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface MarketCapEntry {
  symbol: string
  name: string
  marketCap: number
  price: number
  sector: string
  country: string
}

interface HistoricalMarketCap {
  symbol: string
  date: string
  marketCap: number
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
const sg = settlegrid.init({ toolSlug: 'market-cap' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getTop(limit?: number, sector?: string): Promise<MarketCapEntry[]> {
  return sg.wrap('get_top', async () => {
    const params = new URLSearchParams()
    if (sector) params.set('sector', sector)
    params.set('limit', String(limit || 20))
    const data = await fetchJSON<any[]>(`/stock-screener?${params.toString()}`)
    return data.sort((a: any, b: any) => (b.marketCap || 0) - (a.marketCap || 0))
      .slice(0, limit || 20)
      .map((d: any) => ({
        symbol: d.symbol, name: d.companyName || '', marketCap: d.marketCap || 0,
        price: d.price || 0, sector: d.sector || '', country: d.country || '',
      }))
  })
}

async function getCompany(symbol: string): Promise<MarketCapEntry> {
  if (!symbol) throw new Error('Stock symbol is required')
  return sg.wrap('get_company', async () => {
    const data = await fetchJSON<any[]>(`/profile/${encodeURIComponent(symbol.toUpperCase())}`)
    if (!data.length) throw new Error(`No data for ${symbol}`)
    const d = data[0]
    return {
      symbol: d.symbol, name: d.companyName || '', marketCap: d.mktCap || 0,
      price: d.price || 0, sector: d.sector || '', country: d.country || '',
    }
  })
}

async function getHistorical(symbol: string): Promise<HistoricalMarketCap[]> {
  if (!symbol) throw new Error('Stock symbol is required')
  return sg.wrap('get_historical', async () => {
    const data = await fetchJSON<any>(`/historical-market-capitalization/${encodeURIComponent(symbol.toUpperCase())}?limit=60`)
    return (Array.isArray(data) ? data : []).map((d: any) => ({
      symbol: d.symbol || symbol.toUpperCase(),
      date: d.date || '',
      marketCap: d.marketCap || 0,
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getTop, getCompany, getHistorical }
console.log('settlegrid-market-cap server started')
