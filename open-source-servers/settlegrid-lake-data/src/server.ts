/**
 * settlegrid-lake-data — Lake & Reservoir Data MCP Server
 * Wraps USGS Water Services with SettleGrid billing.
 * Methods:
 *   get_level(site)           — Get water level (1¢)
 *   search_reservoirs(state)  — Search reservoirs (1¢)
 *   get_stats(site)           — Get level statistics (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SiteInput {
  site: string
}

interface SearchInput {
  state: string
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
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-lake-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`USGS API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'lake-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_level: { costCents: 1, displayName: 'Get water level' },
      search_reservoirs: { costCents: 1, displayName: 'Search reservoirs' },
      get_stats: { costCents: 2, displayName: 'Get level statistics' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getLevel = sg.wrap(async (args: SiteInput) => {
  if (!args.site || typeof args.site !== 'string') {
    throw new Error('site is required (USGS site number)')
  }
  return apiFetch<unknown>('iv/', {
    sites: args.site,
    parameterCd: '00062,00065',
    period: 'P1D',
  })
}, { method: 'get_level' })

const searchReservoirs = sg.wrap(async (args: SearchInput) => {
  if (!args.state || typeof args.state !== 'string') {
    throw new Error('state is required (two-letter code)')
  }
  return apiFetch<unknown>('site/', {
    stateCd: args.state.toUpperCase(),
    siteType: 'LK',
    siteStatus: 'active',
    hasDataTypeCd: 'iv',
  })
}, { method: 'search_reservoirs' })

const getStats = sg.wrap(async (args: SiteInput) => {
  if (!args.site || typeof args.site !== 'string') {
    throw new Error('site is required')
  }
  return apiFetch<unknown>('stat/', {
    sites: args.site,
    statReportType: 'daily',
    statTypeCd: 'mean,min,max',
    parameterCd: '00062',
  })
}, { method: 'get_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getLevel, searchReservoirs, getStats }

console.log('settlegrid-lake-data MCP server ready')
console.log('Methods: get_level, search_reservoirs, get_stats')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
