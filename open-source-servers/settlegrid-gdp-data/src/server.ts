/**
 * settlegrid-gdp-data — GDP Data MCP Server
 * Wraps World Bank GDP indicators API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface GDPData {
  country: string
  countryName: string
  gdp: number | null
  year: string
  unit: string
}

interface GDPGrowth {
  country: string
  countryName: string
  growthRate: number | null
  year: string
}

interface GDPRanking {
  rank: number
  country: string
  countryName: string
  gdp: number
  year: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://api.worldbank.org/v2'
const GDP_INDICATOR = 'NY.GDP.MKTP.CD'
const GROWTH_INDICATOR = 'NY.GDP.MKTP.KD.ZG'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`World Bank API error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'gdp-data' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getGDP(country: string, year?: string): Promise<GDPData> {
  if (!country) throw new Error('Country code is required')
  return sg.wrap('get_gdp', async () => {
    const dateParam = year ? `&date=${year}` : '&mrv=1'
    const data = await fetchJSON<any[]>(
      `${API}/country/${encodeURIComponent(country.toUpperCase())}/indicator/${GDP_INDICATOR}?format=json&per_page=1${dateParam}`
    )
    const r = (data[1] || [])[0]
    if (!r) throw new Error(`No GDP data for ${country}`)
    return {
      country: r.country?.id || country,
      countryName: r.country?.value || '',
      gdp: r.value,
      year: r.date || '',
      unit: 'current USD',
    }
  })
}

async function getGrowth(country: string, years?: number): Promise<GDPGrowth[]> {
  if (!country) throw new Error('Country code is required')
  return sg.wrap('get_growth', async () => {
    const y = years || 5
    const data = await fetchJSON<any[]>(
      `${API}/country/${encodeURIComponent(country.toUpperCase())}/indicator/${GROWTH_INDICATOR}?format=json&per_page=${y}&mrv=${y}`
    )
    return (data[1] || []).map((r: any) => ({
      country: r.country?.id || country,
      countryName: r.country?.value || '',
      growthRate: r.value,
      year: r.date || '',
    }))
  })
}

async function getRankings(year?: string): Promise<GDPRanking[]> {
  return sg.wrap('get_rankings', async () => {
    const dateParam = year ? `&date=${year}` : '&mrv=1'
    const data = await fetchJSON<any[]>(
      `${API}/country/all/indicator/${GDP_INDICATOR}?format=json&per_page=300${dateParam}`
    )
    const records = (data[1] || [])
      .filter((r: any) => r.value !== null && r.country?.id?.length === 2)
      .sort((a: any, b: any) => (b.value || 0) - (a.value || 0))
      .slice(0, 30)
    return records.map((r: any, i: number) => ({
      rank: i + 1,
      country: r.country?.id || '',
      countryName: r.country?.value || '',
      gdp: r.value || 0,
      year: r.date || '',
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getGDP, getGrowth, getRankings }
console.log('settlegrid-gdp-data server started')
