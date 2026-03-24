/**
 * settlegrid-bridge-data — Cross-Chain Bridge Volume MCP Server
 *
 * Wraps the free DefiLlama bridges API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_bridges             — List all bridges with volumes     (1¢)
 *   get_volume(bridge)      — Volume data for a specific bridge (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface VolumeInput {
  bridge: number
}

interface BridgeEntry {
  id: number
  name: string
  displayName: string
  lastHourlyVolume: number
  currentDayVolume: number
  lastDailyVolume: number
  weeklyVolume: number
  monthlyVolume: number
  chains: string[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BRIDGES_BASE = 'https://bridges.llama.fi'

async function bridgeFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BRIDGES_BASE}${path}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`DefiLlama Bridges API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'bridge-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_bridges: { costCents: 1, displayName: 'List Bridges' },
      get_volume: { costCents: 2, displayName: 'Bridge Volume' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getBridges = sg.wrap(async () => {
  const data = await bridgeFetch<{ bridges: BridgeEntry[] }>('/bridges?includeChains=true')

  const bridges = (data.bridges || [])
    .sort((a, b) => (b.currentDayVolume || 0) - (a.currentDayVolume || 0))
    .slice(0, 30)
    .map((b) => ({
      id: b.id,
      name: b.displayName || b.name,
      dailyVolume: Math.round(b.currentDayVolume || 0),
      weeklyVolume: Math.round(b.weeklyVolume || 0),
      monthlyVolume: Math.round(b.monthlyVolume || 0),
      chains: (b.chains || []).slice(0, 10),
    }))

  return {
    count: bridges.length,
    bridges,
    timestamp: new Date().toISOString(),
  }
}, { method: 'get_bridges' })

const getVolume = sg.wrap(async (args: VolumeInput) => {
  if (typeof args.bridge !== 'number' || args.bridge < 0) {
    throw new Error('bridge must be a positive number (bridge ID from get_bridges)')
  }

  const data = await bridgeFetch<{
    id: number
    name: string
    displayName: string
    lastHourlyVolume: number
    currentDayVolume: number
    lastDailyVolume: number
    weeklyVolume: number
    monthlyVolume: number
    chains: string[]
    destinationChain: string
  }>(`/bridge/${args.bridge}`)

  return {
    id: data.id,
    name: data.displayName || data.name,
    hourlyVolume: Math.round(data.lastHourlyVolume || 0),
    dailyVolume: Math.round(data.currentDayVolume || 0),
    previousDayVolume: Math.round(data.lastDailyVolume || 0),
    weeklyVolume: Math.round(data.weeklyVolume || 0),
    monthlyVolume: Math.round(data.monthlyVolume || 0),
    chains: data.chains || [],
    timestamp: new Date().toISOString(),
  }
}, { method: 'get_volume' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getBridges, getVolume }

console.log('settlegrid-bridge-data MCP server ready')
console.log('Methods: get_bridges, get_volume')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
