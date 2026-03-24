/**
 * settlegrid-renewable-energy — US EIA Energy Data MCP Server
 *
 * US Energy Information Administration data on renewable and conventional energy.
 *
 * Methods:
 *   get_electricity(fuel_type)    — Get electricity generation data by source  (2¢)
 *   get_total_energy(series)      — Get total energy production and consumption stats  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetElectricityInput {
  fuel_type?: string
}

interface GetTotalEnergyInput {
  series?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.eia.gov/v2'
const API_KEY = process.env.EIA_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-renewable-energy/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`US EIA Energy Data API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'renewable-energy',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_electricity: { costCents: 2, displayName: 'Get Electricity Data' },
      get_total_energy: { costCents: 2, displayName: 'Get Total Energy' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getElectricity = sg.wrap(async (args: GetElectricityInput) => {
  const fuel_type = typeof args.fuel_type === 'string' ? args.fuel_type.trim() : ''
  const data = await apiFetch<any>(`/electricity/electric-power-operational-data/data/?frequency=monthly&data[0]=generation&sort[0][column]=period&sort[0][direction]=desc&length=10&offset=0${fuel_type ? "&facets[fueltypeid][]=" + fuel_type : ""}&api_key=${API_KEY}`)
  const items = (data.response.data ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        period: item.period,
        fueltypeid: item.fueltypeid,
        generation: item.generation,
        generation-units: item.generation-units,
    })),
  }
}, { method: 'get_electricity' })

const getTotalEnergy = sg.wrap(async (args: GetTotalEnergyInput) => {
  const series = typeof args.series === 'string' ? args.series.trim() : ''
  const data = await apiFetch<any>(`/total-energy/data/?frequency=monthly&data[0]=value&sort[0][column]=period&sort[0][direction]=desc&length=10${series ? "&facets[msn][]=" + series : ""}&api_key=${API_KEY}`)
  const items = (data.response.data ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        period: item.period,
        msn: item.msn,
        value: item.value,
        unit: item.unit,
    })),
  }
}, { method: 'get_total_energy' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getElectricity, getTotalEnergy }

console.log('settlegrid-renewable-energy MCP server ready')
console.log('Methods: get_electricity, get_total_energy')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
