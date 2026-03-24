/**
 * settlegrid-demographics — Census Demographics MCP Server
 *
 * Population, age, race, and income demographics from Census ACS.
 *
 * Methods:
 *   get_state_demographics(state) — Get population, income, and age data by state  (2¢)
 *   get_county_demographics(state) — Get demographics for all counties in a state  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetStateDemographicsInput {
  state: string
}

interface GetCountyDemographicsInput {
  state: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.census.gov/data'
const API_KEY = process.env.CENSUS_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-demographics/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Census Demographics API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'demographics',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_state_demographics: { costCents: 2, displayName: 'State Demographics' },
      get_county_demographics: { costCents: 2, displayName: 'County Demographics' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getStateDemographics = sg.wrap(async (args: GetStateDemographicsInput) => {
  if (!args.state || typeof args.state !== 'string') throw new Error('state is required')
  const state = args.state.trim()
  const data = await apiFetch<any>(`/2022/acs/acs1?get=NAME,B01003_001E,B19013_001E,B01002_001E,B02001_002E,B02001_003E&for=state:${encodeURIComponent(state)}&key=${API_KEY}`)
  return {
    NAME: data.NAME,
    B01003_001E: data.B01003_001E,
    B19013_001E: data.B19013_001E,
    B01002_001E: data.B01002_001E,
    B02001_002E: data.B02001_002E,
    B02001_003E: data.B02001_003E,
  }
}, { method: 'get_state_demographics' })

const getCountyDemographics = sg.wrap(async (args: GetCountyDemographicsInput) => {
  if (!args.state || typeof args.state !== 'string') throw new Error('state is required')
  const state = args.state.trim()
  const data = await apiFetch<any>(`/2022/acs/acs5?get=NAME,B01003_001E,B19013_001E,B01002_001E&for=county:*&in=state:${encodeURIComponent(state)}&key=${API_KEY}`)
  return {
    NAME: data.NAME,
    B01003_001E: data.B01003_001E,
    B19013_001E: data.B19013_001E,
    B01002_001E: data.B01002_001E,
  }
}, { method: 'get_county_demographics' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getStateDemographics, getCountyDemographics }

console.log('settlegrid-demographics MCP server ready')
console.log('Methods: get_state_demographics, get_county_demographics')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
