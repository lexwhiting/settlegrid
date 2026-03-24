/**
 * settlegrid-fec-elections — FEC Campaign Finance MCP Server
 *
 * US federal election campaign finance data from the FEC.
 *
 * Methods:
 *   search_candidates(name, office) — Search for federal election candidates  (2¢)
 *   get_candidate_totals(candidate_id) — Get financial totals for a candidate  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchCandidatesInput {
  name: string
  office?: string
}

interface GetCandidateTotalsInput {
  candidate_id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.open.fec.gov/v1'
const API_KEY = process.env.FEC_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-fec-elections/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`FEC Campaign Finance API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'fec-elections',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_candidates: { costCents: 2, displayName: 'Search Candidates' },
      get_candidate_totals: { costCents: 2, displayName: 'Candidate Totals' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchCandidates = sg.wrap(async (args: SearchCandidatesInput) => {
  if (!args.name || typeof args.name !== 'string') throw new Error('name is required')
  const name = args.name.trim()
  const office = typeof args.office === 'string' ? args.office.trim() : ''
  const data = await apiFetch<any>(`/candidates/search/?name=${encodeURIComponent(name)}&office=${encodeURIComponent(office)}&per_page=10&api_key=${API_KEY}`)
  const items = (data.results ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        name: item.name,
        party: item.party,
        office: item.office,
        state: item.state,
        candidate_id: item.candidate_id,
        election_years: item.election_years,
    })),
  }
}, { method: 'search_candidates' })

const getCandidateTotals = sg.wrap(async (args: GetCandidateTotalsInput) => {
  if (!args.candidate_id || typeof args.candidate_id !== 'string') throw new Error('candidate_id is required')
  const candidate_id = args.candidate_id.trim()
  const data = await apiFetch<any>(`/candidate/${encodeURIComponent(candidate_id)}/totals/?api_key=${API_KEY}`)
  const items = (data.results ?? []).slice(0, 5)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        candidate_id: item.candidate_id,
        receipts: item.receipts,
        disbursements: item.disbursements,
        cash_on_hand_end_period: item.cash_on_hand_end_period,
        cycle: item.cycle,
    })),
  }
}, { method: 'get_candidate_totals' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchCandidates, getCandidateTotals }

console.log('settlegrid-fec-elections MCP server ready')
console.log('Methods: search_candidates, get_candidate_totals')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
