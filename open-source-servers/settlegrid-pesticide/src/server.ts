/**
 * settlegrid-pesticide — Pesticide Usage Data MCP Server
 * Wraps EPA and USDA pesticide data with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface PesticideUsage {
  pesticide: string
  crop: string | null
  state: string | null
  year: number
  amountApplied: number | null
  unit: string
  areasTreated: number | null
}

interface PesticideInfo {
  name: string
  type: string
  chemicalClass: string
  commonCrops: string[]
  epaRegNumber: string | null
}

interface UsageTrend {
  pesticide: string
  years: { year: number; amount: number; unit: string }[]
  trend: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const EPA_API = 'https://iaspub.epa.gov/apex/pesticides/f'

const COMMON_PESTICIDES: PesticideInfo[] = [
  { name: 'Glyphosate', type: 'Herbicide', chemicalClass: 'Phosphonoglycine', commonCrops: ['Corn', 'Soybeans', 'Cotton'], epaRegNumber: '524-445' },
  { name: 'Atrazine', type: 'Herbicide', chemicalClass: 'Triazine', commonCrops: ['Corn', 'Sorghum', 'Sugarcane'], epaRegNumber: '100-497' },
  { name: '2,4-D', type: 'Herbicide', chemicalClass: 'Phenoxy', commonCrops: ['Wheat', 'Corn', 'Pasture'], epaRegNumber: '62719-556' },
  { name: 'Chlorpyrifos', type: 'Insecticide', chemicalClass: 'Organophosphate', commonCrops: ['Corn', 'Soybeans', 'Fruit'], epaRegNumber: '62719-220' },
  { name: 'Imidacloprid', type: 'Insecticide', chemicalClass: 'Neonicotinoid', commonCrops: ['Cotton', 'Vegetables', 'Fruit'], epaRegNumber: '264-763' },
  { name: 'Chlorothalonil', type: 'Fungicide', chemicalClass: 'Chloronitrile', commonCrops: ['Peanuts', 'Potatoes', 'Tomatoes'], epaRegNumber: '50534-202' },
  { name: 'Mancozeb', type: 'Fungicide', chemicalClass: 'Dithiocarbamate', commonCrops: ['Potatoes', 'Tomatoes', 'Grapes'], epaRegNumber: '62719-399' },
  { name: 'Metolachlor', type: 'Herbicide', chemicalClass: 'Chloroacetamide', commonCrops: ['Corn', 'Soybeans', 'Peanuts'], epaRegNumber: '100-816' },
  { name: 'Dicamba', type: 'Herbicide', chemicalClass: 'Benzoic acid', commonCrops: ['Soybeans', 'Cotton', 'Corn'], epaRegNumber: '524-582' },
  { name: 'Pendimethalin', type: 'Herbicide', chemicalClass: 'Dinitroaniline', commonCrops: ['Corn', 'Soybeans', 'Wheat'], epaRegNumber: '241-416' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`EPA API error: ${res.status} ${res.statusText} — ${body}`)
  }
  return res.json() as Promise<T>
}

function findPesticide(name: string): PesticideInfo | undefined {
  const lower = name.toLowerCase().trim()
  return COMMON_PESTICIDES.find(p => p.name.toLowerCase() === lower || p.name.toLowerCase().includes(lower))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'pesticide' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getUsage(pesticide?: string, crop?: string, state?: string): Promise<{ records: PesticideUsage[] }> {
  if (!pesticide && !crop && !state) throw new Error('At least one of pesticide, crop, or state is required')
  return sg.wrap('get_usage', async () => {
    const params = new URLSearchParams()
    if (pesticide) params.set('pesticide', pesticide.trim())
    if (crop) params.set('crop', crop.trim())
    if (state) params.set('state', state.trim().toUpperCase())
    const data = await fetchJSON<{ data: PesticideUsage[] }>(`${EPA_API}?p=pesticide_usage&${params}`)
    return { records: data.data || [] }
  })
}

async function listPesticides(): Promise<{ pesticides: PesticideInfo[] }> {
  return sg.wrap('list_pesticides', async () => {
    return { pesticides: COMMON_PESTICIDES }
  })
}

async function getTrends(pesticide: string): Promise<UsageTrend> {
  if (!pesticide || !pesticide.trim()) throw new Error('Pesticide name is required')
  const info = findPesticide(pesticide)
  if (!info) throw new Error(`Pesticide not found: ${pesticide}. Available: ${COMMON_PESTICIDES.map(p => p.name).join(', ')}`)
  return sg.wrap('get_trends', async () => {
    const params = new URLSearchParams({ pesticide: info.name })
    const data = await fetchJSON<{ data: { year: number; amount: number; unit: string }[] }>(`${EPA_API}?p=pesticide_trends&${params}`)
    return {
      pesticide: info.name,
      years: data.data || [],
      trend: 'See data for yearly usage trend',
    }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getUsage, listPesticides, getTrends }

console.log('settlegrid-pesticide MCP server loaded')
