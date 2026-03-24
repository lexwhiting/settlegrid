/**
 * settlegrid-wakatime — WakaTime MCP Server
 *
 * Wraps the WakaTime API with SettleGrid billing.
 * Requires WAKATIME_API_KEY environment variable.
 *
 * Methods:
 *   get_stats()                              (1¢)
 *   get_leaders()                            (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetStatsInput {
}

interface GetLeadersInput {
  page?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://wakatime.com/api/v1'
const USER_AGENT = 'settlegrid-wakatime/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.WAKATIME_API_KEY
  if (!key) throw new Error('WAKATIME_API_KEY environment variable is required')
  return key
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
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'Authorization': `Basic ${getApiKey()}`,
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
    throw new Error(`WakaTime API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'wakatime',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_stats: { costCents: 1, displayName: 'Get coding activity stats' },
      get_leaders: { costCents: 1, displayName: 'Get public leaderboard' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getStats = sg.wrap(async (args: GetStatsInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/users/current/stats/last_7_days', {
    params,
  })

  return data
}, { method: 'get_stats' })

const getLeaders = sg.wrap(async (args: GetLeadersInput) => {

  const params: Record<string, string> = {}
  if (args.page !== undefined) params['page'] = String(args.page)

  const data = await apiFetch<Record<string, unknown>>('/leaders', {
    params,
  })

  return data
}, { method: 'get_leaders' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getStats, getLeaders }

console.log('settlegrid-wakatime MCP server ready')
console.log('Methods: get_stats, get_leaders')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
