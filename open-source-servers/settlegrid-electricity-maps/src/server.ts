/**
 * settlegrid-electricity-maps — Electricity Maps MCP Server
 *
 * Wraps Electricity Maps API with SettleGrid billing.
 * Free key from https://api-portal.electricitymaps.com/.
 *
 * Methods:
 *   get_zone_carbon(zone) — zone carbon intensity (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ZoneInput { zone: string }

const API_BASE = 'https://api.electricitymap.org/v3'
const API_KEY = process.env.ELECTRICITYMAPS_API_KEY || ''

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, { headers: { 'auth-token': API_KEY } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'electricity-maps',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_zone_carbon: { costCents: 2, displayName: 'Zone Carbon' },
    },
  },
})

const getZoneCarbon = sg.wrap(async (args: ZoneInput) => {
  if (!args.zone) throw new Error('zone is required')
  if (!API_KEY) throw new Error('ELECTRICITYMAPS_API_KEY not set')
  const data = await apiFetch<any>(`/carbon-intensity/latest?zone=${args.zone}`)
  return {
    zone: data.zone, carbon_intensity_gco2_kwh: data.carbonIntensity,
    fossil_fuel_percentage: data.fossilFuelPercentage,
    renewable_percentage: data.renewablePercentage,
    datetime: data.datetime, updated_at: data.updatedAt,
  }
}, { method: 'get_zone_carbon' })

export { getZoneCarbon }

console.log('settlegrid-electricity-maps MCP server ready')
console.log('Methods: get_zone_carbon')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
