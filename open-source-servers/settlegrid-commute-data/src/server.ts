/**
 * settlegrid-commute-data — Census Commute Data MCP Server
 *
 * Commuting patterns and travel time data from Census ACS.
 *
 * Methods:
 *   get_commute_by_state(state)   — Get commute times and modes by state  (2¢)
 *   get_commute_by_county(state)  — Get commute data for all counties in a state  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetCommuteByStateInput {
  state: string
}

interface GetCommuteByCountyInput {
  state: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.census.gov/data'
const API_KEY = process.env.CENSUS_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-commute-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Census Commute Data API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'commute-data',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_commute_by_state: { costCents: 2, displayName: 'Commute by State' },
      get_commute_by_county: { costCents: 2, displayName: 'Commute by County' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCommuteByState = sg.wrap(async (args: GetCommuteByStateInput) => {
  if (!args.state || typeof args.state !== 'string') throw new Error('state is required')
  const state = args.state.trim()
  const data = await apiFetch<any>(`/2022/acs/acs1?get=NAME,B08303_001E,B08301_003E,B08301_010E,B08006_017E&for=state:${encodeURIComponent(state)}&key=${API_KEY}`)
  return {
    NAME: data.NAME,
    B08303_001E: data.B08303_001E,
    B08301_003E: data.B08301_003E,
    B08301_010E: data.B08301_010E,
    B08006_017E: data.B08006_017E,
  }
}, { method: 'get_commute_by_state' })

const getCommuteByCounty = sg.wrap(async (args: GetCommuteByCountyInput) => {
  if (!args.state || typeof args.state !== 'string') throw new Error('state is required')
  const state = args.state.trim()
  const data = await apiFetch<any>(`/2022/acs/acs5?get=NAME,B08303_001E,B08301_003E,B08301_010E&for=county:*&in=state:${encodeURIComponent(state)}&key=${API_KEY}`)
  return {
    NAME: data.NAME,
    B08303_001E: data.B08303_001E,
    B08301_003E: data.B08301_003E,
    B08301_010E: data.B08301_010E,
  }
}, { method: 'get_commute_by_county' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCommuteByState, getCommuteByCounty }

console.log('settlegrid-commute-data MCP server ready')
console.log('Methods: get_commute_by_state, get_commute_by_county')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
