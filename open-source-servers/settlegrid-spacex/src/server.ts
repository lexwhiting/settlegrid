/**
 * settlegrid-spacex — SpaceX Launch Data MCP Server
 *
 * Wraps the SpaceX REST API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_latest_launch()              — Latest launch info    (1¢)
 *   get_upcoming_launches(limit)     — Upcoming launches     (1¢)
 *   get_rockets()                    — List all rockets      (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LaunchLimitInput {
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const SPACEX_BASE = 'https://api.spacexdata.com/v4'

async function spacexFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${SPACEX_BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`SpaceX API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function formatLaunch(l: any): Record<string, unknown> {
  return {
    id: l.id,
    name: l.name,
    dateUtc: l.date_utc,
    success: l.success,
    details: l.details?.slice(0, 500) || null,
    rocket: l.rocket,
    flightNumber: l.flight_number,
    upcoming: l.upcoming,
    links: {
      webcast: l.links?.webcast,
      wikipedia: l.links?.wikipedia,
      article: l.links?.article,
    },
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'spacex',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_latest_launch: { costCents: 1, displayName: 'Latest Launch' },
      get_upcoming_launches: { costCents: 1, displayName: 'Upcoming Launches' },
      get_rockets: { costCents: 1, displayName: 'Get Rockets' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getLatestLaunch = sg.wrap(async () => {
  const data = await spacexFetch<any>('/launches/latest')
  return formatLaunch(data)
}, { method: 'get_latest_launch' })

const getUpcomingLaunches = sg.wrap(async (args: LaunchLimitInput) => {
  const data = await spacexFetch<any[]>('/launches/upcoming')
  const limit = Math.min(Math.max(args.limit ?? 5, 1), 10)
  return {
    count: Math.min(data.length, limit),
    launches: data.slice(0, limit).map(formatLaunch),
  }
}, { method: 'get_upcoming_launches' })

const getRockets = sg.wrap(async () => {
  const data = await spacexFetch<any[]>('/rockets')
  return {
    count: data.length,
    rockets: data.map((r: any) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      active: r.active,
      stages: r.stages,
      costPerLaunch: r.cost_per_launch,
      successRate: r.success_rate_pct,
      firstFlight: r.first_flight,
      description: r.description?.slice(0, 300),
    })),
  }
}, { method: 'get_rockets' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getLatestLaunch, getUpcomingLaunches, getRockets }

console.log('settlegrid-spacex MCP server ready')
console.log('Methods: get_latest_launch, get_upcoming_launches, get_rockets')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
