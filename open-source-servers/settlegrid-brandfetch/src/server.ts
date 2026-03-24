/**
 * settlegrid-brandfetch — Brandfetch Brand Data MCP Server
 *
 * Wraps the Brandfetch API for brand assets with SettleGrid billing.
 * Requires a Brandfetch API key.
 *
 * Methods:
 *   get_brand(domain)     — Brand data by domain   (2¢)
 *   search_brands(query)  — Search brands by name  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DomainInput { domain: string }
interface SearchInput { query: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.brandfetch.io/v2'
const API_KEY = process.env.BRANDFETCH_API_KEY || ''
const DOMAIN_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/

async function brandfetchFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('BRANDFETCH_API_KEY environment variable is required')
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${API_KEY}` } })
  if (!res.ok) {
    if (res.status === 404) throw new Error('Brand not found')
    if (res.status === 401) throw new Error('Invalid Brandfetch API key')
    const body = await res.text().catch(() => '')
    throw new Error(`Brandfetch API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'brandfetch',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_brand: { costCents: 2, displayName: 'Get Brand' },
      search_brands: { costCents: 2, displayName: 'Search Brands' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getBrand = sg.wrap(async (args: DomainInput) => {
  if (!args.domain || typeof args.domain !== 'string') throw new Error('domain is required')
  const domain = args.domain.trim().toLowerCase()
  if (!DOMAIN_RE.test(domain)) throw new Error('Invalid domain format')
  const data = await brandfetchFetch<Record<string, unknown>>(`/brands/${domain}`)
  const logos = (data.logos as Array<Record<string, unknown>> || []).map(l => ({
    type: l.type, theme: l.theme,
    formats: ((l.formats as Array<Record<string, unknown>>) || []).map(f => ({ src: f.src, format: f.format })),
  }))
  const colors = (data.colors as Array<Record<string, unknown>> || []).map(c => ({ hex: c.hex, type: c.type, brightness: c.brightness }))
  const fonts = (data.fonts as Array<Record<string, unknown>> || []).map(f => ({ name: f.name, type: f.type, origin: f.origin }))
  return { domain, name: data.name, description: data.description || null, logos: logos.slice(0, 10), colors: colors.slice(0, 10), fonts: fonts.slice(0, 5) }
}, { method: 'get_brand' })

const searchBrands = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  if (query.length === 0 || query.length > 100) throw new Error('query must be 1-100 characters')
  const data = await brandfetchFetch<Array<Record<string, unknown>>>(`/search/${encodeURIComponent(query)}`)
  return { query, count: data.length, brands: data.slice(0, 15).map(b => ({ name: b.name, domain: b.domain, icon: b.icon || null, claimed: b.claimed || false })) }
}, { method: 'search_brands' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getBrand, searchBrands }

console.log('settlegrid-brandfetch MCP server ready')
console.log('Methods: get_brand, search_brands')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
