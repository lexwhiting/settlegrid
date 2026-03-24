/**
 * settlegrid-radiation — Environmental Radiation MCP Server
 * Wraps EPA RadNet data with SettleGrid billing.
 * Methods:
 *   get_readings(state?)          — Get readings (1¢)
 *   list_monitors(state?)         — List monitors (1¢)
 *   get_history(monitor, days?)   — Get history (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReadingsInput {
  state?: string
}

interface ListInput {
  state?: string
}

interface HistoryInput {
  monitor: string
  days?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://enviro.epa.gov/enviro/efservice'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/${path}/json`, {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-radiation/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`EPA API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'radiation',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_readings: { costCents: 1, displayName: 'Get radiation readings' },
      list_monitors: { costCents: 1, displayName: 'List monitors' },
      get_history: { costCents: 2, displayName: 'Get historical readings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getReadings = sg.wrap(async (args: ReadingsInput) => {
  let path = 'RAD_NET_GAMMA_GROSS'
  if (args.state) {
    path += `/STATE_ABBREVIATION/=${args.state.toUpperCase()}`
  }
  path += '/rows/0:20'
  return apiFetch<unknown>(path)
}, { method: 'get_readings' })

const listMonitors = sg.wrap(async (args: ListInput) => {
  let path = 'RAD_NET_GAMMA_GROSS'
  if (args.state) {
    path += `/STATE_ABBREVIATION/=${args.state.toUpperCase()}`
  }
  path += '/rows/0:50'
  return apiFetch<unknown>(path)
}, { method: 'list_monitors' })

const getHistory = sg.wrap(async (args: HistoryInput) => {
  if (!args.monitor || typeof args.monitor !== 'string') {
    throw new Error('monitor is required')
  }
  const path = `RAD_NET_GAMMA_GROSS/LOCATION_NAME/=${encodeURIComponent(args.monitor)}/rows/0:50`
  return apiFetch<unknown>(path)
}, { method: 'get_history' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getReadings, listMonitors, getHistory }

console.log('settlegrid-radiation MCP server ready')
console.log('Methods: get_readings, list_monitors, get_history')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
