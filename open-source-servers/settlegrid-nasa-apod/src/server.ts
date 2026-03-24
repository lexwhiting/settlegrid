/**
 * settlegrid-nasa-apod — NASA APOD MCP Server
 *
 * Wraps the NASA APOD API with SettleGrid billing.
 * Requires NASA_API_KEY environment variable.
 *
 * Methods:
 *   get_today()                              (1¢)
 *   get_by_date(date)                        (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetTodayInput {
}

interface GetByDateInput {
  date: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.nasa.gov'
const USER_AGENT = 'settlegrid-nasa-apod/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`NASA APOD API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'nasa-apod',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_today: { costCents: 1, displayName: 'Get today's Astronomy Picture of the Day' },
      get_by_date: { costCents: 1, displayName: 'Get APOD for a specific date' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getToday = sg.wrap(async (args: GetTodayInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/planetary/apod', {
    params,
  })

  return data
}, { method: 'get_today' })

const getByDate = sg.wrap(async (args: GetByDateInput) => {
  if (!args.date || typeof args.date !== 'string') {
    throw new Error('date is required (date in yyyy-mm-dd format)')
  }

  const params: Record<string, string> = {}
  params['date'] = args.date

  const data = await apiFetch<Record<string, unknown>>('/planetary/apod', {
    params,
  })

  return data
}, { method: 'get_by_date' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getToday, getByDate }

console.log('settlegrid-nasa-apod MCP server ready')
console.log('Methods: get_today, get_by_date')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
