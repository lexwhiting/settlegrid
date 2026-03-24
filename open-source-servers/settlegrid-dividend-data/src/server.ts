/**
 * settlegrid-dividend-data — Dividend Data MCP Server
 * Wraps Financial Modeling Prep API with SettleGrid billing.
 *
 * Access dividend history, current yields, and upcoming ex-dividend
 * dates for any publicly traded stock.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Dividend {
  date: string
  label: string
  adjDividend: number
  symbol: string
  dividend: number
  recordDate: string
  paymentDate: string
  declarationDate: string
}

interface DividendYield {
  symbol: string
  dividendYield: number
  price: number
  annualDividend: number
  payoutRatio: number
  exDividendDate: string
}

interface DividendHistory {
  historical: Dividend[]
  symbol: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://financialmodelingprep.com/api/v3'
const KEY = process.env.FMP_API_KEY
if (!KEY) throw new Error('FMP_API_KEY environment variable is required')

function validateSymbol(symbol: string): string {
  const s = symbol.trim().toUpperCase()
  if (!s || s.length > 10) throw new Error(`Invalid stock symbol: ${symbol}`)
  return s
}

function validateDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD.`)
  }
  return date
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
const sg = settlegrid.init({ toolSlug: 'dividend-data' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getDividends(symbol: string): Promise<Dividend[]> {
  const sym = validateSymbol(symbol)
  return sg.wrap('get_dividends', async () => {
    const data = await fetchJSON<DividendHistory>(
      `/historical-price-full/stock_dividend/${encodeURIComponent(sym)}`
    )
    return data.historical || []
  })
}

async function getYield(symbol: string): Promise<DividendYield> {
  const sym = validateSymbol(symbol)
  return sg.wrap('get_yield', async () => {
    const quotes = await fetchJSON<any[]>(`/quote/${encodeURIComponent(sym)}`)
    if (!quotes.length) throw new Error(`No data found for ${sym}`)
    const q = quotes[0]
    return {
      symbol: q.symbol,
      dividendYield: q.dividendYield || 0,
      price: q.price || 0,
      annualDividend: q.annualDividend || 0,
      payoutRatio: q.payoutRatio || 0,
      exDividendDate: q.exDividendDate || '',
    }
  })
}

async function getCalendar(date?: string): Promise<Dividend[]> {
  return sg.wrap('get_calendar', async () => {
    const d = date ? validateDate(date) : new Date().toISOString().slice(0, 10)
    const end = new Date(d)
    end.setDate(end.getDate() + 30)
    const endStr = end.toISOString().slice(0, 10)
    return fetchJSON<Dividend[]>(`/stock_dividend_calendar?from=${d}&to=${endStr}`)
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getDividends, getYield, getCalendar }
export type { Dividend, DividendYield, DividendHistory }
console.log('settlegrid-dividend-data server started')
