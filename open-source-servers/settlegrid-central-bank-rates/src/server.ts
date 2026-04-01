/**
 * settlegrid-central-bank-rates — Central Bank Interest Rates MCP Server
 *
 * Provides central bank policy rates for major economies worldwide.
 * Reference data enriched with historical context.
 *
 * Methods:
 *   get_rate(bank)                — Get current policy rate           (2c)
 *   list_rates()                  — List all tracked central banks    (2c)
 *   get_rate_history(bank)        — Get recent rate change history    (2c)
 */

import { settlegrid } from '@settlegrid/mcp'

// --- Types ------------------------------------------------------------------

interface GetRateInput {
  bank: string
}

interface GetHistoryInput {
  bank: string
}

interface BankData {
  name: string
  country: string
  rate_pct: number
  last_change: string
  direction: string
  currency: string
}

// --- Data -------------------------------------------------------------------

const BANKS: Record<string, BankData> = {
  fed: { name: 'Federal Reserve', country: 'United States', rate_pct: 5.25, last_change: '2023-07-26', direction: 'hold', currency: 'USD' },
  ecb: { name: 'European Central Bank', country: 'Eurozone', rate_pct: 4.50, last_change: '2023-09-14', direction: 'hold', currency: 'EUR' },
  boe: { name: 'Bank of England', country: 'United Kingdom', rate_pct: 5.25, last_change: '2023-08-03', direction: 'hold', currency: 'GBP' },
  boj: { name: 'Bank of Japan', country: 'Japan', rate_pct: -0.10, last_change: '2016-01-29', direction: 'hold', currency: 'JPY' },
  pboc: { name: "People's Bank of China", country: 'China', rate_pct: 3.45, last_change: '2023-08-21', direction: 'cut', currency: 'CNY' },
  rba: { name: 'Reserve Bank of Australia', country: 'Australia', rate_pct: 4.35, last_change: '2023-11-07', direction: 'hike', currency: 'AUD' },
  boc: { name: 'Bank of Canada', country: 'Canada', rate_pct: 5.00, last_change: '2023-07-12', direction: 'hold', currency: 'CAD' },
  snb: { name: 'Swiss National Bank', country: 'Switzerland', rate_pct: 1.75, last_change: '2023-06-22', direction: 'hike', currency: 'CHF' },
  rbi: { name: 'Reserve Bank of India', country: 'India', rate_pct: 6.50, last_change: '2023-02-08', direction: 'hold', currency: 'INR' },
  bcb: { name: 'Banco Central do Brasil', country: 'Brazil', rate_pct: 12.25, last_change: '2023-08-02', direction: 'cut', currency: 'BRL' },
  sarb: { name: 'South African Reserve Bank', country: 'South Africa', rate_pct: 8.25, last_change: '2023-05-25', direction: 'hold', currency: 'ZAR' },
  cbrt: { name: 'Central Bank of Turkey', country: 'Turkey', rate_pct: 40.00, last_change: '2023-11-23', direction: 'hike', currency: 'TRY' },
}

const RATE_HISTORY: Record<string, Array<{ date: string; rate: number; action: string }>> = {
  fed: [
    { date: '2023-07-26', rate: 5.25, action: 'hike +25bp' },
    { date: '2023-05-03', rate: 5.00, action: 'hike +25bp' },
    { date: '2023-03-22', rate: 4.75, action: 'hike +25bp' },
    { date: '2023-02-01', rate: 4.50, action: 'hike +25bp' },
    { date: '2022-12-14', rate: 4.25, action: 'hike +50bp' },
  ],
  ecb: [
    { date: '2023-09-14', rate: 4.50, action: 'hike +25bp' },
    { date: '2023-07-27', rate: 4.25, action: 'hike +25bp' },
    { date: '2023-06-15', rate: 4.00, action: 'hike +25bp' },
    { date: '2023-05-04', rate: 3.75, action: 'hike +25bp' },
  ],
  boe: [
    { date: '2023-08-03', rate: 5.25, action: 'hike +25bp' },
    { date: '2023-06-22', rate: 5.00, action: 'hike +50bp' },
    { date: '2023-05-11', rate: 4.50, action: 'hike +25bp' },
  ],
}

// --- SettleGrid Init --------------------------------------------------------

const sg = settlegrid.init({
  toolSlug: 'central-bank-rates',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_rate: { costCents: 2, displayName: 'Get Interest Rate' },
      list_rates: { costCents: 2, displayName: 'List All Rates' },
      get_rate_history: { costCents: 2, displayName: 'Get Rate History' },
    },
  },
})

// --- Handlers ---------------------------------------------------------------

const getRate = sg.wrap(async (args: GetRateInput) => {
  if (!args.bank || typeof args.bank !== 'string') {
    throw new Error('bank is required (e.g. "fed", "ecb", "boj")')
  }
  const key = args.bank.toLowerCase()
  const bank = BANKS[key]
  if (!bank) {
    throw new Error(`Unknown bank "${args.bank}". Available: ${Object.keys(BANKS).join(', ')}`)
  }
  return { key, ...bank, data_note: 'Reference rates — verify with official sources' }
}, { method: 'get_rate' })

const listRates = sg.wrap(async (_args: Record<string, never>) => {
  const rates = Object.entries(BANKS).map(([key, data]) => ({
    key,
    name: data.name,
    country: data.country,
    rate_pct: data.rate_pct,
    currency: data.currency,
    direction: data.direction,
  }))
  return { count: rates.length, rates }
}, { method: 'list_rates' })

const getRateHistory = sg.wrap(async (args: GetHistoryInput) => {
  if (!args.bank || typeof args.bank !== 'string') {
    throw new Error('bank is required')
  }
  const key = args.bank.toLowerCase()
  const history = RATE_HISTORY[key]
  if (!history) {
    throw new Error(`History unavailable for "${args.bank}". Available: ${Object.keys(RATE_HISTORY).join(', ')}`)
  }
  return { bank: key, name: BANKS[key]?.name ?? key, changes: history, count: history.length }
}, { method: 'get_rate_history' })

// --- Exports ----------------------------------------------------------------

export { getRate, listRates, getRateHistory }

console.log('settlegrid-central-bank-rates MCP server ready')
console.log('Methods: get_rate, list_rates, get_rate_history')
console.log('Pricing: 2c per call | Powered by SettleGrid')
