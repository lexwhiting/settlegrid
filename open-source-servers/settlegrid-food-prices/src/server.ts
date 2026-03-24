/**
 * settlegrid-food-prices — Global Food Prices MCP Server
 * Wraps the World Bank API for food price indicators with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface FoodPriceRecord {
  country: string
  countryCode: string
  indicator: string
  year: number
  value: number | null
}

interface FoodPriceIndex {
  year: number
  indexValue: number | null
  baseYear: string
  indicator: string
}

interface FoodCommodity {
  name: string
  indicatorCode: string
  unit: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const WB_API = 'https://api.worldbank.org/v2'

const FOOD_INDICATORS: FoodCommodity[] = [
  { name: 'Food Price Index', indicatorCode: 'FP.CPI.TOTL.ZG', unit: '% change' },
  { name: 'Consumer Price Index - Food', indicatorCode: 'FP.CPI.TOTL', unit: 'index 2010=100' },
  { name: 'Cereal Yield', indicatorCode: 'AG.YLD.CREL.KG', unit: 'kg per hectare' },
  { name: 'Food Production Index', indicatorCode: 'AG.PRD.FOOD.XD', unit: 'index 2014-2016=100' },
  { name: 'Livestock Production Index', indicatorCode: 'AG.PRD.LVSK.XD', unit: 'index 2014-2016=100' },
  { name: 'Crop Production Index', indicatorCode: 'AG.PRD.CROP.XD', unit: 'index 2014-2016=100' },
  { name: 'Agricultural Land %', indicatorCode: 'AG.LND.AGRI.ZS', unit: '% of land area' },
  { name: 'Arable Land %', indicatorCode: 'AG.LND.ARBL.ZS', unit: '% of land area' },
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
const sg = settlegrid.init({ toolSlug: 'food-prices' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getPrices(country: string, commodity?: string): Promise<{ records: FoodPriceRecord[] }> {
  const cc = validateCountryCode(country)
  return sg.wrap('get_prices', async () => {
    const indicators = commodity
      ? FOOD_INDICATORS.filter(fi => fi.name.toLowerCase().includes(commodity.toLowerCase()))
      : FOOD_INDICATORS.slice(0, 4)
    if (indicators.length === 0) throw new Error(`No indicator found for commodity: ${commodity}`)
    const allRecords: FoodPriceRecord[] = []
    for (const ind of indicators) {
      const data = await fetchWB<{ country: { id: string; value: string }; date: string; value: number | null }[]>(
        `/country/${cc}/indicator/${ind.indicatorCode}?date=2018:2024`
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
            })
          }
        }
      }
    }
    return { records: allRecords }
  })
}

async function getIndex(date?: string): Promise<{ indices: FoodPriceIndex[] }> {
  return sg.wrap('get_index', async () => {
    const year = date || '2023'
    const data = await fetchWB<{ date: string; value: number | null; indicator: { value: string } }[]>(
      `/country/WLD/indicator/FP.CPI.TOTL?date=${year}`
    )
    const indices: FoodPriceIndex[] = Array.isArray(data)
      ? data.filter(d => d.value !== null).map(d => ({
          year: parseInt(d.date, 10),
          indexValue: d.value,
          baseYear: '2010=100',
          indicator: d.indicator?.value || 'Consumer Price Index',
        }))
      : []
    return { indices }
  })
}

async function listCommodities(): Promise<{ commodities: FoodCommodity[] }> {
  return sg.wrap('list_commodities', async () => {
    return { commodities: FOOD_INDICATORS }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getPrices, getIndex, listCommodities }

console.log('settlegrid-food-prices MCP server loaded')
