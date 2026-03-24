/**
 * settlegrid-nasa-epic — NASA EPIC MCP Server
 *
 * Wraps the NASA EPIC API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_natural()                            (1¢)
 *   get_by_date(date)                        (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetNaturalInput {
}

interface GetByDateInput {
  date: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://epic.gsfc.nasa.gov/api'
const USER_AGENT = 'settlegrid-nasa-epic/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`NASA EPIC API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'nasa-epic',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_natural: { costCents: 1, displayName: 'Get latest natural color Earth images' },
      get_by_date: { costCents: 1, displayName: 'Get Earth images for a specific date' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getNatural = sg.wrap(async (args: GetNaturalInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/natural', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 10) : [data]

  return { count: items.length, results: items }
}, { method: 'get_natural' })

const getByDate = sg.wrap(async (args: GetByDateInput) => {
  if (!args.date || typeof args.date !== 'string') {
    throw new Error('date is required (date in yyyy-mm-dd format)')
  }

  const params: Record<string, string> = {}
  params['date'] = String(args.date)

  const data = await apiFetch<Record<string, unknown>>(`/natural/date/${encodeURIComponent(String(args.date))}`, {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 10) : [data]

  return { date: args.date, count: items.length, results: items }
}, { method: 'get_by_date' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getNatural, getByDate }

console.log('settlegrid-nasa-epic MCP server ready')
console.log('Methods: get_natural, get_by_date')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
