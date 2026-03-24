/**
 * settlegrid-usa-spending — USAspending MCP Server
 *
 * Federal government spending data from USAspending.gov.
 *
 * Methods:
 *   search_spending(keyword)      — Search federal spending awards by keyword  (1¢)
 *   get_agency(code)              — Get spending totals for a federal agency by toptier code  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchSpendingInput {
  keyword: string
}

interface GetAgencyInput {
  code: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.usaspending.gov/api/v2'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-usa-spending/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`USAspending API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'usa-spending',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_spending: { costCents: 1, displayName: 'Search Spending' },
      get_agency: { costCents: 1, displayName: 'Get Agency' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchSpending = sg.wrap(async (args: SearchSpendingInput) => {
  if (!args.keyword || typeof args.keyword !== 'string') throw new Error('keyword is required')
  const keyword = args.keyword.trim()
  const data = await apiFetch<any>(`/search/spending_by_award/?keyword=${encodeURIComponent(keyword)}&limit=10`)
  const items = (data.results ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        Award ID: item.Award ID,
        Recipient Name: item.Recipient Name,
        Award Amount: item.Award Amount,
        Awarding Agency: item.Awarding Agency,
    })),
  }
}, { method: 'search_spending' })

const getAgency = sg.wrap(async (args: GetAgencyInput) => {
  if (!args.code || typeof args.code !== 'string') throw new Error('code is required')
  const code = args.code.trim()
  const data = await apiFetch<any>(`/agency/${encodeURIComponent(code)}/`)
  return {
    name: data.name,
    abbreviation: data.abbreviation,
    budget_authority_amount: data.budget_authority_amount,
    obligated_amount: data.obligated_amount,
  }
}, { method: 'get_agency' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchSpending, getAgency }

console.log('settlegrid-usa-spending MCP server ready')
console.log('Methods: search_spending, get_agency')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
