/**
 * settlegrid-economic-calendar — Economic Calendar MCP Server
 * Wraps Finnhub API with SettleGrid billing.
 *
 * Track global economic events including CPI releases, GDP reports,
 * employment data, central bank decisions, and more.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface EconomicEvent {
  actual: number | null
  country: string
  estimate: number | null
  event: string
  impact: string
  prev: number | null
  time: string
  unit: string
}

interface EconomicCalendarResponse {
  economicCalendar: EconomicEvent[]
}

interface CountryInfo {
  code: string
  name: string
  region: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://finnhub.io/api/v1'
const KEY = process.env.FINNHUB_API_KEY
if (!KEY) throw new Error('FINNHUB_API_KEY environment variable is required')

const COUNTRY_MAP: Record<string, { name: string; region: string }> = {
  US: { name: 'United States', region: 'Americas' },
  GB: { name: 'United Kingdom', region: 'Europe' },
  DE: { name: 'Germany', region: 'Europe' },
  FR: { name: 'France', region: 'Europe' },
  JP: { name: 'Japan', region: 'Asia-Pacific' },
  CN: { name: 'China', region: 'Asia-Pacific' },
  CA: { name: 'Canada', region: 'Americas' },
  AU: { name: 'Australia', region: 'Asia-Pacific' },
  CH: { name: 'Switzerland', region: 'Europe' },
  IT: { name: 'Italy', region: 'Europe' },
  ES: { name: 'Spain', region: 'Europe' },
  BR: { name: 'Brazil', region: 'Americas' },
  IN: { name: 'India', region: 'Asia-Pacific' },
  KR: { name: 'South Korea', region: 'Asia-Pacific' },
  MX: { name: 'Mexico', region: 'Americas' },
  ZA: { name: 'South Africa', region: 'Africa' },
  SE: { name: 'Sweden', region: 'Europe' },
  NO: { name: 'Norway', region: 'Europe' },
  NZ: { name: 'New Zealand', region: 'Asia-Pacific' },
  RU: { name: 'Russia', region: 'Europe' },
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function dateStr(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
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
const sg = settlegrid.init({ toolSlug: 'economic-calendar' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getEvents(from?: string, to?: string, country?: string): Promise<EconomicEvent[]> {
  return sg.wrap('get_events', async () => {
    const f = from ? validateDate(from) : dateStr(0)
    const t = to ? validateDate(to) : dateStr(7)
    if (f > t) throw new Error('Start date must be before end date')
    const data = await fetchJSON<EconomicCalendarResponse>(`/calendar/economic?from=${f}&to=${t}`)
    let events = data.economicCalendar || []
    if (country) {
      const cc = country.toUpperCase()
      events = events.filter((e: EconomicEvent) => e.country?.toUpperCase() === cc)
    }
    return events
  })
}

async function getIndicators(country: string): Promise<EconomicEvent[]> {
  if (!country) throw new Error('Country code is required (e.g., US, GB, DE)')
  return sg.wrap('get_indicators', async () => {
    const cc = country.toUpperCase()
    const f = dateStr(-30)
    const t = dateStr(0)
    const data = await fetchJSON<EconomicCalendarResponse>(`/calendar/economic?from=${f}&to=${t}`)
    return (data.economicCalendar || []).filter(
      (e: EconomicEvent) => e.country?.toUpperCase() === cc
    )
  })
}

async function listCountries(): Promise<CountryInfo[]> {
  return sg.wrap('list_countries', async () => {
    return Object.entries(COUNTRY_MAP).map(([code, info]) => ({
      code,
      name: info.name,
      region: info.region,
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getEvents, getIndicators, listCountries }
export type { EconomicEvent, CountryInfo }
console.log('settlegrid-economic-calendar server started')
