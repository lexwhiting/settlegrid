/**
 * settlegrid-rentcast — Rentcast MCP Server
 *
 * Rental estimates, property records, and market data via Rentcast.
 *
 * Methods:
 *   get_rent_estimate(address)    — Get rental estimate for a property by address  (2¢)
 *   get_market_stats(zipCode)     — Get rental market statistics by zip code  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetRentEstimateInput {
  address: string
}

interface GetMarketStatsInput {
  zipCode: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.rentcast.io/v1'
const API_KEY = process.env.RENTCAST_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-rentcast/1.0', 'X-Api-Key': API_KEY },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Rentcast API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'rentcast',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_rent_estimate: { costCents: 2, displayName: 'Rent Estimate' },
      get_market_stats: { costCents: 2, displayName: 'Market Stats' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRentEstimate = sg.wrap(async (args: GetRentEstimateInput) => {
  if (!args.address || typeof args.address !== 'string') throw new Error('address is required')
  const address = args.address.trim()
  const data = await apiFetch<any>(`/avm/rent/long-term?address=${encodeURIComponent(address)}`)
  return {
    rent: data.rent,
    rentRangeLow: data.rentRangeLow,
    rentRangeHigh: data.rentRangeHigh,
    latitude: data.latitude,
    longitude: data.longitude,
  }
}, { method: 'get_rent_estimate' })

const getMarketStats = sg.wrap(async (args: GetMarketStatsInput) => {
  if (!args.zipCode || typeof args.zipCode !== 'string') throw new Error('zipCode is required')
  const zipCode = args.zipCode.trim()
  const data = await apiFetch<any>(`/markets?zipCode=${encodeURIComponent(zipCode)}`)
  return {
    zipCode: data.zipCode,
    city: data.city,
    state: data.state,
    medianRent: data.medianRent,
    averageRent: data.averageRent,
    rentalListings: data.rentalListings,
  }
}, { method: 'get_market_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRentEstimate, getMarketStats }

console.log('settlegrid-rentcast MCP server ready')
console.log('Methods: get_rent_estimate, get_market_stats')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
