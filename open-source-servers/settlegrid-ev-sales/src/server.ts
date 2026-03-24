/**
 * settlegrid-ev-sales — Electric Vehicle Sales Data MCP Server
 *
 * Provides EV sales statistics by country via the IEA Global EV Data Explorer.
 * No API key needed.
 *
 * Methods:
 *   get_ev_sales(country)            (1¢)
 *   get_ev_stock(country)            (1¢)
 *   get_ev_market_share(country)     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface EvInput { country: string }

const API_BASE = 'https://api.iea.org/evs'
const USER_AGENT = 'settlegrid-ev-sales/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(API_BASE)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`IEA API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'ev-sales',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_ev_sales: { costCents: 1, displayName: 'Get EV sales by country' },
      get_ev_stock: { costCents: 1, displayName: 'Get EV stock by country' },
      get_ev_market_share: { costCents: 1, displayName: 'Get EV market share' },
    },
  },
})

const getEvSales = sg.wrap(async (args: EvInput) => {
  if (!args.country) throw new Error('country is required')
  const data = await apiFetch<Record<string, unknown>>({
    parameters: 'EV sales',
    category: 'Historical',
    countries: args.country,
  })
  return { country: args.country, metric: 'EV sales', ...data }
}, { method: 'get_ev_sales' })

const getEvStock = sg.wrap(async (args: EvInput) => {
  if (!args.country) throw new Error('country is required')
  const data = await apiFetch<Record<string, unknown>>({
    parameters: 'EV stock',
    category: 'Historical',
    countries: args.country,
  })
  return { country: args.country, metric: 'EV stock', ...data }
}, { method: 'get_ev_stock' })

const getEvMarketShare = sg.wrap(async (args: EvInput) => {
  if (!args.country) throw new Error('country is required')
  const data = await apiFetch<Record<string, unknown>>({
    parameters: 'EV sales share',
    category: 'Historical',
    countries: args.country,
  })
  return { country: args.country, metric: 'EV market share', ...data }
}, { method: 'get_ev_market_share' })

export { getEvSales, getEvStock, getEvMarketShare }

console.log('settlegrid-ev-sales MCP server ready')
console.log('Methods: get_ev_sales, get_ev_stock, get_ev_market_share')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
