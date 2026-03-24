/**
 * settlegrid-fixer-io — Fixer.io Exchange Rates MCP Server
 *
 * Wraps the Fixer.io API with SettleGrid billing.
 * Requires FIXER_API_KEY environment variable.
 *
 * Methods:
 *   get_latest(base?, symbols?)     — Latest rates        (2¢)
 *   get_historical(date, base?)     — Historical rates    (2¢)
 *   get_symbols()                   — List currencies     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LatestInput { base?: string; symbols?: string }
interface HistoricalInput { date: string; base?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://data.fixer.io/api'

function getKey(): string {
  const k = process.env.FIXER_API_KEY
  if (!k) throw new Error('FIXER_API_KEY environment variable is required')
  return k
}

async function fixerFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  url.searchParams.set('access_key', getKey())
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-fixer-io/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Fixer.io API ${res.status}: ${body.slice(0, 200)}`)
  }
  const json = await res.json() as T & { success?: boolean; error?: { info?: string } }
  if (json.success === false) {
    throw new Error(`Fixer.io error: ${json.error?.info ?? 'Unknown error'}`)
  }
  return json
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'fixer-io',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_latest: { costCents: 2, displayName: 'Latest Rates' },
      get_historical: { costCents: 2, displayName: 'Historical Rates' },
      get_symbols: { costCents: 1, displayName: 'List Currencies' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getLatest = sg.wrap(async (args: LatestInput) => {
  const params: Record<string, string> = {}
  if (args.base) params.base = args.base.toUpperCase().trim()
  if (args.symbols) params.symbols = args.symbols.toUpperCase().trim()
  const data = await fixerFetch<{ base: string; date: string; rates: Record<string, number> }>('/latest', params)
  return { base: data.base, date: data.date, rates: data.rates }
}, { method: 'get_latest' })

const getHistorical = sg.wrap(async (args: HistoricalInput) => {
  if (!args.date || !/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
    throw new Error('date is required (YYYY-MM-DD)')
  }
  const params: Record<string, string> = {}
  if (args.base) params.base = args.base.toUpperCase().trim()
  const data = await fixerFetch<{ base: string; date: string; rates: Record<string, number> }>(`/${args.date}`, params)
  return { date: data.date, base: data.base, rates: data.rates }
}, { method: 'get_historical' })

const getSymbols = sg.wrap(async () => {
  const data = await fixerFetch<{ symbols: Record<string, string> }>('/symbols')
  return { count: Object.keys(data.symbols ?? {}).length, symbols: data.symbols }
}, { method: 'get_symbols' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getLatest, getHistorical, getSymbols }

console.log('settlegrid-fixer-io MCP server ready')
console.log('Methods: get_latest, get_historical, get_symbols')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
