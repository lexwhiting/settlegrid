/**
 * settlegrid-aurora — Aurora Forecast Data MCP Server
 * Wraps NOAA SWPC with SettleGrid billing.
 * Methods:
 *   get_forecast()    — Get aurora forecast (1¢)
 *   get_kp_index()    — Get Kp index (1¢)
 *   get_ovation_map() — Get OVATION map (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://services.swpc.noaa.gov'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-aurora/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`SWPC API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'aurora',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_forecast: { costCents: 1, displayName: 'Get aurora forecast' },
      get_kp_index: { costCents: 1, displayName: 'Get Kp index' },
      get_ovation_map: { costCents: 2, displayName: 'Get OVATION aurora map' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getForecast = sg.wrap(async () => {
  return apiFetch<unknown>('/products/noaa-planetary-k-index-forecast.json')
}, { method: 'get_forecast' })

const getKpIndex = sg.wrap(async () => {
  return apiFetch<unknown>('/products/noaa-planetary-k-index.json')
}, { method: 'get_kp_index' })

const getOvationMap = sg.wrap(async () => {
  return apiFetch<unknown>('/json/ovation_aurora_latest.json')
}, { method: 'get_ovation_map' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getForecast, getKpIndex, getOvationMap }

console.log('settlegrid-aurora MCP server ready')
console.log('Methods: get_forecast, get_kp_index, get_ovation_map')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
