/**
 * settlegrid-ecb-exchange — ECB Exchange Rates MCP Server
 *
 * Wraps the ECB Exchange Rates API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_latest()                             (1¢)
 *   get_historical(date)                     (1¢)
 *   get_time_series(start, end)              (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetLatestInput {
  from?: string
  to?: string
}

interface GetHistoricalInput {
  date: string
  from?: string
}

interface GetTimeSeriesInput {
  start: string
  end: string
  from?: string
  to?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.frankfurter.app'
const USER_AGENT = 'settlegrid-ecb-exchange/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`ECB Exchange Rates API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'ecb-exchange',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_latest: { costCents: 1, displayName: 'Get latest ECB exchange rates' },
      get_historical: { costCents: 1, displayName: 'Get historical exchange rates for a date' },
      get_time_series: { costCents: 2, displayName: 'Get exchange rate time series' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getLatest = sg.wrap(async (args: GetLatestInput) => {

  const params: Record<string, string> = {}
  if (args.from !== undefined) params['from'] = String(args.from)
  if (args.to !== undefined) params['to'] = String(args.to)

  const data = await apiFetch<Record<string, unknown>>('/latest', {
    params,
  })

  return data
}, { method: 'get_latest' })

const getHistorical = sg.wrap(async (args: GetHistoricalInput) => {
  if (!args.date || typeof args.date !== 'string') {
    throw new Error('date is required (date in yyyy-mm-dd format)')
  }

  const params: Record<string, string> = {}
  if (args.from !== undefined) params['from'] = String(args.from)

  const data = await apiFetch<Record<string, unknown>>(`/${encodeURIComponent(String(args.date))}`, {
    params,
  })

  return data
}, { method: 'get_historical' })

const getTimeSeries = sg.wrap(async (args: GetTimeSeriesInput) => {
  if (!args.start || typeof args.start !== 'string') {
    throw new Error('start is required (start date yyyy-mm-dd)')
  }
  if (!args.end || typeof args.end !== 'string') {
    throw new Error('end is required (end date yyyy-mm-dd)')
  }

  const params: Record<string, string> = {}
  if (args.from !== undefined) params['from'] = String(args.from)
  if (args.to !== undefined) params['to'] = String(args.to)

  const data = await apiFetch<Record<string, unknown>>(`/${encodeURIComponent(String(args.start))}..${encodeURIComponent(String(args.end))}`, {
    params,
  })

  return data
}, { method: 'get_time_series' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getLatest, getHistorical, getTimeSeries }

console.log('settlegrid-ecb-exchange MCP server ready')
console.log('Methods: get_latest, get_historical, get_time_series')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
