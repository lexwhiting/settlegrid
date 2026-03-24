/**
 * settlegrid-bls-stats — BLS Statistics MCP Server
 *
 * Wraps the BLS Statistics API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_series(seriesId)                     (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetSeriesInput {
  seriesId: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.bls.gov/publicAPI/v2'
const USER_AGENT = 'settlegrid-bls-stats/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`BLS Statistics API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'bls-stats',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_series: { costCents: 2, displayName: 'Get time series data by series ID' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getSeries = sg.wrap(async (args: GetSeriesInput) => {
  if (!args.seriesId || typeof args.seriesId !== 'string') {
    throw new Error('seriesId is required (bls series id (e.g. lns14000000 for unemployment))')
  }

  const params: Record<string, string> = {}
  params['seriesId'] = String(args.seriesId)

  const data = await apiFetch<Record<string, unknown>>(`/timeseries/data/${encodeURIComponent(String(args.seriesId))}`, {
    params,
  })

  return data
}, { method: 'get_series' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getSeries }

console.log('settlegrid-bls-stats MCP server ready')
console.log('Methods: get_series')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
