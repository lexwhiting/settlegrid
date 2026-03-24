/**
 * settlegrid-coinbase — Coinbase MCP Server
 *
 * Wraps the Coinbase API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_price(pair)                          (1¢)
 *   get_currencies()                         (1¢)
 *   get_exchange_rates()                     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetPriceInput {
  pair: string
}

interface GetCurrenciesInput {
}

interface GetExchangeRatesInput {
  currency?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.coinbase.com/v2'
const USER_AGENT = 'settlegrid-coinbase/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Coinbase API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'coinbase',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_price: { costCents: 1, displayName: 'Get current buy/sell price for a crypto pair' },
      get_currencies: { costCents: 1, displayName: 'List supported currencies' },
      get_exchange_rates: { costCents: 1, displayName: 'Get exchange rates for a currency' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPrice = sg.wrap(async (args: GetPriceInput) => {
  if (!args.pair || typeof args.pair !== 'string') {
    throw new Error('pair is required (currency pair (e.g. btc-usd))')
  }

  const params: Record<string, string> = {}
  params['pair'] = String(args.pair)

  const data = await apiFetch<Record<string, unknown>>(`/prices/${encodeURIComponent(String(args.pair))}/spot`, {
    params,
  })

  return data
}, { method: 'get_price' })

const getCurrencies = sg.wrap(async (args: GetCurrenciesInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/currencies', {
    params,
  })

  return data
}, { method: 'get_currencies' })

const getExchangeRates = sg.wrap(async (args: GetExchangeRatesInput) => {

  const params: Record<string, string> = {}
  if (args.currency !== undefined) params['currency'] = String(args.currency)

  const data = await apiFetch<Record<string, unknown>>('/exchange-rates', {
    params,
  })

  return data
}, { method: 'get_exchange_rates' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPrice, getCurrencies, getExchangeRates }

console.log('settlegrid-coinbase MCP server ready')
console.log('Methods: get_price, get_currencies, get_exchange_rates')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
