/**
 * settlegrid-drought-data — Drought Monitoring Data MCP Server
 * Wraps US Drought Monitor API with SettleGrid billing.
 * Methods:
 *   get_current(state?)           — Get current drought (1¢)
 *   get_history(state, weeks?)    — Get drought history (2¢)
 *   get_stats(date?)              — Get drought stats (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CurrentInput {
  state?: string
}

interface HistoryInput {
  state: string
  weeks?: number
}

interface StatsInput {
  date?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://usdm.unl.edu/api/v1'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-drought-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`USDM API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'drought-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_current: { costCents: 1, displayName: 'Get current drought' },
      get_history: { costCents: 2, displayName: 'Get drought history' },
      get_stats: { costCents: 1, displayName: 'Get drought statistics' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCurrent = sg.wrap(async (args: CurrentInput) => {
  const params: Record<string, string> = { type: 'state' }
  if (args.state) params.area = args.state.toUpperCase()
  return apiFetch<unknown>('currentConditions', params)
}, { method: 'get_current' })

const getHistory = sg.wrap(async (args: HistoryInput) => {
  if (!args.state || typeof args.state !== 'string') {
    throw new Error('state is required')
  }
  const weeks = args.weeks || 12
  const endDate = todayStr()
  const startDate = new Date(Date.now() - weeks * 7 * 86400000).toISOString().slice(0, 10)
  return apiFetch<unknown>('timeseries', {
    area: args.state.toUpperCase(),
    startDate,
    endDate,
    type: 'state',
  })
}, { method: 'get_history' })

const getStats = sg.wrap(async (args: StatsInput) => {
  const params: Record<string, string> = { type: 'national' }
  if (args.date) params.date = args.date
  return apiFetch<unknown>('currentConditions', params)
}, { method: 'get_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCurrent, getHistory, getStats }

console.log('settlegrid-drought-data MCP server ready')
console.log('Methods: get_current, get_history, get_stats')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
