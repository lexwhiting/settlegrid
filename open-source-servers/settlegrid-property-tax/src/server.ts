/**
 * settlegrid-property-tax — HUD Property Tax MCP Server
 *
 * Property tax and housing affordability data from HUD.
 *
 * Methods:
 *   get_state_data(stateid)       — Get housing cost data by state FIPS code  (1¢)
 *   get_area_data(cbsa)           — Get fair market rent by CBSA code  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetStateDataInput {
  stateid: string
}

interface GetAreaDataInput {
  cbsa: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.huduser.gov/hudapi/public'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-property-tax/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HUD Property Tax API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'property-tax',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_state_data: { costCents: 1, displayName: 'State Data' },
      get_area_data: { costCents: 1, displayName: 'Area Data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getStateData = sg.wrap(async (args: GetStateDataInput) => {
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
    })),
  }
}, { method: 'get_state_data' })

const getAreaData = sg.wrap(async (args: GetAreaDataInput) => {
  if (!args.cbsa || typeof args.cbsa !== 'string') throw new Error('cbsa is required')
  const cbsa = args.cbsa.trim()
  const data = await apiFetch<any>(`/fmr/data/${encodeURIComponent(cbsa)}`)
  return {
    area_name: data.area_name,
    year: data.year,
    Efficiency: data.Efficiency,
    One-Bedroom: data.One-Bedroom,
    Two-Bedroom: data.Two-Bedroom,
    Three-Bedroom: data.Three-Bedroom,
    Four-Bedroom: data.Four-Bedroom,
  }
}, { method: 'get_area_data' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getStateData, getAreaData }

console.log('settlegrid-property-tax MCP server ready')
console.log('Methods: get_state_data, get_area_data')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
