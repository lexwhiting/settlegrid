/**
 * settlegrid-internet-speed — Internet Speed Data MCP Server
 *
 * Wraps M-Lab speed test data with SettleGrid billing.
 * No API key needed — M-Lab data is public.
 *
 * Methods:
 *   get_stats(country?) — Speed statistics (1¢)
 *   get_rankings(limit?) — Global rankings (1¢)
 *   get_history(country?, months?) — Historical data (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface StatsInput { country?: string }
interface RankingsInput { limit?: number }
interface HistoryInput { country?: string; months?: number }

interface SpeedStats {
  country: string
  download_mbps: number
  upload_mbps: number
  latency_ms: number
  tests: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://speed.measurementlab.net'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'internet-speed',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_stats: { costCents: 1, displayName: 'Speed Statistics' },
      get_rankings: { costCents: 1, displayName: 'Speed Rankings' },
      get_history: { costCents: 2, displayName: 'Speed History' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getStats = sg.wrap(async (args: StatsInput) => {
  const country = args.country?.toUpperCase() || 'US'
  if (country.length !== 2) throw new Error('country must be a 2-letter ISO code')
  const data = await apiFetch<any>(`/api/v0/stats?country=${country}`)
  return {
    country,
    stats: data,
    source: 'M-Lab NDT speed tests',
  }
}, { method: 'get_stats' })

const getRankings = sg.wrap(async (args: RankingsInput) => {
  const limit = args.limit ?? 20
  if (limit < 1 || limit > 100) throw new Error('limit must be 1-100')
  const data = await apiFetch<any>(`/api/v0/rankings?limit=${limit}`)
  return {
    rankings: data,
    count: limit,
    source: 'M-Lab NDT speed tests',
  }
}, { method: 'get_rankings' })

const getHistory = sg.wrap(async (args: HistoryInput) => {
  const country = args.country?.toUpperCase() || 'US'
  const months = args.months ?? 12
  if (months < 1 || months > 60) throw new Error('months must be 1-60')
  if (country.length !== 2) throw new Error('country must be a 2-letter ISO code')
  const data = await apiFetch<any>(`/api/v0/history?country=${country}&months=${months}`)
  return {
    country,
    months,
    history: data,
    source: 'M-Lab NDT speed tests',
  }
}, { method: 'get_history' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getStats, getRankings, getHistory }

console.log('settlegrid-internet-speed MCP server ready')
console.log('Methods: get_stats, get_rankings, get_history')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
