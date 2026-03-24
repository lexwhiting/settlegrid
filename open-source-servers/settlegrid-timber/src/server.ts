/**
 * settlegrid-timber — Timber and Forestry Data MCP Server
 * Wraps FAOSTAT forestry data with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface TimberRecord {
  country: string
  product: string
  year: number
  production: number | null
  unit: string
  element: string
}

interface TimberProduct {
  name: string
  code: string
  description: string
  unit: string
}

interface TradeRecord {
  country: string
  product: string
  year: number
  importQty: number | null
  exportQty: number | null
  importValue: number | null
  exportValue: number | null
  unit: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const FAO_API = 'https://www.fao.org/faostat/api/v1'

const TIMBER_PRODUCTS: TimberProduct[] = [
  { name: 'Industrial Roundwood', code: '1861', description: 'Logs for industrial use', unit: 'm3' },
  { name: 'Fuel Wood', code: '1864', description: 'Wood used for fuel', unit: 'm3' },
  { name: 'Sawnwood', code: '1872', description: 'Wood sawn lengthwise', unit: 'm3' },
  { name: 'Plywood', code: '1873', description: 'Veneer sheets bonded together', unit: 'm3' },
  { name: 'Particle Board', code: '1874', description: 'Engineered wood product', unit: 'm3' },
  { name: 'Fibreboard', code: '1875', description: 'Engineered wood from fibers', unit: 'm3' },
  { name: 'Wood Pulp', code: '1876', description: 'Pulp for paper production', unit: 'tonnes' },
  { name: 'Paper and Paperboard', code: '1877', description: 'All types of paper products', unit: 'tonnes' },
  { name: 'Wood Charcoal', code: '1630', description: 'Carbonized wood product', unit: 'tonnes' },
  { name: 'Veneer Sheets', code: '1871', description: 'Thin wood sheets', unit: 'm3' },
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

function findProductCode(name: string): string | undefined {
  const lower = name.toLowerCase().trim()
  const match = TIMBER_PRODUCTS.find(p => p.name.toLowerCase().includes(lower) || lower.includes(p.name.toLowerCase()))
  return match?.code
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'timber' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getProduction(country?: string, product?: string, year?: number): Promise<{ records: TimberRecord[] }> {
  return sg.wrap('get_production', async () => {
    const params = new URLSearchParams({ element: '5516', format: 'json' })
    if (country) params.set('area', country.trim())
    if (product) {
      const code = findProductCode(product)
      if (code) params.set('item', code)
      else params.set('item', product.trim())
    }
    if (year) {
      if (year < 1960 || year > 2100) throw new Error('Year must be between 1960 and 2100')
      params.set('year', String(year))
    }
    const data = await fetchJSON<{ data: TimberRecord[] }>(`${FAO_API}/data/FO?${params}`)
    return { records: data.data || [] }
  })
}

async function listProducts(): Promise<{ products: TimberProduct[] }> {
  return sg.wrap('list_products', async () => {
    return { products: TIMBER_PRODUCTS }
  })
}

async function getTrade(country?: string): Promise<{ records: TradeRecord[] }> {
  return sg.wrap('get_trade', async () => {
    const params = new URLSearchParams({ format: 'json' })
    if (country) params.set('area', country.trim())
    const data = await fetchJSON<{ data: TradeRecord[] }>(`${FAO_API}/data/FT?${params}`)
    return { records: data.data || [] }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getProduction, listProducts, getTrade }

console.log('settlegrid-timber MCP server loaded')
