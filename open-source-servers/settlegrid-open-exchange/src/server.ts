/**
 * settlegrid-open-exchange — Open Exchange Rates MCP Server
 *
 * Wraps the Open Exchange Rates API with SettleGrid billing.
 * Requires OPEN_EXCHANGE_APP_ID environment variable.
 *
 * Methods:
 *   get_latest()                             (1¢)
 *   get_currencies()                         (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetLatestInput {
  base?: string
}

interface GetCurrenciesInput {
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://openexchangerates.org/api'
const USER_AGENT = 'settlegrid-open-exchange/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.OPEN_EXCHANGE_APP_ID
  if (!key) throw new Error('OPEN_EXCHANGE_APP_ID environment variable is required')
  return key
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
  url.searchParams.set('app_id', getApiKey())
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
    throw new Error(`Open Exchange Rates API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'open-exchange',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_latest: { costCents: 1, displayName: 'Get latest exchange rates' },
      get_currencies: { costCents: 1, displayName: 'Get list of all supported currencies' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getLatest = sg.wrap(async (args: GetLatestInput) => {

  const params: Record<string, string> = {}
  if (args.base !== undefined) params['base'] = String(args.base)

  const data = await apiFetch<Record<string, unknown>>('/latest.json', {
    params,
  })

  return data
}, { method: 'get_latest' })

const getCurrencies = sg.wrap(async (args: GetCurrenciesInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/currencies.json', {
    params,
  })

  return data
}, { method: 'get_currencies' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getLatest, getCurrencies }

console.log('settlegrid-open-exchange MCP server ready')
console.log('Methods: get_latest, get_currencies')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
