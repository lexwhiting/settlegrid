/**
 * settlegrid-exoplanet — Exoplanet Archive MCP Server
 * Wraps NASA Exoplanet Archive TAP service with SettleGrid billing.
 * Methods:
 *   search_planets(query?, limit?)    — Search exoplanets (1¢)
 *   get_stats()                       — Get discovery stats (1¢)
 *   get_by_method(method, limit?)     — Get by method (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query?: string
  limit?: number
}

interface MethodInput {
  method: string
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const TAP_BASE = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync'

async function tapQuery<T>(adql: string): Promise<T> {
  const url = new URL(TAP_BASE)
  url.searchParams.set('query', adql)
  url.searchParams.set('format', 'json')
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-exoplanet/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Exoplanet Archive ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'exoplanet',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_planets: { costCents: 1, displayName: 'Search exoplanets' },
      get_stats: { costCents: 1, displayName: 'Get discovery statistics' },
      get_by_method: { costCents: 2, displayName: 'Get by discovery method' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPlanets = sg.wrap(async (args: SearchInput) => {
  const limit = Math.min(args.limit || 10, 100)
  let adql = `SELECT pl_name,hostname,discoverymethod,disc_year,pl_orbper,pl_rade FROM ps`
  if (args.query) {
    const q = args.query.replace(/'/g, "''")
    adql += ` WHERE pl_name LIKE '%${q}%' OR hostname LIKE '%${q}%'`
  }
  adql += ` ORDER BY disc_year DESC`
  adql += ` TOP ${limit}`
  return tapQuery<unknown>(adql)
}, { method: 'search_planets' })

const getStats = sg.wrap(async () => {
  const adql = 'SELECT discoverymethod, COUNT(*) as count FROM ps GROUP BY discoverymethod ORDER BY count DESC'
  return tapQuery<unknown>(adql)
}, { method: 'get_stats' })

const getByMethod = sg.wrap(async (args: MethodInput) => {
  if (!args.method || typeof args.method !== 'string') {
    throw new Error('method is required (e.g. "Transit")')
  }
  const limit = Math.min(args.limit || 20, 100)
  const m = args.method.replace(/'/g, "''")
  const adql = `SELECT TOP ${limit} pl_name,hostname,disc_year,pl_orbper,pl_rade FROM ps WHERE discoverymethod='${m}' ORDER BY disc_year DESC`
  return tapQuery<unknown>(adql)
}, { method: 'get_by_method' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPlanets, getStats, getByMethod }

console.log('settlegrid-exoplanet MCP server ready')
console.log('Methods: search_planets, get_stats, get_by_method')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
