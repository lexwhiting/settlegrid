/**
 * settlegrid-stock-screener — Stock Screener MCP Server
 * Wraps Financial Modeling Prep API with SettleGrid billing.
 *
 * Screen stocks by market cap, sector, and other criteria.
 * Get real-time quotes and search by company name or ticker.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface StockQuote {
  symbol: string
  name: string
  price: number
  change: number
  changesPercentage: number
  marketCap: number
  volume: number
  exchange: string
  dayHigh: number
  dayLow: number
  yearHigh: number
  yearLow: number
}

interface SearchResult {
  symbol: string
  name: string
  currency: string
  stockExchange: string
  exchangeShortName: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://financialmodelingprep.com/api/v3'
const KEY = process.env.FMP_API_KEY
if (!KEY) throw new Error('FMP_API_KEY environment variable is required')

const VALID_SECTORS = [
  'Technology', 'Healthcare', 'Financial Services', 'Consumer Cyclical',
  'Communication Services', 'Industrials', 'Consumer Defensive', 'Energy',
  'Basic Materials', 'Real Estate', 'Utilities',
]

// ─── Helpers ────────────────────────────────────────────────────────────────
function validateSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase()
  if (!upper || upper.length > 10) throw new Error(`Invalid stock symbol: ${symbol}`)
  return upper
}

async function fetchJSON<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${API}${path}${sep}apikey=${KEY}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`FMP API error: ${res.status} ${res.statusText} ${body}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'stock-screener' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function screenStocks(marketCapGt?: number, sector?: string): Promise<StockQuote[]> {
  return sg.wrap('screen_stocks', async () => {
    const params = new URLSearchParams()
    if (marketCapGt) {
      if (marketCapGt < 0) throw new Error('Market cap filter must be positive')
      params.set('marketCapMoreThan', String(marketCapGt))
    }
    if (sector) {
      if (!VALID_SECTORS.some(s => s.toLowerCase() === sector.toLowerCase())) {
        throw new Error(`Invalid sector. Valid: ${VALID_SECTORS.join(', ')}`)
      }
      params.set('sector', sector)
    }
    params.set('limit', '20')
    return fetchJSON<StockQuote[]>(`/stock-screener?${params.toString()}`)
  })
}

async function getQuote(symbol: string): Promise<StockQuote> {
  const sym = validateSymbol(symbol)
  return sg.wrap('get_quote', async () => {
    const data = await fetchJSON<StockQuote[]>(`/quote/${encodeURIComponent(sym)}`)
    if (!data.length) throw new Error(`No quote found for ${sym}`)
    return data[0]
  })
}

async function searchStocks(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 1) throw new Error('Search query is required')
  return sg.wrap('search_stocks', async () => {
    return fetchJSON<SearchResult[]>(`/search?query=${encodeURIComponent(query.trim())}&limit=10`)
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { screenStocks, getQuote, searchStocks, VALID_SECTORS }
export type { StockQuote, SearchResult }
console.log('settlegrid-stock-screener server started')
