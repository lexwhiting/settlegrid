/**
 * settlegrid-layer2-data — Layer 2 Scaling Data MCP Server
 *
 * Wraps the free DefiLlama chains/fees API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_l2s           — List all L2 networks with TVL      (1¢)
 *   get_tvl(l2)       — TVL data for a specific L2         (1¢)
 *   get_fees(l2)      — Fee data for a specific L2         (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface L2Input {
  l2: string
}

interface ChainEntry {
  gecko_id: string
  tvl: number
  tokenSymbol: string
  cmcId: string
  name: string
  chainId: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const LLAMA_BASE = 'https://api.llama.fi'

const L2_CHAINS = [
  'arbitrum', 'optimism', 'base', 'polygon zkevm', 'zksync era',
  'linea', 'scroll', 'starknet', 'manta', 'blast', 'mode',
  'mantle', 'metis', 'boba', 'loopring', 'zora',
]

async function llamaFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${LLAMA_BASE}${path}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`DefiLlama API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function validateL2(l2: unknown): string {
  if (!l2 || typeof l2 !== 'string') {
    throw new Error('l2 is required (e.g. "Arbitrum", "Optimism", "Base")')
  }
  return l2.trim()
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'layer2-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_l2s: { costCents: 1, displayName: 'List L2 Networks' },
      get_tvl: { costCents: 1, displayName: 'L2 TVL' },
      get_fees: { costCents: 2, displayName: 'L2 Fees' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getL2s = sg.wrap(async () => {
  const chains = await llamaFetch<ChainEntry[]>('/v2/chains')

  const l2s = chains
    .filter((c) => L2_CHAINS.includes(c.name.toLowerCase()))
    .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
    .map((c) => ({
      name: c.name,
      tvl: Math.round(c.tvl || 0),
      symbol: c.tokenSymbol || null,
      chainId: c.chainId || null,
    }))

  return {
    count: l2s.length,
    l2s,
    timestamp: new Date().toISOString(),
  }
}, { method: 'get_l2s' })

const getTvl = sg.wrap(async (args: L2Input) => {
  const l2 = validateL2(args.l2)

  const data = await llamaFetch<Array<{ date: number; totalLiquidityUSD: number }>>(
    `/v2/historicalChainTvl/${encodeURIComponent(l2)}`
  )

  if (!data || data.length === 0) {
    throw new Error(`No TVL data found for L2 "${l2}". Try "Arbitrum", "Optimism", or "Base".`)
  }

  const latest = data[data.length - 1]
  const weekAgo = data[Math.max(0, data.length - 8)]
  const monthAgo = data[Math.max(0, data.length - 31)]

  return {
    l2,
    currentTvl: Math.round(latest?.totalLiquidityUSD || 0),
    change7d: weekAgo ? Math.round(((latest.totalLiquidityUSD - weekAgo.totalLiquidityUSD) / weekAgo.totalLiquidityUSD) * 10000) / 100 : null,
    change30d: monthAgo ? Math.round(((latest.totalLiquidityUSD - monthAgo.totalLiquidityUSD) / monthAgo.totalLiquidityUSD) * 10000) / 100 : null,
    history: data.slice(-30).map((d) => ({
      date: new Date(d.date * 1000).toISOString().split('T')[0],
      tvl: Math.round(d.totalLiquidityUSD),
    })),
    timestamp: new Date().toISOString(),
  }
}, { method: 'get_tvl' })

const getFees = sg.wrap(async (args: L2Input) => {
  const l2 = validateL2(args.l2)

  const data = await llamaFetch<{
    totalDataChart: Array<[number, number]>
    total24h: number
    total7d: number
    total30d: number
    name: string
  }>(`/overview/fees/${encodeURIComponent(l2)}?excludeTotalDataChart=false`)

  const recentFees = (data.totalDataChart || []).slice(-30).map((entry) => ({
    date: new Date(entry[0] * 1000).toISOString().split('T')[0],
    feesUsd: Math.round(entry[1]),
  }))

  return {
    l2: data.name || l2,
    fees24h: Math.round(data.total24h || 0),
    fees7d: Math.round(data.total7d || 0),
    fees30d: Math.round(data.total30d || 0),
    recentFees,
    timestamp: new Date().toISOString(),
  }
}, { method: 'get_fees' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getL2s, getTvl, getFees }

console.log('settlegrid-layer2-data MCP server ready')
console.log('Methods: get_l2s, get_tvl, get_fees')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
