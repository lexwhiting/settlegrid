/**
 * settlegrid-usda-markets — USDA Farmers Markets MCP Server
 *
 * Wraps the USDA Farmers Markets API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_markets(zip)    — Search markets by zip code   (1¢)
 *   get_market(id)         — Market details by ID         (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { zip: string }
interface GetMarketInput { id: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://search.ams.usda.gov/farmersmarkets/v1/data.svc'
const ZIP_RE = /^\d{5}$/

async function usdaFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`USDA API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'usda-markets',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_markets: { costCents: 1, displayName: 'Search Markets' },
      get_market: { costCents: 1, displayName: 'Get Market Details' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchMarkets = sg.wrap(async (args: SearchInput) => {
  if (!args.zip || typeof args.zip !== 'string') throw new Error('zip is required')
  const zip = args.zip.trim()
  if (!ZIP_RE.test(zip)) throw new Error('zip must be a 5-digit US zip code')
  const data = await usdaFetch<{ results: Array<{ id: string; marketname: string }> }>(`/zipSearch?zip=${zip}`)
  return {
    zip,
    count: data.results.length,
    markets: data.results.slice(0, 20).map(m => {
      const parts = m.marketname.split(' ')
      const distance = parts[0]
      const name = parts.slice(1).join(' ')
      return { id: m.id, name, distance }
    }),
  }
}, { method: 'search_markets' })

const getMarket = sg.wrap(async (args: GetMarketInput) => {
  if (!args.id || typeof args.id !== 'string') throw new Error('id is required')
  const id = args.id.trim()
  if (!/^\d+$/.test(id)) throw new Error('id must be a numeric market ID')
  const data = await usdaFetch<{ marketdetails: { Address: string; GoogleLink: string; Products: string; Schedule: string } }>(`/mktDetail?id=${id}`)
  const d = data.marketdetails
  return {
    id,
    address: d.Address || null,
    googleMapsLink: d.GoogleLink || null,
    products: d.Products ? d.Products.split(';').map((p: string) => p.trim()).filter(Boolean) : [],
    schedule: d.Schedule || null,
  }
}, { method: 'get_market' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchMarkets, getMarket }

console.log('settlegrid-usda-markets MCP server ready')
console.log('Methods: search_markets, get_market')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
