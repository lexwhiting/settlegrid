/**
 * settlegrid-disease-sh — Disease.sh MCP Server
 *
 * Global disease and epidemic tracking data including COVID-19 and influenza.
 *
 * Methods:
 *   get_global()                  — Get global COVID-19 statistics  (1¢)
 *   get_country(country)          — Get COVID-19 data for a specific country  (1¢)
 *   get_influenza()               — Get influenza data from CDC ILINet  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetGlobalInput {

}

interface GetCountryInput {
  country: string
}

interface GetInfluenzaInput {

}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://disease.sh/v3'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-disease-sh/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Disease.sh API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'disease-sh',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_global: { costCents: 1, displayName: 'Get Global' },
      get_country: { costCents: 1, displayName: 'Get Country' },
      get_influenza: { costCents: 1, displayName: 'Get Influenza' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getGlobal = sg.wrap(async (args: GetGlobalInput) => {

  const data = await apiFetch<any>(`/covid-19/all`)
  return {
    cases: data.cases,
    deaths: data.deaths,
    recovered: data.recovered,
    active: data.active,
    todayCases: data.todayCases,
    todayDeaths: data.todayDeaths,
  }
}, { method: 'get_global' })

const getCountry = sg.wrap(async (args: GetCountryInput) => {
  if (!args.country || typeof args.country !== 'string') throw new Error('country is required')
  const country = args.country.trim()
  const data = await apiFetch<any>(`/covid-19/countries/${encodeURIComponent(country)}`)
  return {
    country: data.country,
    cases: data.cases,
    deaths: data.deaths,
    recovered: data.recovered,
    active: data.active,
    population: data.population,
  }
}, { method: 'get_country' })

const getInfluenza = sg.wrap(async (args: GetInfluenzaInput) => {

  const data = await apiFetch<any>(`/influenza/ILINet`)
  const items = (data.data ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        week: item.week,
        year: item.year,
        totalILI: item.totalILI,
        totalPatients: item.totalPatients,
    })),
  }
}, { method: 'get_influenza' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getGlobal, getCountry, getInfluenza }

console.log('settlegrid-disease-sh MCP server ready')
console.log('Methods: get_global, get_country, get_influenza')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
