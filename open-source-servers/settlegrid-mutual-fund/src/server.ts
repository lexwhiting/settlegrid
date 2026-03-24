/**
 * settlegrid-mutual-fund — Mutual Fund Data MCP Server
 * Wraps Financial Modeling Prep API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface FundResult {
  symbol: string
  name: string
  currency: string
  exchange: string
}

interface FundProfile {
  symbol: string
  name: string
  price: number
  nav: number
  expenseRatio: number
  totalAssets: number
  category: string
  description: string
}

interface FundPerformance {
  symbol: string
  date: string
  close: number
  change: number
  changePercent: number
  volume: number
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
const sg = settlegrid.init({ toolSlug: 'mutual-fund' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchFunds(query: string): Promise<FundResult[]> {
  if (!query) throw new Error('Search query is required')
  return sg.wrap('search_funds', async () => {
    const data = await fetchJSON<any[]>(`/search?query=${encodeURIComponent(query)}&limit=15&exchange=MUTUAL_FUND`)
    return data.map((d: any) => ({
      symbol: d.symbol || '', name: d.name || '',
      currency: d.currency || 'USD', exchange: d.exchangeShortName || '',
    }))
  })
}

async function getFund(symbol: string): Promise<FundProfile> {
  if (!symbol) throw new Error('Fund symbol is required')
  return sg.wrap('get_fund', async () => {
    const data = await fetchJSON<any[]>(`/profile/${encodeURIComponent(symbol.toUpperCase())}`)
    if (!data.length) throw new Error(`No fund data for ${symbol}`)
    const d = data[0]
    return {
      symbol: d.symbol, name: d.companyName || '', price: d.price || 0,
      nav: d.price || 0, expenseRatio: 0, totalAssets: d.mktCap || 0,
      category: d.sector || 'Fund', description: d.description || '',
    }
  })
}

async function getPerformance(symbol: string): Promise<FundPerformance[]> {
  if (!symbol) throw new Error('Fund symbol is required')
  return sg.wrap('get_performance', async () => {
    const data = await fetchJSON<any>(`/historical-price-full/${encodeURIComponent(symbol.toUpperCase())}?timeseries=30`)
    const hist = data.historical || []
    return hist.map((d: any) => ({
      symbol: symbol.toUpperCase(), date: d.date || '',
      close: d.close || 0, change: d.change || 0,
      changePercent: d.changePercent || 0, volume: d.volume || 0,
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchFunds, getFund, getPerformance }
console.log('settlegrid-mutual-fund server started')
