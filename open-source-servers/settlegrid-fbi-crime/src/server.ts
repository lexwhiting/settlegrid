/**
 * settlegrid-fbi-crime — FBI Crime Data MCP Server
 *
 * Wraps the FBI Crime Data API with SettleGrid billing.
 * Requires FBI_CRIME_API_KEY environment variable.
 *
 * Methods:
 *   get_state_offenses(stateAbbr, since, until) (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetStateOffensesInput {
  stateAbbr: string
  since: number
  until: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.usa.gov/crime/fbi/sapi'
const USER_AGENT = 'settlegrid-fbi-crime/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  return process.env.FBI_CRIME_API_KEY ?? 'DEMO_KEY'
}

async function apiFetch<T>(path: string, options: {
  method?: string
  params?: Record<string, string>
  body?: unknown
  headers?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  url.searchParams.set('API_KEY', getApiKey())
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    ...options.headers,
  }
  const fetchOpts: RequestInit = { method: options.method ?? 'GET', headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
    ;(headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  const res = await fetch(url.toString(), fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`FBI Crime Data API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'fbi-crime',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_state_offenses: { costCents: 2, displayName: 'Get offense counts by state' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getStateOffenses = sg.wrap(async (args: GetStateOffensesInput) => {
  if (!args.stateAbbr || typeof args.stateAbbr !== 'string') {
    throw new Error('stateAbbr is required (state abbreviation (e.g. ca, tx))')
  }
  if (typeof args.since !== 'number' || isNaN(args.since)) {
    throw new Error('since must be a number')
  }
  if (typeof args.until !== 'number' || isNaN(args.until)) {
    throw new Error('until must be a number')
  }

  const params: Record<string, string> = {}
  params['stateAbbr'] = String(args.stateAbbr)
  params['since'] = String(args.since)
  params['until'] = String(args.until)

  const data = await apiFetch<Record<string, unknown>>(`/api/summarized/state/${encodeURIComponent(String(args.stateAbbr))}/offenses/${encodeURIComponent(String(args.since))}/${encodeURIComponent(String(args.until))}`, {
    params,
  })

  return data
}, { method: 'get_state_offenses' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getStateOffenses }

console.log('settlegrid-fbi-crime MCP server ready')
console.log('Methods: get_state_offenses')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
