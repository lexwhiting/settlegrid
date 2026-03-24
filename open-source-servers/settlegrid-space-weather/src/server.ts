/**
 * settlegrid-space-weather — Space Weather Alerts MCP Server
 * Wraps NOAA SWPC with SettleGrid billing.
 * Methods:
 *   get_alerts()          — Get space weather alerts (1¢)
 *   get_solar_wind()      — Get solar wind data (1¢)
 *   get_geomag_forecast() — Get geomagnetic forecast (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://services.swpc.noaa.gov'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-space-weather/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`SWPC API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'space-weather',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_alerts: { costCents: 1, displayName: 'Get space weather alerts' },
      get_solar_wind: { costCents: 1, displayName: 'Get solar wind data' },
      get_geomag_forecast: { costCents: 2, displayName: 'Get geomagnetic forecast' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getAlerts = sg.wrap(async () => {
  return apiFetch<unknown>('/products/alerts.json')
}, { method: 'get_alerts' })

const getSolarWind = sg.wrap(async () => {
  return apiFetch<unknown>('/products/solar-wind/plasma-7-day.json')
}, { method: 'get_solar_wind' })

const getGeomagForecast = sg.wrap(async () => {
  return apiFetch<unknown>('/products/noaa-planetary-k-index-forecast.json')
}, { method: 'get_geomag_forecast' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getAlerts, getSolarWind, getGeomagForecast }

console.log('settlegrid-space-weather MCP server ready')
console.log('Methods: get_alerts, get_solar_wind, get_geomag_forecast')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
