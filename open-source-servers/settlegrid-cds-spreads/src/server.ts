/**
 * settlegrid-cds-spreads — Credit Default Swap Spreads MCP Server
 * Wraps World Bank API for sovereign risk indicators with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface SpreadData {
  country: string
  countryName: string
  indicator: string
  value: number | null
  date: string
}

interface CountryEntry {
  code: string
  name: string
  region: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://api.worldbank.org/v2'
const RISK_INDICATOR = 'IC.CRD.INFO.XQ'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`World Bank API error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'cds-spreads' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getSpread(country: string): Promise<SpreadData[]> {
  if (!country) throw new Error('Country code is required')
  return sg.wrap('get_spread', async () => {
    const data = await fetchJSON<any[]>(
      `${API}/country/${encodeURIComponent(country.toUpperCase())}/indicator/${RISK_INDICATOR}?format=json&per_page=5&mrv=5`
    )
    const records = data[1] || []
    return records.map((r: any) => ({
      country: r.country?.id || country,
      countryName: r.country?.value || '',
      indicator: r.indicator?.value || '',
      value: r.value,
      date: r.date || '',
    }))
  })
}

async function listCountries(): Promise<CountryEntry[]> {
  return sg.wrap('list_countries', async () => {
    const data = await fetchJSON<any[]>(`${API}/country?format=json&per_page=100`)
    const countries = data[1] || []
    return countries
      .filter((c: any) => c.region?.id !== 'NA')
      .map((c: any) => ({ code: c.id, name: c.name, region: c.region?.value || '' }))
      .slice(0, 80)
  })
}

async function getHistorical(country: string, months?: number): Promise<SpreadData[]> {
  if (!country) throw new Error('Country code is required')
  return sg.wrap('get_historical', async () => {
    const years = Math.max(1, Math.ceil((months || 12) / 12))
    const data = await fetchJSON<any[]>(
      `${API}/country/${encodeURIComponent(country.toUpperCase())}/indicator/${RISK_INDICATOR}?format=json&per_page=${years * 4}&mrv=${years * 4}`
    )
    return (data[1] || []).map((r: any) => ({
      country: r.country?.id || country,
      countryName: r.country?.value || '',
      indicator: r.indicator?.value || '',
      value: r.value,
      date: r.date || '',
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getSpread, listCountries, getHistorical }
console.log('settlegrid-cds-spreads server started')
