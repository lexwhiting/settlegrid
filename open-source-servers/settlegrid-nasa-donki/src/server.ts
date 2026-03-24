/**
 * settlegrid-nasa-donki — NASA DONKI MCP Server
 *
 * Wraps the NASA DONKI API with SettleGrid billing.
 * Requires NASA_API_KEY environment variable.
 *
 * Methods:
 *   get_cme()                                (1¢)
 *   get_solar_flare()                        (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetCmeInput {
  startDate?: string
  endDate?: string
}

interface GetSolarFlareInput {
  startDate?: string
  endDate?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.nasa.gov/DONKI'
const USER_AGENT = 'settlegrid-nasa-donki/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  return process.env.NASA_API_KEY ?? 'DEMO_KEY'
}

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
  url.searchParams.set('api_key', getApiKey())
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
    throw new Error(`NASA DONKI API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'nasa-donki',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_cme: { costCents: 1, displayName: 'Get coronal mass ejection events' },
      get_solar_flare: { costCents: 1, displayName: 'Get solar flare events' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCme = sg.wrap(async (args: GetCmeInput) => {

  const params: Record<string, string> = {}
  if (args.startDate !== undefined) params['startDate'] = String(args.startDate)
  if (args.endDate !== undefined) params['endDate'] = String(args.endDate)

  const data = await apiFetch<Record<string, unknown>>('/CME', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 50) : [data]

  return { count: items.length, results: items }
}, { method: 'get_cme' })

const getSolarFlare = sg.wrap(async (args: GetSolarFlareInput) => {

  const params: Record<string, string> = {}
  if (args.startDate !== undefined) params['startDate'] = String(args.startDate)
  if (args.endDate !== undefined) params['endDate'] = String(args.endDate)

  const data = await apiFetch<Record<string, unknown>>('/FLR', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 50) : [data]

  return { count: items.length, results: items }
}, { method: 'get_solar_flare' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCme, getSolarFlare }

console.log('settlegrid-nasa-donki MCP server ready')
console.log('Methods: get_cme, get_solar_flare')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
