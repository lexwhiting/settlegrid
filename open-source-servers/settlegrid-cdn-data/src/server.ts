/**
 * settlegrid-cdn-data — CDN Performance Data MCP Server
 *
 * Wraps Cloudflare Radar API with SettleGrid billing.
 * No API key needed — Radar public data is free.
 *
 * Methods:
 *   get_traffic(domain?) — Traffic data (1¢)
 *   get_stats(country?) — Country stats (1¢)
 *   get_trends(days?) — Traffic trends (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TrafficInput { domain?: string }
interface StatsInput { country?: string }
interface TrendsInput { days?: number }

interface RadarResponse {
  success: boolean
  result: any
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://radar.cloudflare.com/api'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function dateRange(days: number): { start: string; end: string } {
  const end = new Date()
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
  return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'cdn-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_traffic: { costCents: 1, displayName: 'Traffic Data' },
      get_stats: { costCents: 1, displayName: 'Country Stats' },
      get_trends: { costCents: 2, displayName: 'Traffic Trends' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getTraffic = sg.wrap(async (args: TrafficInput) => {
  const params = new URLSearchParams()
  if (args.domain) params.set('domain', args.domain)
  params.set('dateRange', '7d')
  const data = await apiFetch<RadarResponse>(`/traffic/top/locations?${params}`)
  return {
    domain: args.domain || 'global',
    traffic: data.result,
    period: '7d',
    source: 'Cloudflare Radar',
  }
}, { method: 'get_traffic' })

const getStats = sg.wrap(async (args: StatsInput) => {
  const params = new URLSearchParams()
  if (args.country) {
    if (args.country.length !== 2) throw new Error('country must be a 2-letter ISO code')
    params.set('location', args.country.toUpperCase())
  }
  params.set('dateRange', '7d')
  const data = await apiFetch<RadarResponse>(`/http/summary/http_protocol?${params}`)
  return {
    country: args.country?.toUpperCase() || 'global',
    stats: data.result,
    source: 'Cloudflare Radar',
  }
}, { method: 'get_stats' })

const getTrends = sg.wrap(async (args: TrendsInput) => {
  const days = args.days ?? 7
  if (days < 1 || days > 90) throw new Error('days must be 1-90')
  const { start, end } = dateRange(days)
  const data = await apiFetch<RadarResponse>(`/http/timeseries/http_protocol?dateStart=${start}&dateEnd=${end}`)
  return {
    period: { start, end, days },
    trends: data.result,
    source: 'Cloudflare Radar',
  }
}, { method: 'get_trends' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getTraffic, getStats, getTrends }

console.log('settlegrid-cdn-data MCP server ready')
console.log('Methods: get_traffic, get_stats, get_trends')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
