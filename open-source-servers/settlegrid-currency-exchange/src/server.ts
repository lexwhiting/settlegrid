/**
 * settlegrid-currency-exchange — Currency Exchange Rate MCP Server
 *
 * Wraps the free Frankfurter API (ECB reference rates) with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_rate(from, to)                      — Latest exchange rate      (1¢)
 *   convert(amount, from, to)               — Convert currency amount   (1¢)
 *   get_historical(date, from, to)          — Historical rate by date   (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetRateInput {
  from: string
  to: string
}

interface ConvertInput {
  amount: number
  from: string
  to: string
}

interface HistoricalInput {
  date: string
  from: string
  to: string
}

interface FrankfurterResponse {
  amount: number
  base: string
  date: string
  rates: Record<string, number>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.frankfurter.app'

const VALID_CURRENCIES = new Set([
  'AUD', 'BGN', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP',
  'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'MYR',
  'NOK', 'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD',
  'ZAR',
])

function validateCurrency(code: string, field: string): string {
  const upper = code.toUpperCase().trim()
  if (!VALID_CURRENCIES.has(upper)) {
    throw new Error(
      `Invalid ${field} currency "${code}". Supported: ${[...VALID_CURRENCIES].sort().join(', ')}`
    )
  }
  return upper
}

async function frankfurterFetch(path: string): Promise<FrankfurterResponse> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Frankfurter API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<FrankfurterResponse>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'currency-exchange',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_rate: { costCents: 1, displayName: 'Get Exchange Rate' },
      convert: { costCents: 1, displayName: 'Convert Currency' },
      get_historical: { costCents: 2, displayName: 'Historical Rate' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRate = sg.wrap(async (args: GetRateInput) => {
  if (!args.from || !args.to) {
    throw new Error('from and to currency codes are required (e.g. "USD", "EUR")')
  }
  const from = validateCurrency(args.from, 'from')
  const to = validateCurrency(args.to, 'to')

  const data = await frankfurterFetch(`/latest?from=${from}&to=${to}`)

  return {
    from,
    to,
    rate: data.rates[to],
    date: data.date,
    source: 'European Central Bank',
  }
}, { method: 'get_rate' })

const convert = sg.wrap(async (args: ConvertInput) => {
  if (typeof args.amount !== 'number' || args.amount <= 0) {
    throw new Error('amount must be a positive number')
  }
  if (!args.from || !args.to) {
    throw new Error('from and to currency codes are required')
  }
  const from = validateCurrency(args.from, 'from')
  const to = validateCurrency(args.to, 'to')

  const data = await frankfurterFetch(`/latest?amount=${args.amount}&from=${from}&to=${to}`)

  return {
    amount: args.amount,
    from,
    to,
    converted: data.rates[to],
    rate: data.rates[to] / args.amount,
    date: data.date,
    source: 'European Central Bank',
  }
}, { method: 'convert' })

const getHistorical = sg.wrap(async (args: HistoricalInput) => {
  if (!args.date || typeof args.date !== 'string') {
    throw new Error('date is required (YYYY-MM-DD format)')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
    throw new Error('date must be in YYYY-MM-DD format (e.g. "2024-01-15")')
  }
  if (!args.from || !args.to) {
    throw new Error('from and to currency codes are required')
  }
  const from = validateCurrency(args.from, 'from')
  const to = validateCurrency(args.to, 'to')

  const data = await frankfurterFetch(`/${args.date}?from=${from}&to=${to}`)

  return {
    from,
    to,
    rate: data.rates[to],
    requestedDate: args.date,
    actualDate: data.date,
    source: 'European Central Bank',
  }
}, { method: 'get_historical' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRate, convert, getHistorical }

// ─── REST Alternative (uncomment to serve as HTTP) ──────────────────────────
//
// import { settlegridMiddleware } from '@settlegrid/mcp'
// const middleware = settlegridMiddleware({
//   toolSlug: 'currency-exchange',
//   pricing: { defaultCostCents: 1, methods: { get_historical: { costCents: 2 } } },
//   routes: { ... },
// })

console.log('settlegrid-currency-exchange MCP server ready')
console.log('Methods: get_rate, convert, get_historical')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
