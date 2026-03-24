/**
 * settlegrid-crop-data — Global Crop Production MCP Server
 * Wraps FAOSTAT API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface CropRecord {
  country: string
  countryCode: string
  crop: string
  year: number
  production: number | null
  yieldPerHa: number | null
  areaHarvested: number | null
  unit: string
}

interface CropInfo {
  name: string
  code: string
}

interface CountryInfo {
  name: string
  iso3: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://www.fao.org/faostat/api/v1'

const MAJOR_CROPS: CropInfo[] = [
  { name: 'Wheat', code: '0015' }, { name: 'Rice', code: '0027' },
  { name: 'Maize (Corn)', code: '0056' }, { name: 'Barley', code: '0044' },
  { name: 'Soybeans', code: '0236' }, { name: 'Sugar cane', code: '0156' },
  { name: 'Potatoes', code: '0116' }, { name: 'Cotton', code: '0328' },
  { name: 'Coffee', code: '0656' }, { name: 'Cocoa beans', code: '0661' },
  { name: 'Tea', code: '0667' }, { name: 'Tobacco', code: '0826' },
]

const MAJOR_COUNTRIES: CountryInfo[] = [
  { name: 'United States', iso3: 'USA' }, { name: 'China', iso3: 'CHN' },
  { name: 'India', iso3: 'IND' }, { name: 'Brazil', iso3: 'BRA' },
  { name: 'Russia', iso3: 'RUS' }, { name: 'France', iso3: 'FRA' },
  { name: 'Argentina', iso3: 'ARG' }, { name: 'Australia', iso3: 'AUS' },
  { name: 'Canada', iso3: 'CAN' }, { name: 'Germany', iso3: 'DEU' },
  { name: 'Indonesia', iso3: 'IDN' }, { name: 'Nigeria', iso3: 'NGA' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`FAOSTAT API error: ${res.status} ${res.statusText} — ${body}`)
  }
  return res.json() as Promise<T>
}

function findCropCode(name: string): string {
  const lower = name.toLowerCase().trim()
  const match = MAJOR_CROPS.find(c => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase()))
  return match?.code || lower
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'crop-data' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getProduction(crop: string, country?: string, year?: number): Promise<{ records: CropRecord[] }> {
  if (!crop || !crop.trim()) throw new Error('Crop name is required')
  return sg.wrap('get_production', async () => {
    const cropCode = findCropCode(crop)
    const params = new URLSearchParams({ item: cropCode, element: '5510', format: 'json' })
    if (country) params.set('area', country.trim())
    if (year) {
      if (year < 1960 || year > 2100) throw new Error('Year must be between 1960 and 2100')
      params.set('year', String(year))
    }
    const data = await fetchJSON<{ data: CropRecord[] }>(`${API}/data/QCL?${params}`)
    return { records: data.data || [] }
  })
}

async function listCrops(): Promise<{ crops: CropInfo[] }> {
  return sg.wrap('list_crops', async () => {
    return { crops: MAJOR_CROPS }
  })
}

async function listCountries(): Promise<{ countries: CountryInfo[] }> {
  return sg.wrap('list_countries', async () => {
    return { countries: MAJOR_COUNTRIES }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getProduction, listCrops, listCountries }

console.log('settlegrid-crop-data MCP server loaded')
