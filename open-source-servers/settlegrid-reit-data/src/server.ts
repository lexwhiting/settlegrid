/**
 * settlegrid-reit-data — REIT Data MCP Server
 * Wraps Financial Modeling Prep API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface REITEntry {
  symbol: string
  name: string
  price: number
  marketCap: number
  dividendYield: number
  sector: string
  exchange: string
}

interface REITDividend {
  date: string
  dividend: number
  recordDate: string
  paymentDate: string
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
const sg = settlegrid.init({ toolSlug: 'reit-data' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function listReits(sector?: string): Promise<REITEntry[]> {
  return sg.wrap('list_reits', async () => {
    const params = new URLSearchParams({ sector: 'Real Estate', limit: '30', isEtf: 'false' })
    const data = await fetchJSON<any[]>(`/stock-screener?${params.toString()}`)
    let results = data.map((d: any) => ({
      symbol: d.symbol, name: d.companyName || '', price: d.price || 0,
      marketCap: d.marketCap || 0, dividendYield: d.lastAnnualDividend || 0,
      sector: d.industry || 'Real Estate', exchange: d.exchange || '',
    }))
    if (sector) {
      const s = sector.toLowerCase()
      results = results.filter((r: REITEntry) => r.sector.toLowerCase().includes(s) || r.name.toLowerCase().includes(s))
    }
    return results
  })
}

async function getReit(symbol: string): Promise<REITEntry> {
  if (!symbol) throw new Error('REIT symbol is required')
  return sg.wrap('get_reit', async () => {
    const data = await fetchJSON<any[]>(`/profile/${encodeURIComponent(symbol.toUpperCase())}`)
    if (!data.length) throw new Error(`No REIT data for ${symbol}`)
    const d = data[0]
    return {
      symbol: d.symbol, name: d.companyName || '', price: d.price || 0,
      marketCap: d.mktCap || 0, dividendYield: d.lastDiv || 0,
      sector: d.industry || 'Real Estate', exchange: d.exchangeShortName || '',
    }
  })
}

async function getDividends(symbol: string): Promise<REITDividend[]> {
  if (!symbol) throw new Error('REIT symbol is required')
  return sg.wrap('get_dividends', async () => {
    const data = await fetchJSON<any>(`/historical-price-full/stock_dividend/${encodeURIComponent(symbol.toUpperCase())}`)
    const hist = data.historical || (Array.isArray(data) ? data : [])
    return hist.slice(0, 20).map((d: any) => ({
      date: d.date || '', dividend: d.dividend || d.adjDividend || 0,
      recordDate: d.recordDate || '', paymentDate: d.paymentDate || '',
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { listReits, getReit, getDividends }
console.log('settlegrid-reit-data server started')
