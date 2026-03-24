/**
 * settlegrid-congress-api — US Congress MCP Server
 *
 * Congressional bills, members, and votes from congress.gov.
 *
 * Methods:
 *   search_bills(query, limit)    — Search congressional bills by keyword  (2¢)
 *   get_member(bioguide_id)       — Get details about a member of Congress by bioguide ID  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchBillsInput {
  query: string
  limit?: number
}

interface GetMemberInput {
  bioguide_id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.congress.gov/v3'
const API_KEY = process.env.CONGRESS_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-congress-api/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`US Congress API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'congress-api',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_bills: { costCents: 2, displayName: 'Search Bills' },
      get_member: { costCents: 2, displayName: 'Get Member' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchBills = sg.wrap(async (args: SearchBillsInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const limit = typeof args.limit === 'number' ? args.limit : 0
  const data = await apiFetch<any>(`/bill?query=${encodeURIComponent(query)}&limit=${limit}&format=json&api_key=${API_KEY}`)
  const items = (data.bills ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        number: item.number,
        title: item.title,
        type: item.type,
        congress: item.congress,
        latestAction: item.latestAction,
    })),
  }
}, { method: 'search_bills' })

const getMember = sg.wrap(async (args: GetMemberInput) => {
  if (!args.bioguide_id || typeof args.bioguide_id !== 'string') throw new Error('bioguide_id is required')
  const bioguide_id = args.bioguide_id.trim()
  const data = await apiFetch<any>(`/member/${encodeURIComponent(bioguide_id)}?format=json&api_key=${API_KEY}`)
  return {
    bioguideId: data.bioguideId,
    name: data.name,
    state: data.state,
    party: data.party,
    terms: data.terms,
  }
}, { method: 'get_member' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchBills, getMember }

console.log('settlegrid-congress-api MCP server ready')
console.log('Methods: search_bills, get_member')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
