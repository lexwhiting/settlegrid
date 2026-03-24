/**
 * settlegrid-exchange-office — Local Money Exchange Rates MCP Server
 *
 * Provides currency exchange rates via Frankfurter API (ECB data).
 * No API key needed.
 *
 * Methods:
 *   get_latest_rates(base, symbols)       (1¢)
 *   convert(from, to, amount)             (1¢)
 *   get_historical(date, base, symbols)   (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetLatestRatesInput {
  base?: string
  symbols?: string
}

interface ConvertInput {
  from: string
  to: string
  amount: number
}

interface GetHistoricalInput {
  date: string
  base?: string
  symbols?: string
}

const API_BASE = 'https://api.frankfurter.app'
const USER_AGENT = 'settlegrid-exchange-office/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Frankfurter API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'exchange-office',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_latest_rates: { costCents: 1, displayName: 'Get latest exchange rates' },
      convert: { costCents: 1, displayName: 'Convert currency amount' },
      get_historical: { costCents: 1, displayName: 'Get historical rates' },
    },
  },
})

const getLatestRates = sg.wrap(async (args: GetLatestRatesInput) => {
  const params: Record<string, string> = {}
  if (args.base) params.from = args.base.toUpperCase()
  if (args.symbols) params.to = args.symbols.toUpperCase()
  const data = await apiFetch<Record<string, unknown>>('/latest', params)
  return data
}, { method: 'get_latest_rates' })

const convert = sg.wrap(async (args: ConvertInput) => {
  if (!args.from || !args.to || args.amount === undefined) {
    throw new Error('from, to, and amount are all required')
  }
  if (typeof args.amount !== 'number' || args.amount <= 0) {
    throw new Error('amount must be a positive number')
  }
  const params: Record<string, string> = {
    from: args.from.toUpperCase(),
    to: args.to.toUpperCase(),
    amount: String(args.amount),
  }
  const data = await apiFetch<Record<string, unknown>>('/latest', params)
  return data
}, { method: 'convert' })

const getHistorical = sg.wrap(async (args: GetHistoricalInput) => {
  if (!args.date || typeof args.date !== 'string') {
    throw new Error('date is required (YYYY-MM-DD)')
  }
  const params: Record<string, string> = {}
  if (args.base) params.from = args.base.toUpperCase()
  if (args.symbols) params.to = args.symbols.toUpperCase()
  const data = await apiFetch<Record<string, unknown>>(`/${args.date}`, params)
  return data
}, { method: 'get_historical' })

export { getLatestRates, convert, getHistorical }

console.log('settlegrid-exchange-office MCP server ready')
console.log('Methods: get_latest_rates, convert, get_historical')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
