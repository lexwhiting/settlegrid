/**
 * settlegrid-lightning-data — Lightning & Severe Weather MCP Server
 * Wraps NWS Alerts API with SettleGrid billing.
 * Methods:
 *   get_strikes(lat, lon, radius?)  — Get severe thunderstorm alerts (2¢)
 *   get_alerts(state)               — Get alerts by state (1¢)
 *   get_density(region)             — Get alert density (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface StrikeInput {
  lat: number
  lon: number
  radius?: number
}

interface AlertInput {
  state: string
}

interface DensityInput {
  region: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.weather.gov'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/geo+json',
      'User-Agent': 'settlegrid-lightning-data/1.0 (contact@settlegrid.ai)',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NWS API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'lightning-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_strikes: { costCents: 2, displayName: 'Get severe thunderstorm alerts' },
      get_alerts: { costCents: 1, displayName: 'Get alerts by state' },
      get_density: { costCents: 1, displayName: 'Get alert density' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getStrikes = sg.wrap(async (args: StrikeInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon are required (numeric)')
  }
  return apiFetch<unknown>('/alerts/active', {
    point: `${args.lat},${args.lon}`,
    event: 'Severe Thunderstorm Warning',
  })
}, { method: 'get_strikes' })

const getAlerts = sg.wrap(async (args: AlertInput) => {
  if (!args.state || typeof args.state !== 'string') {
    throw new Error('state is required (two-letter code)')
  }
  return apiFetch<unknown>('/alerts/active', {
    area: args.state.toUpperCase(),
  })
}, { method: 'get_alerts' })

const getDensity = sg.wrap(async (args: DensityInput) => {
  if (!args.region || typeof args.region !== 'string') {
    throw new Error('region is required')
  }
  const data = await apiFetch<{ features?: unknown[] }>('/alerts/active', {
    area: args.region.toUpperCase(),
  })
  return { region: args.region, activeAlerts: (data.features || []).length, data }
}, { method: 'get_density' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getStrikes, getAlerts, getDensity }

console.log('settlegrid-lightning-data MCP server ready')
console.log('Methods: get_strikes, get_alerts, get_density')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
