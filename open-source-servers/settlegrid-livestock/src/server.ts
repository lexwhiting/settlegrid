/**
 * settlegrid-livestock — Global Livestock Statistics MCP Server
 * Wraps FAOSTAT livestock API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface LivestockRecord {
  country: string
  animal: string
  year: number
  value: number | null
  element: string
  unit: string
}

interface AnimalInfo {
  name: string
  code: string
  category: string
}

interface TradeRecord {
  country: string
  animal: string
  importQty: number | null
  exportQty: number | null
  importValue: number | null
  exportValue: number | null
  year: number
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://www.fao.org/faostat/api/v1'

const ANIMALS: AnimalInfo[] = [
  { name: 'Cattle', code: '0866', category: 'Large ruminants' },
  { name: 'Pigs', code: '1034', category: 'Monogastric' },
  { name: 'Chickens', code: '1057', category: 'Poultry' },
  { name: 'Sheep', code: '0976', category: 'Small ruminants' },
  { name: 'Goats', code: '1016', category: 'Small ruminants' },
  { name: 'Buffaloes', code: '0946', category: 'Large ruminants' },
  { name: 'Horses', code: '1096', category: 'Equine' },
  { name: 'Ducks', code: '1068', category: 'Poultry' },
  { name: 'Turkeys', code: '1072', category: 'Poultry' },
  { name: 'Camels', code: '1126', category: 'Camelids' },
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

function findAnimalCode(name: string): string {
  const lower = name.toLowerCase().trim()
  const match = ANIMALS.find(a => a.name.toLowerCase() === lower || lower.includes(a.name.toLowerCase()))
  return match?.code || lower
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'livestock' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getProduction(animal: string, country?: string, year?: number): Promise<{ records: LivestockRecord[] }> {
  if (!animal || !animal.trim()) throw new Error('Animal type is required')
  return sg.wrap('get_production', async () => {
    const code = findAnimalCode(animal)
    const params = new URLSearchParams({ item: code, element: '5510', format: 'json' })
    if (country) params.set('area', country.trim())
    if (year) {
      if (year < 1960 || year > 2100) throw new Error('Year must be between 1960 and 2100')
      params.set('year', String(year))
    }
    const data = await fetchJSON<{ data: LivestockRecord[] }>(`${API}/data/QL?${params}`)
    return { records: data.data || [] }
  })
}

async function listAnimals(): Promise<{ animals: AnimalInfo[] }> {
  return sg.wrap('list_animals', async () => {
    return { animals: ANIMALS }
  })
}

async function getTrade(animal: string, country?: string): Promise<{ records: TradeRecord[] }> {
  if (!animal || !animal.trim()) throw new Error('Animal type is required')
  return sg.wrap('get_trade', async () => {
    const code = findAnimalCode(animal)
    const params = new URLSearchParams({ item: code, format: 'json' })
    if (country) params.set('area', country.trim())
    const data = await fetchJSON<{ data: TradeRecord[] }>(`${API}/data/TM?${params}`)
    return { records: data.data || [] }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getProduction, listAnimals, getTrade }

console.log('settlegrid-livestock MCP server loaded')
