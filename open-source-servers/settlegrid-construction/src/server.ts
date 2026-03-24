/**
 * settlegrid-construction — Census Construction MCP Server
 *
 * US construction permits and housing starts from Census Bureau.
 *
 * Methods:
 *   get_permits(state)            — Get building permits data by state  (2¢)
 *   get_housing_units(state)      — Get housing unit counts by state  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetPermitsInput {
  state: string
}

interface GetHousingUnitsInput {
  state: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.census.gov/data'
const API_KEY = process.env.CENSUS_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-construction/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Census Construction API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'construction',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_permits: { costCents: 2, displayName: 'Get Permits' },
      get_housing_units: { costCents: 2, displayName: 'Housing Units' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPermits = sg.wrap(async (args: GetPermitsInput) => {
  if (!args.state || typeof args.state !== 'string') throw new Error('state is required')
  const state = args.state.trim()
  const data = await apiFetch<any>(`/2023/bps/moperm?get=NAME,PER_TOTAL,PER1_TOTAL,PER24_TOTAL,PER5PLUS_TOTAL&for=state:${encodeURIComponent(state)}&key=${API_KEY}`)
  return {
    NAME: data.NAME,
    PER_TOTAL: data.PER_TOTAL,
    PER1_TOTAL: data.PER1_TOTAL,
    PER24_TOTAL: data.PER24_TOTAL,
    PER5PLUS_TOTAL: data.PER5PLUS_TOTAL,
  }
}, { method: 'get_permits' })

const getHousingUnits = sg.wrap(async (args: GetHousingUnitsInput) => {
  if (!args.state || typeof args.state !== 'string') throw new Error('state is required')
  const state = args.state.trim()
  const data = await apiFetch<any>(`/2022/acs/acs1?get=NAME,B25001_001E,B25002_002E,B25002_003E&for=state:${encodeURIComponent(state)}&key=${API_KEY}`)
  return {
    NAME: data.NAME,
    B25001_001E: data.B25001_001E,
    B25002_002E: data.B25002_002E,
    B25002_003E: data.B25002_003E,
  }
}, { method: 'get_housing_units' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPermits, getHousingUnits }

console.log('settlegrid-construction MCP server ready')
console.log('Methods: get_permits, get_housing_units')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
