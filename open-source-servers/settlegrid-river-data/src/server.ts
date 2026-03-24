/**
 * settlegrid-river-data — River Flow & Level Data MCP Server
 * Wraps USGS Water Services with SettleGrid billing.
 * Methods:
 *   get_flow(site, period?)    — Get streamflow (1¢)
 *   search_sites(state, type?) — Search sites (1¢)
 *   get_stats(site)            — Get statistics (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface FlowInput {
  site: string
  period?: string
}

interface SearchInput {
  state: string
  type?: string
}

interface StatsInput {
  site: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://waterservices.usgs.gov/nwis'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`)
  url.searchParams.set('format', 'json')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-river-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`USGS API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'river-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_flow: { costCents: 1, displayName: 'Get streamflow data' },
      search_sites: { costCents: 1, displayName: 'Search monitoring sites' },
      get_stats: { costCents: 2, displayName: 'Get site statistics' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getFlow = sg.wrap(async (args: FlowInput) => {
  if (!args.site || typeof args.site !== 'string') {
    throw new Error('site is required (USGS site number)')
  }
  return apiFetch<unknown>('iv/', {
    sites: args.site,
    parameterCd: '00060,00065',
    period: args.period || 'P1D',
  })
}, { method: 'get_flow' })

const searchSites = sg.wrap(async (args: SearchInput) => {
  if (!args.state || typeof args.state !== 'string') {
    throw new Error('state is required (two-letter code)')
  }
  return apiFetch<unknown>('site/', {
    stateCd: args.state.toUpperCase(),
    siteType: args.type || 'ST',
    siteStatus: 'active',
    hasDataTypeCd: 'iv',
  })
}, { method: 'search_sites' })

const getStats = sg.wrap(async (args: StatsInput) => {
  if (!args.site || typeof args.site !== 'string') {
    throw new Error('site is required')
  }
  return apiFetch<unknown>('stat/', {
    sites: args.site,
    statReportType: 'daily',
    statTypeCd: 'mean,min,max',
    parameterCd: '00060',
  })
}, { method: 'get_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getFlow, searchSites, getStats }

console.log('settlegrid-river-data MCP server ready')
console.log('Methods: get_flow, search_sites, get_stats')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
