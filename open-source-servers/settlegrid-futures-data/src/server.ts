/**
 * settlegrid-futures-data — Futures Market Data MCP Server
 * Wraps CME Group data with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface FuturesQuote {
  symbol: string
  name: string
  last: number
  change: number
  changePercent: number
  volume: number
  openInterest: number
  expiration: string
  category: string
}

interface Category {
  id: string
  name: string
  description: string
  symbols: string[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://www.cmegroup.com/CmeWS/mvc/Quotes/Future'
const CATEGORIES: Record<string, { name: string; groupId: string; symbols: string[] }> = {
  agriculture: { name: 'Agriculture', groupId: '1', symbols: ['ZC', 'ZW', 'ZS', 'ZM', 'ZL', 'KC', 'SB'] },
  energy: { name: 'Energy', groupId: '2', symbols: ['CL', 'NG', 'RB', 'HO', 'BZ'] },
  metals: { name: 'Metals', groupId: '3', symbols: ['GC', 'SI', 'HG', 'PL', 'PA'] },
  indices: { name: 'Equity Indices', groupId: '4', symbols: ['ES', 'NQ', 'YM', 'RTY'] },
  fx: { name: 'FX', groupId: '5', symbols: ['6E', '6J', '6B', '6A', '6C'] },
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'SettleGrid/1.0' } })
  if (!res.ok) throw new Error(`CME API error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'futures-data' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getQuotes(category?: string): Promise<FuturesQuote[]> {
  return sg.wrap('get_quotes', async () => {
    const cat = category?.toLowerCase() || 'indices'
    const info = CATEGORIES[cat]
    if (!info) throw new Error(`Unknown category: ${category}. Valid: ${Object.keys(CATEGORIES).join(', ')}`)
    const data = await fetchJSON<any>(`${API}/${info.groupId}/G`)
    const quotes = data.quotes || []
    return quotes.slice(0, 20).map((q: any) => ({
      symbol: q.quoteCode || '', name: q.quoteName || '', last: parseFloat(q.last) || 0,
      change: parseFloat(q.change) || 0, changePercent: parseFloat(q.percentageChange) || 0,
      volume: parseInt(q.volume) || 0, openInterest: parseInt(q.openInterest) || 0,
      expiration: q.expirationDate || '', category: cat,
    }))
  })
}

async function getContract(symbol: string): Promise<FuturesQuote> {
  if (!symbol) throw new Error('Futures symbol is required')
  return sg.wrap('get_contract', async () => {
    for (const [cat, info] of Object.entries(CATEGORIES)) {
      if (info.symbols.includes(symbol.toUpperCase())) {
        const data = await fetchJSON<any>(`${API}/${info.groupId}/G`)
        const q = (data.quotes || []).find((q: any) => q.quoteCode?.startsWith(symbol.toUpperCase()))
        if (q) return {
          symbol: q.quoteCode, name: q.quoteName, last: parseFloat(q.last) || 0,
          change: parseFloat(q.change) || 0, changePercent: parseFloat(q.percentageChange) || 0,
          volume: parseInt(q.volume) || 0, openInterest: parseInt(q.openInterest) || 0,
          expiration: q.expirationDate || '', category: cat,
        }
      }
    }
    throw new Error(`Contract not found: ${symbol}`)
  })
}

async function listCategories(): Promise<Category[]> {
  return sg.wrap('list_categories', async () => {
    return Object.entries(CATEGORIES).map(([id, c]) => ({
      id, name: c.name, description: `${c.name} futures contracts`, symbols: c.symbols,
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getQuotes, getContract, listCategories }
console.log('settlegrid-futures-data server started')
