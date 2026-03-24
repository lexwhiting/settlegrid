/**
 * settlegrid-carbon-offset — Carbon Offset Pricing MCP Server
 *
 * Calculate carbon footprints and offset costs.
 * Uses Carbon Interface API (free tier).
 *
 * Methods:
 *   estimate_flight(from, to, passengers)  (2¢)
 *   estimate_vehicle(distance_km, model)   (1¢)
 *   estimate_electricity(kwh, country)     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface EstimateFlightInput { from: string; to: string; passengers?: number }
interface EstimateVehicleInput { distance_km: number; model?: string }
interface EstimateElectricityInput { kwh: number; country?: string }

const API_BASE = 'https://www.carboninterface.com/api/v1'
const USER_AGENT = 'settlegrid-carbon-offset/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, body: unknown): Promise<T> {
  const key = process.env.CARBON_INTERFACE_KEY || ''
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Carbon Interface API ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'carbon-offset',
  pricing: {
    defaultCostCents: 1,
    methods: {
      estimate_flight: { costCents: 2, displayName: 'Estimate flight carbon footprint' },
      estimate_vehicle: { costCents: 1, displayName: 'Estimate vehicle emissions' },
      estimate_electricity: { costCents: 1, displayName: 'Estimate electricity emissions' },
    },
  },
})

const estimateFlight = sg.wrap(async (args: EstimateFlightInput) => {
  if (!args.from || !args.to) throw new Error('from and to IATA codes are required')
  const data = await apiFetch<Record<string, unknown>>('/estimates', {
    type: 'flight',
    passengers: args.passengers ?? 1,
    legs: [{ departure_airport: args.from.toUpperCase(), destination_airport: args.to.toUpperCase() }],
  })
  return data
}, { method: 'estimate_flight' })

const estimateVehicle = sg.wrap(async (args: EstimateVehicleInput) => {
  if (!args.distance_km || typeof args.distance_km !== 'number') throw new Error('distance_km is required')
  const data = await apiFetch<Record<string, unknown>>('/estimates', {
    type: 'vehicle',
    distance_unit: 'km',
    distance_value: args.distance_km,
    vehicle_model_id: args.model || '7268a9b7-17e8-4c8d-acca-57059252afe9',
  })
  return data
}, { method: 'estimate_vehicle' })

const estimateElectricity = sg.wrap(async (args: EstimateElectricityInput) => {
  if (!args.kwh || typeof args.kwh !== 'number') throw new Error('kwh is required')
  const data = await apiFetch<Record<string, unknown>>('/estimates', {
    type: 'electricity',
    electricity_unit: 'kwh',
    electricity_value: args.kwh,
    country: args.country?.toLowerCase() || 'us',
  })
  return data
}, { method: 'estimate_electricity' })

export { estimateFlight, estimateVehicle, estimateElectricity }

console.log('settlegrid-carbon-offset MCP server ready')
console.log('Methods: estimate_flight, estimate_vehicle, estimate_electricity')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
