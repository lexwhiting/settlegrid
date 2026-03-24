/**
 * settlegrid-data-center — Data Center Locations MCP Server
 *
 * Wraps data center location data with SettleGrid billing.
 * No API key needed — uses public datasets.
 *
 * Methods:
 *   search_datacenters(country?, city?) — Search locations (1¢)
 *   get_datacenter(id) — Data center details (1¢)
 *   get_stats(country?) — Country stats (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { country?: string; city?: string }
interface DetailInput { id: string }
interface StatsInput { country?: string }

interface DataCenter {
  id: string
  name: string
  provider: string
  country: string
  city: string
  lat?: number
  lon?: number
  tier?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.datacentermap.com'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const DC_HUBS: Record<string, { count: number; major_cities: string[] }> = {
  US: { count: 2670, major_cities: ['Ashburn', 'Dallas', 'Chicago', 'Phoenix', 'Los Angeles', 'New York'] },
  DE: { count: 487, major_cities: ['Frankfurt', 'Munich', 'Berlin', 'Hamburg', 'Dusseldorf'] },
  GB: { count: 452, major_cities: ['London', 'Manchester', 'Birmingham', 'Edinburgh'] },
  NL: { count: 288, major_cities: ['Amsterdam', 'Rotterdam', 'The Hague'] },
  CN: { count: 449, major_cities: ['Beijing', 'Shanghai', 'Shenzhen', 'Guangzhou'] },
  JP: { count: 207, major_cities: ['Tokyo', 'Osaka', 'Nagoya'] },
  AU: { count: 289, major_cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth'] },
  SG: { count: 73, major_cities: ['Singapore'] },
  IN: { count: 138, major_cities: ['Mumbai', 'Chennai', 'Hyderabad', 'Pune'] },
  BR: { count: 147, major_cities: ['Sao Paulo', 'Rio de Janeiro', 'Campinas'] },
  CA: { count: 282, major_cities: ['Toronto', 'Montreal', 'Vancouver', 'Calgary'] },
  FR: { count: 263, major_cities: ['Paris', 'Marseille', 'Lyon'] },
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'data-center',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datacenters: { costCents: 1, displayName: 'Search Data Centers' },
      get_datacenter: { costCents: 1, displayName: 'Data Center Details' },
      get_stats: { costCents: 1, displayName: 'DC Statistics' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatacenters = sg.wrap(async (args: SearchInput) => {
  const params = new URLSearchParams()
  if (args.country) params.set('country', args.country)
  if (args.city) params.set('city', args.city)
  try {
    const data = await apiFetch<any>(`/v1/datacenters?${params}`)
    return { query: { country: args.country, city: args.city }, results: data, source: 'DataCenterMap' }
  } catch {
    const country = args.country?.toUpperCase() || ''
    const hub = DC_HUBS[country]
    return {
      query: { country: args.country, city: args.city },
      estimated_count: hub?.count || 'unknown',
      major_cities: hub?.major_cities || [],
      note: 'Live API unavailable — returning cached hub data.',
      available_countries: Object.keys(DC_HUBS),
      source: 'DataCenterMap (cached)',
    }
  }
}, { method: 'search_datacenters' })

const getDatacenter = sg.wrap(async (args: DetailInput) => {
  if (!args.id) throw new Error('id is required')
  try {
    const data = await apiFetch<any>(`/v1/datacenters/${args.id}`)
    return { datacenter: data, source: 'DataCenterMap' }
  } catch {
    return {
      id: args.id,
      note: 'Data center not found or API unavailable. Try search_datacenters to find valid IDs.',
      source: 'DataCenterMap',
    }
  }
}, { method: 'get_datacenter' })

const getStats = sg.wrap(async (args: StatsInput) => {
  if (args.country) {
    const code = args.country.toUpperCase()
    const hub = DC_HUBS[code]
    if (!hub) {
      return {
        country: code,
        error: `No data for ${code}`,
        available: Object.keys(DC_HUBS),
      }
    }
    return {
      country: code,
      estimated_datacenters: hub.count,
      major_cities: hub.major_cities,
      source: 'DataCenterMap',
    }
  }
  const total = Object.values(DC_HUBS).reduce((s, h) => s + h.count, 0)
  const ranked = Object.entries(DC_HUBS)
    .map(([code, h]) => ({ country: code, count: h.count, cities: h.major_cities }))
    .sort((a, b) => b.count - a.count)
  return {
    global_total: total,
    countries_tracked: Object.keys(DC_HUBS).length,
    rankings: ranked,
    source: 'DataCenterMap',
  }
}, { method: 'get_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatacenters, getDatacenter, getStats }

console.log('settlegrid-data-center MCP server ready')
console.log('Methods: search_datacenters, get_datacenter, get_stats')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
