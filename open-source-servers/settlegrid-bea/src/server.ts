/**
 * settlegrid-bea — BEA (Bureau of Economic Analysis) MCP Server
 *
 * Wraps the BEA (Bureau of Economic Analysis) API with SettleGrid billing.
 * Requires BEA_API_KEY environment variable.
 *
 * Methods:
 *   get_data(DatasetName, TableName)         (2¢)
 *   get_datasets()                           (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetDataInput {
  DatasetName: string
  TableName: string
  Year?: string
  Frequency?: string
}

interface GetDatasetsInput {
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://apps.bea.gov/api/data'
const USER_AGENT = 'settlegrid-bea/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.BEA_API_KEY
  if (!key) throw new Error('BEA_API_KEY environment variable is required')
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
  url.searchParams.set('UserID', getApiKey())
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
    throw new Error(`BEA (Bureau of Economic Analysis) API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'bea',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_data: { costCents: 2, displayName: 'Get economic data from BEA datasets' },
      get_datasets: { costCents: 1, displayName: 'List available BEA datasets' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getData = sg.wrap(async (args: GetDataInput) => {
  if (!args.DatasetName || typeof args.DatasetName !== 'string') {
    throw new Error('DatasetName is required (dataset (e.g. nipa, regional))')
  }
  if (!args.TableName || typeof args.TableName !== 'string') {
    throw new Error('TableName is required (table name (e.g. t10101 for gdp))')
  }

  const params: Record<string, string> = {}
  params['DatasetName'] = args.DatasetName
  params['TableName'] = args.TableName
  if (args.Year !== undefined) params['Year'] = String(args.Year)
  if (args.Frequency !== undefined) params['Frequency'] = String(args.Frequency)

  const data = await apiFetch<Record<string, unknown>>('', {
    params,
  })

  return data
}, { method: 'get_data' })

const getDatasets = sg.wrap(async (args: GetDatasetsInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('', {
    params,
  })

  return data
}, { method: 'get_datasets' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getData, getDatasets }

console.log('settlegrid-bea MCP server ready')
console.log('Methods: get_data, get_datasets')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
