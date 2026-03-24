/**
 * settlegrid-exchangerate-host — ExchangeRate.host MCP Server
 *
 * Wraps the ExchangeRate.host API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_latest()                             (1¢)
 *   convert(from, to, amount)                (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetLatestInput {
  base?: string
  symbols?: string
}

interface ConvertInput {
  from: string
  to: string
  amount: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.exchangerate.host'
const USER_AGENT = 'settlegrid-exchangerate-host/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`ExchangeRate.host API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'exchangerate-host',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_latest: { costCents: 1, displayName: 'Get latest exchange rates' },
      convert: { costCents: 1, displayName: 'Convert between currencies' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getLatest = sg.wrap(async (args: GetLatestInput) => {

  const params: Record<string, string> = {}
  if (args.base !== undefined) params['base'] = String(args.base)
  if (args.symbols !== undefined) params['symbols'] = String(args.symbols)

  const data = await apiFetch<Record<string, unknown>>('/latest', {
    params,
  })

  return data
}, { method: 'get_latest' })

const convert = sg.wrap(async (args: ConvertInput) => {
  if (!args.from || typeof args.from !== 'string') {
    throw new Error('from is required (source currency)')
  }
  if (!args.to || typeof args.to !== 'string') {
    throw new Error('to is required (target currency)')
  }
  if (typeof args.amount !== 'number' || isNaN(args.amount)) {
    throw new Error('amount must be a number')
  }

  const params: Record<string, string> = {}
  params['from'] = args.from
  params['to'] = args.to
  params['amount'] = String(args.amount)

  const data = await apiFetch<Record<string, unknown>>('/convert', {
    params,
  })

  return data
}, { method: 'convert' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getLatest, convert }

console.log('settlegrid-exchangerate-host MCP server ready')
console.log('Methods: get_latest, convert')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
