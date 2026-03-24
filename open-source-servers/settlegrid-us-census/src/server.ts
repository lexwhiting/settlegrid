/**
 * settlegrid-us-census — US Census MCP Server
 *
 * Wraps the US Census API with SettleGrid billing.
 * Requires CENSUS_API_KEY environment variable.
 *
 * Methods:
 *   get_population(get, for)                 (2¢)
 *   list_datasets()                          (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetPopulationInput {
  get: string
  for: string
}

interface ListDatasetsInput {
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.census.gov/data'
const USER_AGENT = 'settlegrid-us-census/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.CENSUS_API_KEY
  if (!key) throw new Error('CENSUS_API_KEY environment variable is required')
  return key
}

async function apiFetch<T>(path: string, options: {
  method?: string
  params?: Record<string, string>
  body?: unknown
  headers?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  url.searchParams.set('key', getApiKey())
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    ...options.headers,
  }
  const fetchOpts: RequestInit = { method: options.method ?? 'GET', headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
    ;(headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  const res = await fetch(url.toString(), fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`US Census API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'us-census',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_population: { costCents: 2, displayName: 'Get population data by state' },
      list_datasets: { costCents: 1, displayName: 'List available Census datasets' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPopulation = sg.wrap(async (args: GetPopulationInput) => {
  if (!args.get || typeof args.get !== 'string') {
    throw new Error('get is required (variables (e.g. b01003_001e for population))')
  }
  if (!args.for || typeof args.for !== 'string') {
    throw new Error('for is required (geography (e.g. state:* for all states))')
  }

  const params: Record<string, string> = {}
  params['get'] = args.get
  params['for'] = args.for

  const data = await apiFetch<Record<string, unknown>>('/2020/acs/acs5', {
    params,
  })

  return data
}, { method: 'get_population' })

const listDatasets = sg.wrap(async (args: ListDatasetsInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 30) : [data]

  return { count: items.length, results: items }
}, { method: 'list_datasets' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPopulation, listDatasets }

console.log('settlegrid-us-census MCP server ready')
console.log('Methods: get_population, list_datasets')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
