/**
 * settlegrid-hud-data — HUD Housing Data MCP Server
 *
 * Fair market rents and income limits from HUD.
 *
 * Methods:
 *   get_fair_market_rent(stateid) — Get fair market rents by state FIPS code  (1¢)
 *   get_income_limits(stateid)    — Get income limits by state FIPS code  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetFairMarketRentInput {
  stateid: string
}

interface GetIncomeLimitsInput {
  stateid: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.huduser.gov/hudapi/public'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-hud-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HUD Housing Data API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'hud-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_fair_market_rent: { costCents: 1, displayName: 'Fair Market Rent' },
      get_income_limits: { costCents: 1, displayName: 'Income Limits' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getFairMarketRent = sg.wrap(async (args: GetFairMarketRentInput) => {
  if (!args.stateid || typeof args.stateid !== 'string') throw new Error('stateid is required')
  const stateid = args.stateid.trim()
  const data = await apiFetch<any>(`/fmr/statedata/${encodeURIComponent(stateid)}`)
  const items = (data.data.metroareas ?? []).slice(0, 15)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        area_name: item.area_name,
        Efficiency: item.Efficiency,
        One-Bedroom: item.One-Bedroom,
        Two-Bedroom: item.Two-Bedroom,
        Three-Bedroom: item.Three-Bedroom,
        Four-Bedroom: item.Four-Bedroom,
    })),
  }
}, { method: 'get_fair_market_rent' })

const getIncomeLimits = sg.wrap(async (args: GetIncomeLimitsInput) => {
  if (!args.stateid || typeof args.stateid !== 'string') throw new Error('stateid is required')
  const stateid = args.stateid.trim()
  const data = await apiFetch<any>(`/il/statedata/${encodeURIComponent(stateid)}`)
  const items = (data.data ?? []).slice(0, 15)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        area_name: item.area_name,
        median_income: item.median_income,
        low_50: item.low_50,
        very_low_50: item.very_low_50,
    })),
  }
}, { method: 'get_income_limits' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getFairMarketRent, getIncomeLimits }

console.log('settlegrid-hud-data MCP server ready')
console.log('Methods: get_fair_market_rent, get_income_limits')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
