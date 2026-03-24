/**
 * settlegrid-glassdoor — Trustpilot Reviews MCP Server
 *
 * Wraps the Trustpilot API for business reviews with SettleGrid billing.
 * Glassdoor has no public API; Trustpilot is used as the review source.
 * Requires a Trustpilot API key.
 *
 * Methods:
 *   search_businesses(query)    — Search businesses       (2¢)
 *   get_reviews(domain)         — Get business reviews    (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }
interface ReviewsInput { domain: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.trustpilot.com/v1'
const API_KEY = process.env.TRUSTPILOT_API_KEY || ''
const DOMAIN_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/

async function tpFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('TRUSTPILOT_API_KEY environment variable is required')
  const separator = path.includes('?') ? '&' : '?'
  const res = await fetch(`${API_BASE}${path}${separator}apikey=${API_KEY}`)
  if (!res.ok) {
    if (res.status === 401) throw new Error('Invalid Trustpilot API key')
    if (res.status === 404) throw new Error('Business not found')
    const body = await res.text().catch(() => '')
    throw new Error(`Trustpilot API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'glassdoor',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_businesses: { costCents: 2, displayName: 'Search Businesses' },
      get_reviews: { costCents: 2, displayName: 'Get Reviews' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchBusinesses = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  if (query.length === 0 || query.length > 100) throw new Error('query must be 1-100 characters')
  const data = await tpFetch<{ businessUnits: Array<{ displayName: string; trustScore: number; numberOfReviews: { total: number }; websiteUrl: string; identifyingName: string }> }>(`/business-units/search?query=${encodeURIComponent(query)}`)
  return {
    query,
    count: data.businessUnits?.length || 0,
    businesses: (data.businessUnits || []).slice(0, 15).map(b => ({
      name: b.displayName, trustScore: b.trustScore, totalReviews: b.numberOfReviews?.total || 0,
      website: b.websiteUrl || null, slug: b.identifyingName,
    })),
  }
}, { method: 'search_businesses' })

const getReviews = sg.wrap(async (args: ReviewsInput) => {
  if (!args.domain || typeof args.domain !== 'string') throw new Error('domain is required')
  const domain = args.domain.trim().toLowerCase()
  if (!DOMAIN_RE.test(domain)) throw new Error('Invalid domain format')
  // First find the business unit
  const searchData = await tpFetch<{ businessUnits: Array<{ id: string; displayName: string; trustScore: number; numberOfReviews: { total: number } }> }>(`/business-units/search?query=${encodeURIComponent(domain)}`)
  if (!searchData.businessUnits?.length) throw new Error('Business not found for this domain')
  const bu = searchData.businessUnits[0]
  // Then get reviews
  const reviews = await tpFetch<{ reviews: Array<{ title: string; text: string; stars: number; createdAt: string; consumer: { displayName: string } }> }>(`/business-units/${bu.id}/reviews?perPage=10`)
  return {
    domain, name: bu.displayName, trustScore: bu.trustScore, totalReviews: bu.numberOfReviews?.total || 0,
    reviews: (reviews.reviews || []).map(r => ({
      title: r.title, text: r.text?.slice(0, 300), stars: r.stars,
      date: r.createdAt, author: r.consumer?.displayName || 'Anonymous',
    })),
  }
}, { method: 'get_reviews' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchBusinesses, getReviews }

console.log('settlegrid-glassdoor MCP server ready')
console.log('Methods: search_businesses, get_reviews')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
