/**
 * settlegrid-unemployment — Unemployment Data MCP Server
 * Wraps World Bank unemployment indicator API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface UnemploymentData {
  country: string
  countryName: string
  rate: number | null
  year: string
  indicator: string
}

interface UnemploymentRanking {
  rank: number
  country: string
  countryName: string
  rate: number
  year: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://api.worldbank.org/v2'
const UNEMP_INDICATOR = 'SL.UEM.TOTL.ZS'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`World Bank API error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'unemployment' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getRate(country: string, year?: string): Promise<UnemploymentData> {
  if (!country) throw new Error('Country code is required')
  return sg.wrap('get_rate', async () => {
    const dateParam = year ? `&date=${year}` : '&mrv=1'
    const data = await fetchJSON<any[]>(
      `${API}/country/${encodeURIComponent(country.toUpperCase())}/indicator/${UNEMP_INDICATOR}?format=json&per_page=1${dateParam}`
    )
    const r = (data[1] || [])[0]
    if (!r) throw new Error(`No unemployment data for ${country}`)
    return {
      country: r.country?.id || country,
      countryName: r.country?.value || '',
      rate: r.value,
      year: r.date || '',
      indicator: 'Unemployment, total (% of total labor force)',
    }
  })
}

async function getHistorical(country: string, years?: number): Promise<UnemploymentData[]> {
  if (!country) throw new Error('Country code is required')
  return sg.wrap('get_historical', async () => {
    const y = years || 10
    const data = await fetchJSON<any[]>(
      `${API}/country/${encodeURIComponent(country.toUpperCase())}/indicator/${UNEMP_INDICATOR}?format=json&per_page=${y}&mrv=${y}`
    )
    return (data[1] || []).map((r: any) => ({
      country: r.country?.id || country,
      countryName: r.country?.value || '',
      rate: r.value,
      year: r.date || '',
      indicator: 'Unemployment, total (% of total labor force)',
    }))
  })
}

async function getRankings(year?: string): Promise<UnemploymentRanking[]> {
  return sg.wrap('get_rankings', async () => {
    const dateParam = year ? `&date=${year}` : '&mrv=1'
    const data = await fetchJSON<any[]>(
      `${API}/country/all/indicator/${UNEMP_INDICATOR}?format=json&per_page=300${dateParam}`
    )
    const records = (data[1] || [])
      .filter((r: any) => r.value !== null && r.country?.id?.length === 2)
      .sort((a: any, b: any) => (a.value || 0) - (b.value || 0))
      .slice(0, 30)
    return records.map((r: any, i: number) => ({
      rank: i + 1,
      country: r.country?.id || '',
      countryName: r.country?.value || '',
      rate: r.value || 0,
      year: r.date || '',
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getRate, getHistorical, getRankings }
console.log('settlegrid-unemployment server started')
