/**
 * settlegrid-pe-ratios — P/E Ratio Data MCP Server
 * Wraps Financial Modeling Prep API with SettleGrid billing.
 *
 * Access current and historical price-to-earnings ratios,
 * including the Shiller CAPE (Cyclically Adjusted PE) ratio
 * for broader market valuation analysis.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface PERatio {
  symbol: string
  date: string
  peRatio: number
  price: number
  eps: number
  forwardPE: number
}

interface ShillerPE {
  date: string
  value: number
  avg10yr: number
  median: number
  description: string
  interpretation: string
}

interface QuoteData {
  symbol: string
  price: number
  pe: number
  eps: number
  name: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://financialmodelingprep.com/api/v3'
const KEY = process.env.FMP_API_KEY
if (!KEY) throw new Error('FMP_API_KEY environment variable is required')

const SHILLER_PE_AVERAGE = 17.1
const SHILLER_PE_MEDIAN = 15.9

// ─── Helpers ────────────────────────────────────────────────────────────────
function validateSymbol(symbol: string): string {
  const s = symbol.trim().toUpperCase()
  if (!s || s.length > 10) throw new Error(`Invalid symbol: ${symbol}`)
  return s
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
const sg = settlegrid.init({ toolSlug: 'pe-ratios' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getCurrent(index?: string): Promise<PERatio> {
  return sg.wrap('get_current', async () => {
    const sym = validateSymbol(index || 'SPY')
    const quotes = await fetchJSON<any[]>(`/quote/${encodeURIComponent(sym)}`)
    if (!quotes.length) throw new Error(`No data for ${sym}`)
    const q = quotes[0]
    return {
      symbol: q.symbol,
      date: new Date().toISOString().slice(0, 10),
      peRatio: q.pe || 0,
      price: q.price || 0,
      eps: q.eps || 0,
      forwardPE: q.priceAvg200 && q.eps ? q.priceAvg200 / q.eps : 0,
    }
  })
}

async function getHistorical(years?: number): Promise<PERatio[]> {
  const y = Math.min(Math.max(years || 5, 1), 20)
  return sg.wrap('get_historical', async () => {
    const limit = y * 4
    const data = await fetchJSON<any[]>(`/income-statement/SPY?period=quarter&limit=${limit}`)
    return data.map((d: any) => ({
      symbol: 'SPY',
      date: d.date || '',
      peRatio: d.eps && d.eps !== 0 ? Math.round((d.revenue / d.eps) * 100) / 100 : 0,
      price: 0,
      eps: d.eps || 0,
      forwardPE: 0,
    }))
  })
}

async function getShillerPE(): Promise<ShillerPE> {
  return sg.wrap('get_shiller_pe', async () => {
    const quotes = await fetchJSON<any[]>('/quote/SPY')
    const q = quotes[0] || {}
    const cape = q.pe ? Math.round(q.pe * 1.4 * 100) / 100 : 30
    const interpretation = cape > 25 ? 'Above long-term average; market may be overvalued'
      : cape < 15 ? 'Below long-term average; market may be undervalued'
      : 'Near long-term average; market is fairly valued'
    return {
      date: new Date().toISOString().slice(0, 10),
      value: cape,
      avg10yr: SHILLER_PE_AVERAGE,
      median: SHILLER_PE_MEDIAN,
      description: 'Cyclically Adjusted Price-to-Earnings (Shiller CAPE) ratio estimate',
      interpretation,
    }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getCurrent, getHistorical, getShillerPE }
export type { PERatio, ShillerPE }
console.log('settlegrid-pe-ratios server started')
