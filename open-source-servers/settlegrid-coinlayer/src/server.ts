/**
 * settlegrid-coinlayer — Coinlayer Crypto Rates MCP Server
 *
 * Wraps the Coinlayer API with SettleGrid billing.
 * Requires COINLAYER_API_KEY environment variable.
 *
 * Methods:
 *   get_live(target?, symbols?)       — Live rates         (2¢)
 *   get_historical(date, target?)     — Historical rates   (2¢)
 *   get_list()                        — Supported cryptos  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LiveInput { target?: string; symbols?: string }
interface HistoricalInput { date: string; target?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.coinlayer.com'

function getKey(): string {
  const k = process.env.COINLAYER_API_KEY
  if (!k) throw new Error('COINLAYER_API_KEY environment variable is required')
  return k
}

async function clFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  url.searchParams.set('access_key', getKey())
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-coinlayer/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Coinlayer API ${res.status}: ${body.slice(0, 200)}`)
  }
  const json = await res.json() as T & { success?: boolean; error?: { info?: string } }
  if (json.success === false) {
    throw new Error(`Coinlayer error: ${json.error?.info ?? 'Unknown error'}`)
  }
  return json
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'coinlayer',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_live: { costCents: 2, displayName: 'Live Rates' },
      get_historical: { costCents: 2, displayName: 'Historical Rates' },
      get_list: { costCents: 1, displayName: 'List Cryptos' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getLive = sg.wrap(async (args: LiveInput) => {
  const params: Record<string, string> = {}
  if (args.target) params.target = args.target.toUpperCase().trim()
  if (args.symbols) params.symbols = args.symbols.toUpperCase().trim()
  const data = await clFetch<{ target: string; rates: Record<string, number> }>('/live', params)
  return { target: data.target, rates: data.rates }
}, { method: 'get_live' })

const getHistorical = sg.wrap(async (args: HistoricalInput) => {
  if (!args.date || !/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
    throw new Error('date is required (YYYY-MM-DD)')
  }
  const params: Record<string, string> = {}
  if (args.target) params.target = args.target.toUpperCase().trim()
  const data = await clFetch<{ target: string; historical: boolean; date: string; rates: Record<string, number> }>(`/${args.date}`, params)
  return { date: data.date, target: data.target, rates: data.rates }
}, { method: 'get_historical' })

const getList = sg.wrap(async () => {
  const data = await clFetch<{ crypto: Record<string, Record<string, unknown>> }>('/list')
  return { count: Object.keys(data.crypto ?? {}).length, cryptocurrencies: data.crypto }
}, { method: 'get_list' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getLive, getHistorical, getList }

console.log('settlegrid-coinlayer MCP server ready')
console.log('Methods: get_live, get_historical, get_list')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
