/**
 * settlegrid-census-data — US Census Bureau MCP Server
 *
 * Wraps the US Census Bureau API with SettleGrid billing.
 * Requires CENSUS_API_KEY environment variable.
 *
 * Methods:
 *   get_acs_data(year, variables, state?)  — ACS data        (2¢)
 *   get_population(year)                   — Population est.  (2¢)
 *   get_datasets()                         — List datasets    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface AcsInput { year: string; variables: string; state?: string }
interface PopulationInput { year: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.census.gov/data'

function getKey(): string {
  const k = process.env.CENSUS_API_KEY
  if (!k) throw new Error('CENSUS_API_KEY environment variable is required')
  return k
}

async function censusFetch<T>(url: string): Promise<T> {
  const u = new URL(url)
  u.searchParams.set('key', getKey())
  const res = await fetch(u.toString(), {
    headers: { 'User-Agent': 'settlegrid-census-data/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Census API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'census-data',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_acs_data: { costCents: 2, displayName: 'ACS Data' },
      get_population: { costCents: 2, displayName: 'Population Estimates' },
      get_datasets: { costCents: 1, displayName: 'List Datasets' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getAcsData = sg.wrap(async (args: AcsInput) => {
  if (!args.year || !/^\d{4}$/.test(args.year)) {
    throw new Error('year is required (e.g. "2022")')
  }
  if (!args.variables || typeof args.variables !== 'string') {
    throw new Error('variables is required (e.g. "B01001_001E")')
  }
  let url = `${BASE}/${args.year}/acs/acs1?get=NAME,${args.variables.trim()}`
  if (args.state) {
    url += `&for=county:*&in=state:${args.state.trim()}`
  } else {
    url += '&for=state:*'
  }
  const data = await censusFetch<string[][]>(url)
  const headers = data[0]
  const rows = data.slice(1).map((row) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = row[i] })
    return obj
  })
  return { year: args.year, count: rows.length, data: rows }
}, { method: 'get_acs_data' })

const getPopulation = sg.wrap(async (args: PopulationInput) => {
  if (!args.year || !/^\d{4}$/.test(args.year)) {
    throw new Error('year is required (e.g. "2022")')
  }
  const url = `${BASE}/${args.year}/pep/population?get=NAME,POP_2022&for=state:*`
  const data = await censusFetch<string[][]>(url)
  const headers = data[0]
  const rows = data.slice(1).map((row) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = row[i] })
    return obj
  })
  return { year: args.year, count: rows.length, states: rows }
}, { method: 'get_population' })

const getDatasets = sg.wrap(async () => {
  const res = await fetch(`${BASE}.json`, {
    headers: { 'User-Agent': 'settlegrid-census-data/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) throw new Error(`Census API ${res.status}`)
  const data = await res.json() as { dataset: Array<Record<string, unknown>> }
  const datasets = (data.dataset ?? []).slice(0, 50)
  return { count: datasets.length, datasets }
}, { method: 'get_datasets' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getAcsData, getPopulation, getDatasets }

console.log('settlegrid-census-data MCP server ready')
console.log('Methods: get_acs_data, get_population, get_datasets')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
