/**
 * settlegrid-dex-data — Decentralized Exchange Data MCP Server
 *
 * Wraps the free DefiLlama DEX API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_pools(chain)    — Top liquidity pools on a chain   (2¢)
 *   get_swaps(pool)     — DEX volume for a protocol        (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PoolsInput {
  chain?: string
}

interface SwapsInput {
  pool: string
}

interface LlamaPool {
  pool: string
  chain: string
  project: string
  symbol: string
  tvlUsd: number
  apy: number
  apyBase: number
  apyReward: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const LLAMA_BASE = 'https://yields.llama.fi'
const LLAMA_DEX = 'https://api.llama.fi'

async function llamaFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`DefiLlama API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'dex-data',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_pools: { costCents: 2, displayName: 'Liquidity Pools' },
      get_swaps: { costCents: 2, displayName: 'DEX Volume' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPools = sg.wrap(async (args: PoolsInput) => {
  const chain = args.chain?.toLowerCase().trim() || null

  const data = await llamaFetch<{ data: LlamaPool[] }>(`${LLAMA_BASE}/pools`)

  let pools = data.data || []
  if (chain) {
    pools = pools.filter((p) => p.chain.toLowerCase() === chain)
  }

  const topPools = pools
    .sort((a, b) => (b.tvlUsd || 0) - (a.tvlUsd || 0))
    .slice(0, 30)
    .map((p) => ({
      pool: p.pool,
      chain: p.chain,
      project: p.project,
      symbol: p.symbol,
      tvlUsd: Math.round(p.tvlUsd || 0),
      apy: Math.round((p.apy || 0) * 100) / 100,
      apyBase: Math.round((p.apyBase || 0) * 100) / 100,
      apyReward: Math.round((p.apyReward || 0) * 100) / 100,
    }))

  return {
    chain: chain || 'all',
    count: topPools.length,
    pools: topPools,
  }
}, { method: 'get_pools' })

const getSwaps = sg.wrap(async (args: SwapsInput) => {
  if (!args.pool || typeof args.pool !== 'string') {
    throw new Error('pool is required (DEX protocol slug, e.g. "uniswap")')
  }
  const protocol = args.pool.toLowerCase().trim()

  const data = await llamaFetch<{
    totalDataChart: Array<[number, number]>
    totalDataChartBreakdown: Record<string, unknown>
    total24h: number
    total7d: number
    totalAllTime: number
    name: string
  }>(`${LLAMA_DEX}/overview/dexs/${encodeURIComponent(protocol)}?excludeTotalDataChart=false`)

  const recentVolume = (data.totalDataChart || []).slice(-30).map((entry) => ({
    date: new Date(entry[0] * 1000).toISOString().split('T')[0],
    volumeUsd: Math.round(entry[1]),
  }))

  return {
    protocol: data.name || protocol,
    volume24h: Math.round(data.total24h || 0),
    volume7d: Math.round(data.total7d || 0),
    volumeAllTime: Math.round(data.totalAllTime || 0),
    recentVolume,
  }
}, { method: 'get_swaps' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPools, getSwaps }

console.log('settlegrid-dex-data MCP server ready')
console.log('Methods: get_pools, get_swaps')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
