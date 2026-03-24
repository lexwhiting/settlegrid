/**
 * settlegrid-epa-data — EPA Environmental Data MCP Server
 *
 * US EPA air quality and environmental monitoring data from AQS API.
 *
 * Methods:
 *   list_states()                 — List all US states with monitoring data  (1¢)
 *   get_monitors(state, county)   — Get air quality monitors by state and county  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListStatesInput {

}

interface GetMonitorsInput {
  state: string
  county: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://aqs.epa.gov/data/api'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-epa-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`EPA Environmental Data API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'epa-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_states: { costCents: 1, displayName: 'List States' },
      get_monitors: { costCents: 1, displayName: 'Get Monitors' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listStates = sg.wrap(async (args: ListStatesInput) => {

  const data = await apiFetch<any>(`/list/states?email=test@aqs.api&key=test`)
  const items = (data.Data ?? []).slice(0, 60)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        code: item.code,
        value_represented: item.value_represented,
    })),
  }
}, { method: 'list_states' })

const getMonitors = sg.wrap(async (args: GetMonitorsInput) => {
  if (!args.state || typeof args.state !== 'string') throw new Error('state is required')
  const state = args.state.trim()
  if (!args.county || typeof args.county !== 'string') throw new Error('county is required')
  const county = args.county.trim()
  const data = await apiFetch<any>(`/monitors/byCounty?email=test@aqs.api&key=test&param=44201&bdate=20240101&edate=20240131&state=${encodeURIComponent(state)}&county=${encodeURIComponent(county)}`)
  const items = (data.Data ?? []).slice(0, 20)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        si_id: item.si_id,
        local_site_name: item.local_site_name,
        status: item.status,
        latitude: item.latitude,
        longitude: item.longitude,
    })),
  }
}, { method: 'get_monitors' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listStates, getMonitors }

console.log('settlegrid-epa-data MCP server ready')
console.log('Methods: list_states, get_monitors')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
