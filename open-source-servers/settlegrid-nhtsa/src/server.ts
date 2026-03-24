/**
 * settlegrid-nhtsa — NHTSA MCP Server
 *
 * Vehicle safety recalls, complaints, and investigations from NHTSA.
 *
 * Methods:
 *   get_makes()                   — Get all vehicle makes  (1¢)
 *   get_models(make, year)        — Get models for a make and year  (1¢)
 *   decode_vin(vin)               — Decode a Vehicle Identification Number  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetMakesInput {

}

interface GetModelsInput {
  make: string
  year: number
}

interface DecodeVinInput {
  vin: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://vpic.nhtsa.dot.gov/api'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-nhtsa/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NHTSA API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'nhtsa',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_makes: { costCents: 1, displayName: 'All Makes' },
      get_models: { costCents: 1, displayName: 'Models by Make' },
      decode_vin: { costCents: 1, displayName: 'Decode VIN' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getMakes = sg.wrap(async (args: GetMakesInput) => {

  const data = await apiFetch<any>(`/vehicles/GetAllMakes?format=json`)
  const items = (data.Results ?? []).slice(0, 20)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        Make_ID: item.Make_ID,
        Make_Name: item.Make_Name,
    })),
  }
}, { method: 'get_makes' })

const getModels = sg.wrap(async (args: GetModelsInput) => {
  if (!args.make || typeof args.make !== 'string') throw new Error('make is required')
  const make = args.make.trim()
  if (typeof args.year !== 'number') throw new Error('year is required and must be a number')
  const year = args.year
  const data = await apiFetch<any>(`/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`)
  const items = (data.Results ?? []).slice(0, 20)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        Make_Name: item.Make_Name,
        Model_Name: item.Model_Name,
        Make_ID: item.Make_ID,
        Model_ID: item.Model_ID,
    })),
  }
}, { method: 'get_models' })

const decodeVin = sg.wrap(async (args: DecodeVinInput) => {
  if (!args.vin || typeof args.vin !== 'string') throw new Error('vin is required')
  const vin = args.vin.trim()
  const data = await apiFetch<any>(`/vehicles/DecodeVin/${encodeURIComponent(vin)}?format=json`)
  const items = (data.Results ?? []).slice(0, 25)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        Variable: item.Variable,
        Value: item.Value,
        ValueId: item.ValueId,
    })),
  }
}, { method: 'decode_vin' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getMakes, getModels, decodeVin }

console.log('settlegrid-nhtsa MCP server ready')
console.log('Methods: get_makes, get_models, decode_vin')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
