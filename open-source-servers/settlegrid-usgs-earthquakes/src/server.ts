/**
 * settlegrid-usgs-earthquakes — USGS Earthquakes MCP Server
 *
 * Wraps the USGS Earthquakes API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_recent()                             (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetRecentInput {
  minmagnitude?: number
  limit?: number
  orderby?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://earthquake.usgs.gov/fdsnws/event/1'
const USER_AGENT = 'settlegrid-usgs-earthquakes/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`USGS Earthquakes API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'usgs-earthquakes',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_recent: { costCents: 1, displayName: 'Get recent earthquakes by magnitude' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRecent = sg.wrap(async (args: GetRecentInput) => {

  const params: Record<string, string> = {}
  if (args.minmagnitude !== undefined) params['minmagnitude'] = String(args.minmagnitude)
  if (args.limit !== undefined) params['limit'] = String(args.limit)
  if (args.orderby !== undefined) params['orderby'] = String(args.orderby)

  const data = await apiFetch<Record<string, unknown>>('/query', {
    params,
  })

  return data
}, { method: 'get_recent' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRecent }

console.log('settlegrid-usgs-earthquakes MCP server ready')
console.log('Methods: get_recent')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
