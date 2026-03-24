/**
 * settlegrid-car-fuel — Fuel Economy MCP Server
 *
 * EPA fuel economy data for vehicles from fueleconomy.gov.
 *
 * Methods:
 *   get_years()                   — Get list of available model years  (1¢)
 *   get_makes(year)               — Get vehicle makes for a given year  (1¢)
 *   get_vehicle(id)               — Get fuel economy details for a vehicle by ID  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetYearsInput {

}

interface GetMakesInput {
  year: number
}

interface GetVehicleInput {
  id: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.fueleconomy.gov/ws/rest'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-car-fuel/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Fuel Economy API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'car-fuel',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_years: { costCents: 1, displayName: 'Vehicle Years' },
      get_makes: { costCents: 1, displayName: 'Vehicle Makes' },
      get_vehicle: { costCents: 1, displayName: 'Vehicle Details' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getYears = sg.wrap(async (args: GetYearsInput) => {

  const data = await apiFetch<any>(`/vehicle/menu/year`)
  return {
    menuItem: data.menuItem,
  }
}, { method: 'get_years' })

const getMakes = sg.wrap(async (args: GetMakesInput) => {
  if (typeof args.year !== 'number') throw new Error('year is required and must be a number')
  const year = args.year
  const data = await apiFetch<any>(`/vehicle/menu/make?year=${year}`)
  return {
    menuItem: data.menuItem,
  }
}, { method: 'get_makes' })

const getVehicle = sg.wrap(async (args: GetVehicleInput) => {
  if (typeof args.id !== 'number') throw new Error('id is required and must be a number')
  const id = args.id
  const data = await apiFetch<any>(`/vehicle/${id}`)
  return {
    id: data.id,
    make: data.make,
    model: data.model,
    year: data.year,
    city08: data.city08,
    highway08: data.highway08,
    comb08: data.comb08,
    fuelType: data.fuelType,
  }
}, { method: 'get_vehicle' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getYears, getMakes, getVehicle }

console.log('settlegrid-car-fuel MCP server ready')
console.log('Methods: get_years, get_makes, get_vehicle')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
