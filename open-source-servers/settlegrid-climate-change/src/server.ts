/**
 * settlegrid-climate-change — Climate Change Indicators MCP Server
 *
 * Climate change indicators and temperature data from World Bank.
 *
 * Methods:
 *   get_co2_emissions(country)    — Get CO2 emissions per capita by country ISO code  (1¢)
 *   get_temperature_change(country) — Get average temperature data by country  (1¢)
 *   get_forest_area(country)      — Get forest area as percentage of land by country  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetCo2EmissionsInput {
  country: string
}

interface GetTemperatureChangeInput {
  country: string
}

interface GetForestAreaInput {
  country: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.worldbank.org/v2'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-climate-change/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Climate Change Indicators API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'climate-change',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_co2_emissions: { costCents: 1, displayName: 'CO2 Emissions' },
      get_temperature_change: { costCents: 1, displayName: 'Temperature Change' },
      get_forest_area: { costCents: 1, displayName: 'Forest Area %' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCo2Emissions = sg.wrap(async (args: GetCo2EmissionsInput) => {
  if (!args.country || typeof args.country !== 'string') throw new Error('country is required')
  const country = args.country.trim()
  const data = await apiFetch<any>(`/country/${encodeURIComponent(country)}/indicator/EN.ATM.CO2E.PC?format=json&per_page=20&mrv=20`)
  const items = (data.1 ?? []).slice(0, 20)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        date: item.date,
        value: item.value,
        country: item.country,
        indicator: item.indicator,
    })),
  }
}, { method: 'get_co2_emissions' })

const getTemperatureChange = sg.wrap(async (args: GetTemperatureChangeInput) => {
  if (!args.country || typeof args.country !== 'string') throw new Error('country is required')
  const country = args.country.trim()
  const data = await apiFetch<any>(`/country/${encodeURIComponent(country)}/indicator/EN.CLC.MDAT.ZS?format=json&per_page=10&mrv=10`)
  const items = (data.1 ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        date: item.date,
        value: item.value,
        country: item.country,
        indicator: item.indicator,
    })),
  }
}, { method: 'get_temperature_change' })

const getForestArea = sg.wrap(async (args: GetForestAreaInput) => {
  if (!args.country || typeof args.country !== 'string') throw new Error('country is required')
  const country = args.country.trim()
  const data = await apiFetch<any>(`/country/${encodeURIComponent(country)}/indicator/AG.LND.FRST.ZS?format=json&per_page=10&mrv=10`)
  const items = (data.1 ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        date: item.date,
        value: item.value,
        country: item.country,
        indicator: item.indicator,
    })),
  }
}, { method: 'get_forest_area' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCo2Emissions, getTemperatureChange, getForestArea }

console.log('settlegrid-climate-change MCP server ready')
console.log('Methods: get_co2_emissions, get_temperature_change, get_forest_area')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
