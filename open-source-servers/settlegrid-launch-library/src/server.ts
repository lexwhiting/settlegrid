/**
 * settlegrid-launch-library — Launch Library MCP Server
 *
 * Wraps the Launch Library API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_upcoming()                           (1¢)
 *   get_astronauts()                         (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetUpcomingInput {
  limit?: number
}

interface GetAstronautsInput {
  search?: string
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://ll.thespacedevs.com/2.2.0'
const USER_AGENT = 'settlegrid-launch-library/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Launch Library API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'launch-library',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_upcoming: { costCents: 1, displayName: 'Get upcoming space launches' },
      get_astronauts: { costCents: 1, displayName: 'List astronauts' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getUpcoming = sg.wrap(async (args: GetUpcomingInput) => {

  const params: Record<string, string> = {}
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>('/launch/upcoming/', {
    params,
  })

  return data
}, { method: 'get_upcoming' })

const getAstronauts = sg.wrap(async (args: GetAstronautsInput) => {

  const params: Record<string, string> = {}
  if (args.search !== undefined) params['search'] = String(args.search)
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>('/astronaut/', {
    params,
  })

  return data
}, { method: 'get_astronauts' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getUpcoming, getAstronauts }

console.log('settlegrid-launch-library MCP server ready')
console.log('Methods: get_upcoming, get_astronauts')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
