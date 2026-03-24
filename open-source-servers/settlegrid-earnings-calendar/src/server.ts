/**
 * settlegrid-earnings-calendar — Earnings Calendar MCP Server
 * Wraps Finnhub API with SettleGrid billing.
 *
 * Track quarterly earnings announcements, view historical
 * earnings data, and monitor earnings surprises (beats/misses).
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface EarningsEvent {
  date: string
  epsActual: number | null
  epsEstimate: number | null
  hour: string
  quarter: number
  revenueActual: number | null
  revenueEstimate: number | null
  symbol: string
  year: number
}

interface EarningsCalendarResponse {
  earningsCalendar: EarningsEvent[]
}

interface EarningsSurprise {
  actual: number
  estimate: number
  period: string
  quarter: number
  surprise: number
  surprisePercent: number
  symbol: string
  beat: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://finnhub.io/api/v1'
const KEY = process.env.FINNHUB_API_KEY
if (!KEY) throw new Error('FINNHUB_API_KEY environment variable is required')

function dateStr(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

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
  const res = await fetch(`${API}${path}${sep}token=${KEY}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Finnhub API error: ${res.status} ${res.statusText} ${body}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'earnings-calendar' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getUpcoming(from?: string, to?: string): Promise<EarningsEvent[]> {
  return sg.wrap('get_upcoming', async () => {
    const f = from ? validateDate(from) : dateStr(0)
    const t = to ? validateDate(to) : dateStr(14)
    if (f > t) throw new Error('Start date must be before end date')
    const data = await fetchJSON<EarningsCalendarResponse>(
      `/calendar/earnings?from=${f}&to=${t}`
    )
    return (data.earningsCalendar || []).sort((a, b) => a.date.localeCompare(b.date))
  })
}

async function getEarnings(symbol: string): Promise<EarningsEvent[]> {
  const sym = validateSymbol(symbol)
  return sg.wrap('get_earnings', async () => {
    const data = await fetchJSON<EarningsEvent[]>(
      `/stock/earnings?symbol=${encodeURIComponent(sym)}`
    )
    return Array.isArray(data) ? data : []
  })
}

async function getSurprises(symbol: string): Promise<EarningsSurprise[]> {
  const sym = validateSymbol(symbol)
  return sg.wrap('get_surprises', async () => {
    const data = await fetchJSON<any[]>(
      `/stock/earnings?symbol=${encodeURIComponent(sym)}`
    )
    return (Array.isArray(data) ? data : []).map((e: any) => ({
      actual: e.actual ?? 0,
      estimate: e.estimate ?? 0,
      period: e.period || '',
      quarter: e.quarter || 0,
      surprise: e.surprise ?? 0,
      surprisePercent: e.surprisePercent ?? 0,
      symbol: sym,
      beat: (e.actual ?? 0) > (e.estimate ?? 0),
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getUpcoming, getEarnings, getSurprises }
export type { EarningsEvent, EarningsSurprise }
console.log('settlegrid-earnings-calendar server started')
