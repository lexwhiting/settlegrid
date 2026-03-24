/**
 * settlegrid-carbon-footprint — Carbon Interface MCP Server
 *
 * Carbon footprint estimation for vehicles, flights, electricity, and shipping.
 *
 * Methods:
 *   estimate_vehicle(distance_value, distance_unit) — Estimate CO2 emissions for a vehicle trip by distance  (2¢)
 *   estimate_electricity(electricity_value, country) — Estimate CO2 for electricity usage by kWh and country  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface EstimateVehicleInput {
  distance_value: number
  distance_unit: string
}

interface EstimateElectricityInput {
  electricity_value: number
  country: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.carboninterface.com/api/v1'
const API_KEY = process.env.CARBON_INTERFACE_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-carbon-footprint/1.0', Authorization: `Bearer ${API_KEY}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Carbon Interface API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'carbon-footprint',
  pricing: {
    defaultCostCents: 2,
    methods: {
      estimate_vehicle: { costCents: 2, displayName: 'Estimate Vehicle' },
      estimate_electricity: { costCents: 2, displayName: 'Estimate Electricity' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const estimateVehicle = sg.wrap(async (args: EstimateVehicleInput) => {
  if (typeof args.distance_value !== 'number') throw new Error('distance_value is required and must be a number')
  const distance_value = args.distance_value
  if (!args.distance_unit || typeof args.distance_unit !== 'string') throw new Error('distance_unit is required')
  const distance_unit = args.distance_unit.trim()
  const data = await apiFetch<any>(`/estimates`)
  return {
    data: data.data,
  }
}, { method: 'estimate_vehicle' })

const estimateElectricity = sg.wrap(async (args: EstimateElectricityInput) => {
  if (typeof args.electricity_value !== 'number') throw new Error('electricity_value is required and must be a number')
  const electricity_value = args.electricity_value
  if (!args.country || typeof args.country !== 'string') throw new Error('country is required')
  const country = args.country.trim()
  const data = await apiFetch<any>(`/estimates`)
  return {
    data: data.data,
  }
}, { method: 'estimate_electricity' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { estimateVehicle, estimateElectricity }

console.log('settlegrid-carbon-footprint MCP server ready')
console.log('Methods: estimate_vehicle, estimate_electricity')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
