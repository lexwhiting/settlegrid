/**
 * settlegrid-census-historical — Historical Census Data MCP Server
 * Wraps US Census API with SettleGrid billing.
 * Methods:
 *   get_data(year, variables, state?) — Get census data (2¢)
 *   list_datasets()                   — List datasets (1¢)
 *   list_variables(dataset)           — List variables (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DataInput {
  year: string
  variables: string
  state?: string
}

interface VariableInput {
  dataset: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.census.gov/data'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-census-historical/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Census API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'census-historical',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_data: { costCents: 2, displayName: 'Get census data' },
      list_datasets: { costCents: 1, displayName: 'List datasets' },
      list_variables: { costCents: 1, displayName: 'List variables' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getData = sg.wrap(async (args: DataInput) => {
  if (!args.year || typeof args.year !== 'string') {
    throw new Error('year is required (e.g. "2020")')
  }
  if (!args.variables || typeof args.variables !== 'string') {
    throw new Error('variables is required (e.g. "NAME,P1_001N")')
  }
  const params: Record<string, string> = {
    get: args.variables,
    'for': args.state ? `county:*&in=state:${args.state}` : 'state:*',
  }
  return apiFetch<unknown>(`${args.year}/dec/pl`, params)
}, { method: 'get_data' })

const listDatasets = sg.wrap(async () => {
  return apiFetch<unknown>('.json')
}, { method: 'list_datasets' })

const listVariables = sg.wrap(async (args: VariableInput) => {
  if (!args.dataset || typeof args.dataset !== 'string') {
    throw new Error('dataset is required (e.g. "2020/dec/pl")')
  }
  return apiFetch<unknown>(`${args.dataset}/variables.json`)
}, { method: 'list_variables' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getData, listDatasets, listVariables }

console.log('settlegrid-census-historical MCP server ready')
console.log('Methods: get_data, list_datasets, list_variables')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
