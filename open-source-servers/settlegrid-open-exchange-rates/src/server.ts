/**
 * settlegrid-open-exchange-rates — Open Exchange Rates MCP Server
 *
 * Wraps the Open Exchange Rates API with SettleGrid billing.
 * Requires OXR_APP_ID environment variable.
 *
 * Methods:
 *   get_latest(base?)              — Latest rates         (2¢)
 *   get_historical(date, base?)    — Historical rates     (2¢)
 *   get_currencies()               — List currencies      (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LatestInput { base?: string }
interface HistoricalInput { date: string; base?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://openexchangerates.org/api'

function getKey(): string {
  const k = process.env.OXR_APP_ID
  if (!k) throw new Error('OXR_APP_ID environment variable is required')
  return k
}

async function oxrFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  url.searchParams.set('app_id', getKey())
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-open-exchange-rates/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Open Exchange Rates API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'open-exchange-rates',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_latest: { costCents: 2, displayName: 'Latest Rates' },
      get_historical: { costCents: 2, displayName: 'Historical Rates' },
      get_currencies: { costCents: 1, displayName: 'List Currencies' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getLatest = sg.wrap(async (args: LatestInput) => {
  const params: Record<string, string> = {}
  if (args.base) params.base = args.base.toUpperCase().trim()
  const data = await oxrFetch<{ base: string; timestamp: number; rates: Record<string, number> }>('/latest.json', params)
  return { base: data.base, timestamp: data.timestamp, rates: data.rates }
}, { method: 'get_latest' })

const getHistorical = sg.wrap(async (args: HistoricalInput) => {
  if (!args.date || !/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
    throw new Error('date is required (YYYY-MM-DD format)')
  }
  const params: Record<string, string> = {}
  if (args.base) params.base = args.base.toUpperCase().trim()
  const data = await oxrFetch<{ base: string; timestamp: number; rates: Record<string, number> }>(`/historical/${args.date}.json`, params)
  return { date: args.date, base: data.base, timestamp: data.timestamp, rates: data.rates }
}, { method: 'get_historical' })

const getCurrencies = sg.wrap(async () => {
  const data = await oxrFetch<Record<string, string>>('/currencies.json')
  return { count: Object.keys(data).length, currencies: data }
}, { method: 'get_currencies' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getLatest, getHistorical, getCurrencies }

console.log('settlegrid-open-exchange-rates MCP server ready')
console.log('Methods: get_latest, get_historical, get_currencies')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
