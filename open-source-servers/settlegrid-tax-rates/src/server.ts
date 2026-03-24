/**
 * settlegrid-tax-rates — Global Tax Rates MCP Server
 * Wraps World Bank API for tax indicators with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface TaxRate {
  country: string
  countryName: string
  indicator: string
  value: number | null
  year: string
}

interface CountryEntry {
  code: string
  name: string
  region: string
  incomeLevel: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://api.worldbank.org/v2'
const TAX_INDICATOR = 'IC.TAX.TOTL.CP.ZS'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`World Bank API error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'tax-rates' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getRates(country: string): Promise<TaxRate[]> {
  if (!country) throw new Error('Country code is required')
  return sg.wrap('get_rates', async () => {
    const data = await fetchJSON<any[]>(
      `${API}/country/${encodeURIComponent(country.toUpperCase())}/indicator/${TAX_INDICATOR}?format=json&per_page=5&mrv=5`
    )
    return (data[1] || []).map((r: any) => ({
      country: r.country?.id || country,
      countryName: r.country?.value || '',
      indicator: r.indicator?.value || 'Total tax and contribution rate (% of profit)',
      value: r.value,
      year: r.date || '',
    }))
  })
}

async function listCountries(): Promise<CountryEntry[]> {
  return sg.wrap('list_countries', async () => {
    const data = await fetchJSON<any[]>(`${API}/country?format=json&per_page=100`)
    return (data[1] || [])
      .filter((c: any) => c.region?.id !== 'NA')
      .map((c: any) => ({
        code: c.id, name: c.name,
        region: c.region?.value || '',
        incomeLevel: c.incomeLevel?.value || '',
      }))
  })
}

async function getHistorical(country: string, years?: number): Promise<TaxRate[]> {
  if (!country) throw new Error('Country code is required')
  return sg.wrap('get_historical', async () => {
    const y = years || 10
    const data = await fetchJSON<any[]>(
      `${API}/country/${encodeURIComponent(country.toUpperCase())}/indicator/${TAX_INDICATOR}?format=json&per_page=${y}&mrv=${y}`
    )
    return (data[1] || []).map((r: any) => ({
      country: r.country?.id || country,
      countryName: r.country?.value || '',
      indicator: r.indicator?.value || '',
      value: r.value,
      year: r.date || '',
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getRates, listCountries, getHistorical }
console.log('settlegrid-tax-rates server started')
