/**
 * settlegrid-clinicaltrials — Clinical Trials Data MCP Server
 * Wraps ClinicalTrials.gov v2 API with SettleGrid billing.
 * Methods:
 *   search_trials(query, status?, limit?) — Search trials (1¢)
 *   get_trial(nctId)                      — Get trial details (1¢)
 *   get_stats(condition)                  — Get condition stats (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  status?: string
  limit?: number
}

interface TrialInput {
  nctId: string
}

interface StatsInput {
  condition: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://clinicaltrials.gov/api/v2'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-clinicaltrials/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ClinicalTrials API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'clinicaltrials',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_trials: { costCents: 1, displayName: 'Search clinical trials' },
      get_trial: { costCents: 1, displayName: 'Get trial details' },
      get_stats: { costCents: 2, displayName: 'Get condition statistics' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchTrials = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(args.limit || 10, 50)
  const params: Record<string, string> = {
    'query.term': args.query,
    pageSize: String(limit),
  }
  if (args.status) params['filter.overallStatus'] = args.status.toUpperCase()
  return apiFetch<unknown>('studies', params)
}, { method: 'search_trials' })

const getTrial = sg.wrap(async (args: TrialInput) => {
  if (!args.nctId || typeof args.nctId !== 'string') {
    throw new Error('nctId is required (e.g. NCT04280705)')
  }
  return apiFetch<unknown>(`studies/${encodeURIComponent(args.nctId)}`)
}, { method: 'get_trial' })

const getStats = sg.wrap(async (args: StatsInput) => {
  if (!args.condition || typeof args.condition !== 'string') {
    throw new Error('condition is required')
  }
  return apiFetch<unknown>('studies', {
    'query.cond': args.condition,
    countTotal: 'true',
    pageSize: '1',
  })
}, { method: 'get_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchTrials, getTrial, getStats }

console.log('settlegrid-clinicaltrials MCP server ready')
console.log('Methods: search_trials, get_trial, get_stats')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
