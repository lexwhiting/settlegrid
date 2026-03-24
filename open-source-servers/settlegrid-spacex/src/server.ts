/**
 * settlegrid-spacex — SpaceX MCP Server
 *
 * Wraps the SpaceX API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_launches()                           (1¢)
 *   get_upcoming()                           (1¢)
 *   get_rockets()                            (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetLaunchesInput {
}

interface GetUpcomingInput {
}

interface GetRocketsInput {
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.spacexdata.com/v4'
const USER_AGENT = 'settlegrid-spacex/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  method?: string
  params?: Record<string, string>
  body?: unknown
  headers?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    ...options.headers,
  }
  const fetchOpts: RequestInit = { method: options.method ?? 'GET', headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
    ;(headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  const res = await fetch(url.toString(), fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`SpaceX API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'spacex',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_launches: { costCents: 1, displayName: 'Get latest SpaceX launches' },
      get_upcoming: { costCents: 1, displayName: 'Get upcoming SpaceX launches' },
      get_rockets: { costCents: 1, displayName: 'Get all SpaceX rockets' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getLaunches = sg.wrap(async (args: GetLaunchesInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/launches/latest', {
    params,
  })

  return data
}, { method: 'get_launches' })

const getUpcoming = sg.wrap(async (args: GetUpcomingInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/launches/upcoming', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 10) : [data]

  return { count: items.length, results: items }
}, { method: 'get_upcoming' })

const getRockets = sg.wrap(async (args: GetRocketsInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/rockets', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 50) : [data]

  return { count: items.length, results: items }
}, { method: 'get_rockets' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getLaunches, getUpcoming, getRockets }

console.log('settlegrid-spacex MCP server ready')
console.log('Methods: get_launches, get_upcoming, get_rockets')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
