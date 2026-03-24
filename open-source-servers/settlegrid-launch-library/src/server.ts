/**
 * settlegrid-launch-library — Launch Library 2 Rocket Launch MCP Server
 *
 * Wraps the Launch Library 2 API with SettleGrid billing.
 * No API key needed for free tier.
 *
 * Methods:
 *   get_upcoming_launches(limit)   — Upcoming launches  (1¢)
 *   get_previous_launches(limit)   — Recent past launches (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LaunchInput {
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const LL_BASE = 'https://ll.thespacedevs.com/2.2.0'

async function llFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${LL_BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Launch Library API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function formatLaunch(l: any): Record<string, unknown> {
  return {
    id: l.id,
    name: l.name,
    status: l.status?.name,
    net: l.net,
    provider: l.launch_service_provider?.name,
    rocket: l.rocket?.configuration?.full_name,
    pad: l.pad?.name,
    location: l.pad?.location?.name,
    mission: l.mission?.name || null,
    missionDescription: l.mission?.description?.slice(0, 300) || null,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'launch-library',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_upcoming_launches: { costCents: 1, displayName: 'Upcoming Launches' },
      get_previous_launches: { costCents: 1, displayName: 'Previous Launches' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getUpcomingLaunches = sg.wrap(async (args: LaunchInput) => {
  const limit = Math.min(Math.max(args.limit ?? 5, 1), 10)
  const data = await llFetch<{ count: number; results: any[] }>(
    `/launch/upcoming/?limit=${limit}&mode=detailed`
  )
  return {
    total: data.count,
    launches: data.results.map(formatLaunch),
  }
}, { method: 'get_upcoming_launches' })

const getPreviousLaunches = sg.wrap(async (args: LaunchInput) => {
  const limit = Math.min(Math.max(args.limit ?? 5, 1), 10)
  const data = await llFetch<{ count: number; results: any[] }>(
    `/launch/previous/?limit=${limit}&mode=detailed`
  )
  return {
    total: data.count,
    launches: data.results.map(formatLaunch),
  }
}, { method: 'get_previous_launches' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getUpcomingLaunches, getPreviousLaunches }

console.log('settlegrid-launch-library MCP server ready')
console.log('Methods: get_upcoming_launches, get_previous_launches')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
