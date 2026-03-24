/**
 * settlegrid-inflation — Inflation Rate Data MCP Server
 * Wraps World Bank CPI indicator API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface InflationData {
  country: string
  countryName: string
  value: number | null
  year: string
  indicator: string
}

interface ComparisonEntry {
  country: string
  countryName: string
  latestRate: number | null
  year: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://api.worldbank.org/v2'
const CPI_INDICATOR = 'FP.CPI.TOTL.ZG'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`World Bank API error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'inflation' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getRate(country: string, year?: string): Promise<InflationData> {
  if (!country) throw new Error('Country code is required')
  return sg.wrap('get_rate', async () => {
    const dateParam = year ? `&date=${year}` : '&mrv=1'
    const data = await fetchJSON<any[]>(
      `${API}/country/${encodeURIComponent(country.toUpperCase())}/indicator/${CPI_INDICATOR}?format=json&per_page=1${dateParam}`
    )
    const record = (data[1] || [])[0]
    if (!record) throw new Error(`No inflation data for ${country}`)
    return {
      country: record.country?.id || country,
      countryName: record.country?.value || '',
      value: record.value,
      year: record.date || '',
      indicator: 'Inflation, consumer prices (annual %)',
    }
  })
}

async function getComparison(countries: string): Promise<ComparisonEntry[]> {
  if (!countries) throw new Error('Country codes required (semicolon-separated, e.g., US;GB;DE)')
  return sg.wrap('get_comparison', async () => {
    const codes = countries.split(';').map(c => c.trim().toUpperCase()).join(';')
    const data = await fetchJSON<any[]>(
      `${API}/country/${codes}/indicator/${CPI_INDICATOR}?format=json&mrv=1&per_page=50`
    )
    return (data[1] || []).map((r: any) => ({
      country: r.country?.id || '',
      countryName: r.country?.value || '',
      latestRate: r.value,
      year: r.date || '',
    }))
  })
}

async function getHistorical(country: string, years?: number): Promise<InflationData[]> {
  if (!country) throw new Error('Country code is required')
  return sg.wrap('get_historical', async () => {
    const y = years || 10
    const data = await fetchJSON<any[]>(
      `${API}/country/${encodeURIComponent(country.toUpperCase())}/indicator/${CPI_INDICATOR}?format=json&per_page=${y}&mrv=${y}`
    )
    return (data[1] || []).map((r: any) => ({
      country: r.country?.id || country,
      countryName: r.country?.value || '',
      value: r.value,
      year: r.date || '',
      indicator: 'Inflation, consumer prices (annual %)',
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getRate, getComparison, getHistorical }
console.log('settlegrid-inflation server started')
