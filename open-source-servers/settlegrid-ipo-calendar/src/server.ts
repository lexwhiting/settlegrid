/**
 * settlegrid-ipo-calendar — IPO Calendar MCP Server
 * Wraps Finnhub API with SettleGrid billing.
 *
 * Track upcoming initial public offerings, browse recent IPOs,
 * and search for specific company listings by name or ticker.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface IPO {
  symbol: string
  name: string
  date: string
  exchange: string
  numberOfShares: number
  price: string
  status: string
  totalSharesValue: number
}

interface IPOCalendar {
  ipoCalendar: IPO[]
}

interface IPOSummary {
  total: number
  upcoming: number
  recent: number
  dateRange: { from: string; to: string }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://finnhub.io/api/v1'
const KEY = process.env.FINNHUB_API_KEY
if (!KEY) throw new Error('FINNHUB_API_KEY environment variable is required')

function dateStr(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
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
const sg = settlegrid.init({ toolSlug: 'ipo-calendar' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getUpcoming(from?: string, to?: string): Promise<IPO[]> {
  return sg.wrap('get_upcoming', async () => {
    const f = from ? validateDate(from) : dateStr(0)
    const t = to ? validateDate(to) : dateStr(90)
    if (f > t) throw new Error('Start date must be before end date')
    const data = await fetchJSON<IPOCalendar>(`/calendar/ipo?from=${f}&to=${t}`)
    return (data.ipoCalendar || []).sort((a, b) => a.date.localeCompare(b.date))
  })
}

async function getRecent(limit?: number): Promise<IPO[]> {
  const maxResults = Math.min(Math.max(limit || 10, 1), 50)
  return sg.wrap('get_recent', async () => {
    const f = dateStr(-90)
    const t = dateStr(0)
    const data = await fetchJSON<IPOCalendar>(`/calendar/ipo?from=${f}&to=${t}`)
    const ipos = data.ipoCalendar || []
    return ipos
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, maxResults)
  })
}

async function searchIpos(query?: string): Promise<IPO[]> {
  return sg.wrap('search_ipos', async () => {
    const f = dateStr(-180)
    const t = dateStr(90)
    const data = await fetchJSON<IPOCalendar>(`/calendar/ipo?from=${f}&to=${t}`)
    const ipos = data.ipoCalendar || []
    if (!query || query.trim().length === 0) return ipos.slice(0, 20)
    const q = query.trim().toLowerCase()
    return ipos.filter((i: IPO) =>
      i.name?.toLowerCase().includes(q) ||
      i.symbol?.toLowerCase().includes(q)
    )
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getUpcoming, getRecent, searchIpos }
export type { IPO, IPOCalendar, IPOSummary }
console.log('settlegrid-ipo-calendar server started')
