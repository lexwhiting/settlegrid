/**
 * settlegrid-usda-ers — USDA Economic Research Service MCP Server
 * Wraps the USDA ERS / FoodData Central API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface ErsDataset {
  id: string
  name: string
  description: string
  topic: string
}

interface ErsDataResponse {
  dataset: string
  indicator?: string
  records: Record<string, unknown>[]
}

interface ErsTopic {
  name: string
  description: string
  datasetCount: number
}

// ─── Constants ──────────────────────────────────────────────────────────────
const ERS_API = 'https://data.ers.usda.gov/api'
const FDC_API = 'https://api.nal.usda.gov/fdc/v1'

const TOPICS: ErsTopic[] = [
  { name: 'Food & Nutrition', description: 'Food security, nutrition programs, food prices', datasetCount: 45 },
  { name: 'Farming', description: 'Farm income, finance, and structure', datasetCount: 38 },
  { name: 'Trade', description: 'Agricultural trade, imports, exports', datasetCount: 22 },
  { name: 'Rural', description: 'Rural economy, population, employment', datasetCount: 15 },
  { name: 'Natural Resources', description: 'Land use, conservation, water', datasetCount: 18 },
  { name: 'Policy', description: 'Agricultural policy analysis', datasetCount: 12 },
]

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ERS API error: ${res.status} ${res.statusText} — ${body}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'usda-ers' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchDatasets(query: string): Promise<{ results: ErsDataset[] }> {
  if (!query || !query.trim()) throw new Error('Search query is required')
  return sg.wrap('search_datasets', async () => {
    const params = new URLSearchParams({ query: query.trim() })
    const data = await fetchJSON<{ results: ErsDataset[] }>(`${ERS_API}/datasets/search?${params}`)
    return data
  })
}

async function getData(dataset: string, indicator?: string): Promise<ErsDataResponse> {
  if (!dataset || !dataset.trim()) throw new Error('Dataset identifier is required')
  return sg.wrap('get_data', async () => {
    const params = new URLSearchParams()
    if (indicator) params.set('indicator', indicator.trim())
    const qs = params.toString()
    const data = await fetchJSON<{ records: Record<string, unknown>[] }>(
      `${ERS_API}/datasets/${encodeURIComponent(dataset.trim())}/data${qs ? '?' + qs : ''}`
    )
    return { dataset, indicator, records: data.records || [] }
  })
}

async function listTopics(): Promise<{ topics: ErsTopic[] }> {
  return sg.wrap('list_topics', async () => {
    return { topics: TOPICS }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchDatasets, getData, listTopics }

console.log('settlegrid-usda-ers MCP server loaded')
