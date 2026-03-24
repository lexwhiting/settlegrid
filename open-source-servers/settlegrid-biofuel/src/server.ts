/**
 * settlegrid-biofuel — Biofuel Production Data MCP Server
 * Wraps World Bank energy indicators with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface BiofuelRecord {
  country: string
  countryCode: string
  indicator: string
  year: number
  value: number | null
  unit: string
}

interface BiofuelCountry {
  name: string
  iso2: string
  region: string
  primaryFeedstock: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const WB_API = 'https://api.worldbank.org/v2'

const PRODUCTION_INDICATORS = [
  { code: 'EG.ELC.RNWX.ZS', name: 'Renewable energy output (% of total)', unit: '%' },
  { code: 'EG.FEC.RNEW.ZS', name: 'Renewable energy consumption (% of total)', unit: '%' },
  { code: 'AG.PRD.FOOD.XD', name: 'Food production index', unit: 'index 2014-2016=100' },
]

const CONSUMPTION_INDICATORS = [
  { code: 'EG.USE.PCAP.KG.OE', name: 'Energy use per capita', unit: 'kg oil equiv.' },
  { code: 'EG.FEC.RNEW.ZS', name: 'Renewable energy consumption (% of total)', unit: '%' },
  { code: 'EN.ATM.CO2E.PC', name: 'CO2 emissions per capita', unit: 'metric tons' },
]

const BIOFUEL_COUNTRIES: BiofuelCountry[] = [
  { name: 'United States', iso2: 'US', region: 'North America', primaryFeedstock: 'Corn (ethanol)' },
  { name: 'Brazil', iso2: 'BR', region: 'South America', primaryFeedstock: 'Sugarcane (ethanol)' },
  { name: 'Germany', iso2: 'DE', region: 'Europe', primaryFeedstock: 'Rapeseed (biodiesel)' },
  { name: 'Indonesia', iso2: 'ID', region: 'Southeast Asia', primaryFeedstock: 'Palm oil (biodiesel)' },
  { name: 'Argentina', iso2: 'AR', region: 'South America', primaryFeedstock: 'Soybean (biodiesel)' },
  { name: 'France', iso2: 'FR', region: 'Europe', primaryFeedstock: 'Sugar beet (ethanol)' },
  { name: 'China', iso2: 'CN', region: 'East Asia', primaryFeedstock: 'Corn (ethanol)' },
  { name: 'Thailand', iso2: 'TH', region: 'Southeast Asia', primaryFeedstock: 'Cassava (ethanol)' },
  { name: 'India', iso2: 'IN', region: 'South Asia', primaryFeedstock: 'Sugarcane (ethanol)' },
  { name: 'Canada', iso2: 'CA', region: 'North America', primaryFeedstock: 'Canola (biodiesel)' },
  { name: 'Spain', iso2: 'ES', region: 'Europe', primaryFeedstock: 'Used cooking oil (biodiesel)' },
  { name: 'Colombia', iso2: 'CO', region: 'South America', primaryFeedstock: 'Palm oil (biodiesel)' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────
function validateCountryCode(code: string): string {
  const upper = code.trim().toUpperCase()
  if (upper.length < 2 || upper.length > 3) throw new Error('Country code must be 2 or 3 characters')
  return upper
}

async function fetchWB<T>(path: string): Promise<T> {
  const separator = path.includes('?') ? '&' : '?'
  const url = `${WB_API}${path}${separator}format=json&per_page=100`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`World Bank API error: ${res.status} ${res.statusText} — ${body}`)
  }
  const json = await res.json()
  return (Array.isArray(json) && json.length > 1 ? json[1] : json) as T
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'biofuel' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getProduction(country?: string, year?: number): Promise<{ records: BiofuelRecord[] }> {
  return sg.wrap('get_production', async () => {
    const cc = country ? validateCountryCode(country) : 'WLD'
    const dateRange = year ? `${year}` : '2018:2024'
    const allRecords: BiofuelRecord[] = []
    for (const ind of PRODUCTION_INDICATORS) {
      const data = await fetchWB<{ country: { id: string; value: string }; date: string; value: number | null }[]>(
        `/country/${cc}/indicator/${ind.code}?date=${dateRange}`
      )
      if (Array.isArray(data)) {
        for (const d of data) {
          if (d.value !== null) {
            allRecords.push({
              country: d.country?.value || cc,
              countryCode: cc,
              indicator: ind.name,
              year: parseInt(d.date, 10),
              value: d.value,
              unit: ind.unit,
            })
          }
        }
      }
    }
    return { records: allRecords }
  })
}

async function getConsumption(country?: string, year?: number): Promise<{ records: BiofuelRecord[] }> {
  return sg.wrap('get_consumption', async () => {
    const cc = country ? validateCountryCode(country) : 'WLD'
    const dateRange = year ? `${year}` : '2018:2024'
    const allRecords: BiofuelRecord[] = []
    for (const ind of CONSUMPTION_INDICATORS) {
      const data = await fetchWB<{ country: { id: string; value: string }; date: string; value: number | null }[]>(
        `/country/${cc}/indicator/${ind.code}?date=${dateRange}`
      )
      if (Array.isArray(data)) {
        for (const d of data) {
          if (d.value !== null) {
            allRecords.push({
              country: d.country?.value || cc,
              countryCode: cc,
              indicator: ind.name,
              year: parseInt(d.date, 10),
              value: d.value,
              unit: ind.unit,
            })
          }
        }
      }
    }
    return { records: allRecords }
  })
}

async function listCountries(): Promise<{ countries: BiofuelCountry[] }> {
  return sg.wrap('list_countries', async () => {
    return { countries: BIOFUEL_COUNTRIES }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getProduction, getConsumption, listCountries }

console.log('settlegrid-biofuel MCP server loaded')
