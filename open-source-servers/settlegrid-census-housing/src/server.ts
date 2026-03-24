/**
 * settlegrid-census-housing — Census Housing Data MCP Server
 *
 * Detailed housing statistics from the American Community Survey.
 *
 * Methods:
 *   get_housing_values(state)     — Get median home values by state  (2¢)
 *   get_housing_by_county(state)  — Get housing data for all counties in a state  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetHousingValuesInput {
  state: string
}

interface GetHousingByCountyInput {
  state: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.census.gov/data'
const API_KEY = process.env.CENSUS_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-census-housing/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Census Housing Data API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'census-housing',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_housing_values: { costCents: 2, displayName: 'Housing Values' },
      get_housing_by_county: { costCents: 2, displayName: 'Housing by County' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getHousingValues = sg.wrap(async (args: GetHousingValuesInput) => {
  if (!args.state || typeof args.state !== 'string') throw new Error('state is required')
  const state = args.state.trim()
  const data = await apiFetch<any>(`/2022/acs/acs1?get=NAME,B25077_001E,B25064_001E,B25003_002E,B25003_003E&for=state:${encodeURIComponent(state)}&key=${API_KEY}`)
  return {
    NAME: data.NAME,
    B25077_001E: data.B25077_001E,
    B25064_001E: data.B25064_001E,
    B25003_002E: data.B25003_002E,
    B25003_003E: data.B25003_003E,
  }
}, { method: 'get_housing_values' })

const getHousingByCounty = sg.wrap(async (args: GetHousingByCountyInput) => {
  if (!args.state || typeof args.state !== 'string') throw new Error('state is required')
  const state = args.state.trim()
  const data = await apiFetch<any>(`/2022/acs/acs5?get=NAME,B25077_001E,B25064_001E&for=county:*&in=state:${encodeURIComponent(state)}&key=${API_KEY}`)
  return {
    NAME: data.NAME,
    B25077_001E: data.B25077_001E,
    B25064_001E: data.B25064_001E,
  }
}, { method: 'get_housing_by_county' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getHousingValues, getHousingByCounty }

console.log('settlegrid-census-housing MCP server ready')
console.log('Methods: get_housing_values, get_housing_by_county')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
