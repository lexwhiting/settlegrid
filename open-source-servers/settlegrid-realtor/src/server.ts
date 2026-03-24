/**
 * settlegrid-realtor — ATTOM Property Data MCP Server
 *
 * Property data, valuations, and sales via the ATTOM API.
 *
 * Methods:
 *   search_properties(address1, address2) — Search properties by address  (2¢)
 *   get_avm(address1, address2)   — Get automated valuation model for a property  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchPropertiesInput {
  address1: string
  address2: string
}

interface GetAvmInput {
  address1: string
  address2: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0'
const API_KEY = process.env.ATTOM_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-realtor/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ATTOM Property Data API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'realtor',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_properties: { costCents: 2, displayName: 'Search Properties' },
      get_avm: { costCents: 2, displayName: 'Get AVM' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchProperties = sg.wrap(async (args: SearchPropertiesInput) => {
  if (!args.address1 || typeof args.address1 !== 'string') throw new Error('address1 is required')
  const address1 = args.address1.trim()
  if (!args.address2 || typeof args.address2 !== 'string') throw new Error('address2 is required')
  const address2 = args.address2.trim()
  const data = await apiFetch<any>(`/property/address?address1=${encodeURIComponent(address1)}&address2=${encodeURIComponent(address2)}&apikey=${API_KEY}`)
  const items = (data.property ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        identifier: item.identifier,
        lot: item.lot,
        address: item.address,
        summary: item.summary,
        building: item.building,
    })),
  }
}, { method: 'search_properties' })

const getAvm = sg.wrap(async (args: GetAvmInput) => {
  if (!args.address1 || typeof args.address1 !== 'string') throw new Error('address1 is required')
  const address1 = args.address1.trim()
  if (!args.address2 || typeof args.address2 !== 'string') throw new Error('address2 is required')
  const address2 = args.address2.trim()
  const data = await apiFetch<any>(`/attomavm/detail?address1=${encodeURIComponent(address1)}&address2=${encodeURIComponent(address2)}&apikey=${API_KEY}`)
  const items = (data.property ?? []).slice(0, 5)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        identifier: item.identifier,
        address: item.address,
        avm: item.avm,
    })),
  }
}, { method: 'get_avm' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchProperties, getAvm }

console.log('settlegrid-realtor MCP server ready')
console.log('Methods: search_properties, get_avm')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
