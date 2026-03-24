/**
 * settlegrid-nasa-neo — NASA Near-Earth Objects MCP Server
 *
 * Wraps the NASA Near-Earth Objects API with SettleGrid billing.
 * Requires NASA_API_KEY environment variable.
 *
 * Methods:
 *   get_feed(start_date)                     (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetFeedInput {
  start_date: string
  end_date?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.nasa.gov'
const USER_AGENT = 'settlegrid-nasa-neo/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`NASA Near-Earth Objects API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'nasa-neo',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_feed: { costCents: 2, displayName: 'Get near-Earth objects for a date range' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getFeed = sg.wrap(async (args: GetFeedInput) => {
  if (!args.start_date || typeof args.start_date !== 'string') {
    throw new Error('start_date is required (start date yyyy-mm-dd)')
  }

  const params: Record<string, string> = {}
  params['start_date'] = args.start_date
  if (args.end_date !== undefined) params['end_date'] = String(args.end_date)

  const data = await apiFetch<Record<string, unknown>>('/neo/rest/v1/feed', {
    params,
  })

  return data
}, { method: 'get_feed' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getFeed }

console.log('settlegrid-nasa-neo MCP server ready')
console.log('Methods: get_feed')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
