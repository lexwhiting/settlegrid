/**
 * settlegrid-fisheries — Global Fisheries Data MCP Server
 * Wraps FAOSTAT fisheries data with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface CatchRecord {
  country: string
  species: string
  year: number
  quantity: number | null
  unit: string
  source: string
}

interface SpeciesInfo {
  name: string
  scientificName: string
  category: string
  majorProducers: string[]
}

interface AquacultureRecord {
  country: string
  species: string
  year: number
  production: number | null
  unit: string
  environment: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const FAO_API = 'https://www.fao.org/faostat/api/v1'

const MAJOR_SPECIES: SpeciesInfo[] = [
  { name: 'Atlantic Salmon', scientificName: 'Salmo salar', category: 'Finfish', majorProducers: ['Norway', 'Chile', 'UK'] },
  { name: 'Skipjack Tuna', scientificName: 'Katsuwonus pelamis', category: 'Tuna', majorProducers: ['Indonesia', 'Japan', 'Philippines'] },
  { name: 'Whiteleg Shrimp', scientificName: 'Litopenaeus vannamei', category: 'Crustacean', majorProducers: ['China', 'Ecuador', 'India'] },
  { name: 'Anchovy', scientificName: 'Engraulis ringens', category: 'Finfish', majorProducers: ['Peru', 'Chile', 'China'] },
  { name: 'Alaska Pollock', scientificName: 'Gadus chalcogrammus', category: 'Finfish', majorProducers: ['USA', 'Russia', 'Japan'] },
  { name: 'Tilapia', scientificName: 'Oreochromis niloticus', category: 'Finfish', majorProducers: ['China', 'Indonesia', 'Egypt'] },
  { name: 'Atlantic Cod', scientificName: 'Gadus morhua', category: 'Finfish', majorProducers: ['Norway', 'Iceland', 'Russia'] },
  { name: 'Common Carp', scientificName: 'Cyprinus carpio', category: 'Finfish', majorProducers: ['China', 'Myanmar', 'Indonesia'] },
  { name: 'Squid', scientificName: 'Various', category: 'Cephalopod', majorProducers: ['China', 'Peru', 'India'] },
  { name: 'Blue Mussel', scientificName: 'Mytilus edulis', category: 'Mollusk', majorProducers: ['Spain', 'China', 'Chile'] },
]

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`FAO API error: ${res.status} ${res.statusText} — ${body}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'fisheries' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getCatch(country?: string, species?: string, year?: number): Promise<{ records: CatchRecord[] }> {
  return sg.wrap('get_catch', async () => {
    const params = new URLSearchParams({ format: 'json', element: '5510' })
    if (country) params.set('area', country.trim())
    if (species) params.set('item', species.trim())
    if (year) {
      if (year < 1950 || year > 2100) throw new Error('Year must be between 1950 and 2100')
      params.set('year', String(year))
    }
    const data = await fetchJSON<{ data: CatchRecord[] }>(`${FAO_API}/data/FBS?${params}`)
    return { records: data.data || [] }
  })
}

async function listSpecies(): Promise<{ species: SpeciesInfo[] }> {
  return sg.wrap('list_species', async () => {
    return { species: MAJOR_SPECIES }
  })
}

async function getAquaculture(country?: string): Promise<{ records: AquacultureRecord[] }> {
  return sg.wrap('get_aquaculture', async () => {
    const params = new URLSearchParams({ format: 'json', element: '5510' })
    if (country) params.set('area', country.trim())
    const data = await fetchJSON<{ data: AquacultureRecord[] }>(`${FAO_API}/data/QA?${params}`)
    return { records: data.data || [] }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getCatch, listSpecies, getAquaculture }

console.log('settlegrid-fisheries MCP server loaded')
