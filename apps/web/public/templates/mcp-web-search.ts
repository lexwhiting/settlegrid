#!/usr/bin/env npx tsx
/**
 * MCP Web Search Tool — Monetized with SettleGrid
 *
 * A complete MCP server that charges per search query.
 * Fork this template, add your search API key, and deploy.
 *
 * Setup:
 *   1. npm install @settlegrid/mcp
 *   2. Set SEARCH_API_KEY and SETTLEGRID_API_KEY in your env
 *   3. Register your tool at settlegrid.ai/dashboard/tools
 *   4. Run: npx tsx mcp-web-search.ts
 *
 * Pricing: 3 cents per search query
 *   - Brave Search API costs ~$0.005/query on Pro plan
 *   - 3 cents gives you ~6x margin after API costs
 *   - Competitive with Perplexity/Tavily MCP pricing
 *
 * Revenue: You keep 95-100% (100% on Free tier, 95% on paid tiers)
 */

import { settlegrid } from '@settlegrid/mcp'

// ── SettleGrid Setup ────────────────────────────────────────────────────────
// Initialize with your tool slug and pricing. The slug must match what you
// registered at settlegrid.ai/dashboard/tools.

const sg = settlegrid.init({
  toolSlug: 'my-web-search', // Replace with your tool slug
  pricing: {
    defaultCostCents: 3,
    methods: {
      search: { costCents: 3, displayName: 'Web Search' },
      news: { costCents: 5, displayName: 'News Search' },
    },
  },
})

// ── Search Implementation ───────────────────────────────────────────────────

interface SearchArgs {
  query: string
  numResults?: number
}

interface SearchResult {
  title: string
  url: string
  description: string
}

async function searchWeb(args: SearchArgs): Promise<{ results: SearchResult[] }> {
  if (!args.query || args.query.trim().length === 0) {
    throw new Error('Query must be a non-empty string')
  }

  const numResults = Math.min(args.numResults ?? 5, 20)
  const url = new URL('https://api.search.brave.com/res/v1/web/search')
  url.searchParams.set('q', args.query)
  url.searchParams.set('count', String(numResults))

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': process.env.SEARCH_API_KEY!,
    },
  })

  if (!response.ok) {
    throw new Error(`Search API returned ${response.status}: ${response.statusText}`)
  }

  const data = await response.json()
  const results: SearchResult[] = (data.web?.results ?? [])
    .slice(0, numResults)
    .map((r: { title: string; url: string; description: string }) => ({
      title: r.title,
      url: r.url,
      description: r.description,
    }))

  return { results }
}

async function searchNews(args: SearchArgs): Promise<{ results: SearchResult[] }> {
  if (!args.query || args.query.trim().length === 0) {
    throw new Error('Query must be a non-empty string')
  }

  const numResults = Math.min(args.numResults ?? 5, 20)
  const url = new URL('https://api.search.brave.com/res/v1/news/search')
  url.searchParams.set('q', args.query)
  url.searchParams.set('count', String(numResults))

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': process.env.SEARCH_API_KEY!,
    },
  })

  if (!response.ok) {
    throw new Error(`News API returned ${response.status}: ${response.statusText}`)
  }

  const data = await response.json()
  const results: SearchResult[] = (data.results ?? [])
    .slice(0, numResults)
    .map((r: { title: string; url: string; description: string }) => ({
      title: r.title,
      url: r.url,
      description: r.description,
    }))

  return { results }
}

// ── Wrap with SettleGrid Billing ─────────────────────────────────────────────
// Every call is metered and billed automatically. The consumer's API key is
// extracted from headers (x-api-key) or MCP metadata (settlegrid-api-key).

export const billedSearch = sg.wrap(searchWeb, { method: 'search' })
export const billedNews = sg.wrap(searchNews, { method: 'news' })

// ── REST Alternative ────────────────────────────────────────────────────────
// If you prefer an HTTP endpoint instead of MCP, use settlegridMiddleware:
//
// import { settlegridMiddleware } from '@settlegrid/mcp/rest'
//
// const withBilling = settlegridMiddleware({
//   toolSlug: 'my-web-search',
//   pricing: { defaultCostCents: 3 },
// })
//
// export async function POST(request: Request) {
//   return withBilling(request, async () => {
//     const { query } = await request.json()
//     const result = await searchWeb({ query })
//     return Response.json(result)
//   }, 'search')
// }
