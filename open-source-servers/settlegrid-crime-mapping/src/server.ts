/**
 * settlegrid-crime-mapping — FBI Crime Data MCP Server
 *
 * Crime statistics from the FBI Crime Data Explorer API.
 *
 * Methods:
 *   get_state_crime(state)        — Get crime summary for a state abbreviation  (1¢)
 *   get_national_crime()          — Get national crime estimates  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetStateCrimeInput {
  state: string
}

interface GetNationalCrimeInput {

}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.usa.gov/crime/fbi/sapi'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-crime-mapping/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`FBI Crime Data API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'crime-mapping',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_state_crime: { costCents: 1, displayName: 'State Crime' },
      get_national_crime: { costCents: 1, displayName: 'National Crime' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getStateCrime = sg.wrap(async (args: GetStateCrimeInput) => {
  if (!args.state || typeof args.state !== 'string') throw new Error('state is required')
  const state = args.state.trim()
  const data = await apiFetch<any>(`/api/estimates/states/${encodeURIComponent(state)}/2022/2022?API_KEY=iiHnOKfno2Mgkt5AynpvPpUQTEyxE77jo1RU8PIv`)
  const items = (data.results ?? []).slice(0, 5)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        year: item.year,
        state_abbr: item.state_abbr,
        population: item.population,
        violent_crime: item.violent_crime,
        property_crime: item.property_crime,
    })),
  }
}, { method: 'get_state_crime' })

const getNationalCrime = sg.wrap(async (args: GetNationalCrimeInput) => {

  const data = await apiFetch<any>(`/api/estimates/national/2018/2022?API_KEY=iiHnOKfno2Mgkt5AynpvPpUQTEyxE77jo1RU8PIv`)
  const items = (data.results ?? []).slice(0, 5)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        year: item.year,
        population: item.population,
        violent_crime: item.violent_crime,
        property_crime: item.property_crime,
        homicide: item.homicide,
        robbery: item.robbery,
    })),
  }
}, { method: 'get_national_crime' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getStateCrime, getNationalCrime }

console.log('settlegrid-crime-mapping MCP server ready')
console.log('Methods: get_state_crime, get_national_crime')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
