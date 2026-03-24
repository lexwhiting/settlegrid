/**
 * settlegrid-electricity-maps — Electricity Maps MCP Server
 *
 * Real-time carbon intensity and power breakdown by zone via Electricity Maps.
 *
 * Methods:
 *   get_carbon_intensity(zone)    — Get real-time carbon intensity for a zone  (2¢)
 *   get_power_breakdown(zone)     — Get power generation breakdown by source for a zone  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetCarbonIntensityInput {
  zone: string
}

interface GetPowerBreakdownInput {
  zone: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.electricitymap.org/v3'
const API_KEY = process.env.ELECTRICITYMAP_TOKEN ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-electricity-maps/1.0', 'auth-token': API_KEY },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Electricity Maps API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'electricity-maps',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_carbon_intensity: { costCents: 2, displayName: 'Carbon Intensity' },
      get_power_breakdown: { costCents: 2, displayName: 'Power Breakdown' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCarbonIntensity = sg.wrap(async (args: GetCarbonIntensityInput) => {
  if (!args.zone || typeof args.zone !== 'string') throw new Error('zone is required')
  const zone = args.zone.trim()
  const data = await apiFetch<any>(`/carbon-intensity/latest?zone=${encodeURIComponent(zone)}`)
  return {
    zone: data.zone,
    carbonIntensity: data.carbonIntensity,
    datetime: data.datetime,
    updatedAt: data.updatedAt,
  }
}, { method: 'get_carbon_intensity' })

const getPowerBreakdown = sg.wrap(async (args: GetPowerBreakdownInput) => {
  if (!args.zone || typeof args.zone !== 'string') throw new Error('zone is required')
  const zone = args.zone.trim()
  const data = await apiFetch<any>(`/power-breakdown/latest?zone=${encodeURIComponent(zone)}`)
  return {
    zone: data.zone,
    powerConsumptionBreakdown: data.powerConsumptionBreakdown,
    powerProductionBreakdown: data.powerProductionBreakdown,
    datetime: data.datetime,
  }
}, { method: 'get_power_breakdown' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCarbonIntensity, getPowerBreakdown }

console.log('settlegrid-electricity-maps MCP server ready')
console.log('Methods: get_carbon_intensity, get_power_breakdown')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
