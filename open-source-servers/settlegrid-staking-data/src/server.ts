/**
 * settlegrid-staking-data — Staking Yields & Validator MCP Server
 *
 * Wraps the free DefiLlama yields API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_yields              — Top staking yields across chains   (1¢)
 *   get_validators(chain)   — Staking info for a specific chain  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ValidatorsInput {
  chain: string
}

interface YieldPool {
  pool: string
  chain: string
  project: string
  symbol: string
  tvlUsd: number
  apy: number
  apyBase: number
  apyReward: number
  stablecoin: boolean
  exposure: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const YIELDS_BASE = 'https://yields.llama.fi'

async function yieldsFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${YIELDS_BASE}${path}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`DefiLlama Yields API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'staking-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_yields: { costCents: 1, displayName: 'Staking Yields' },
      get_validators: { costCents: 2, displayName: 'Chain Validators' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getYields = sg.wrap(async () => {
  const data = await yieldsFetch<{ data: YieldPool[] }>('/pools')

  // Filter for staking-related pools and sort by TVL
  const stakingPools = (data.data || [])
    .filter((p) =>
      p.project?.toLowerCase().includes('lido') ||
      p.project?.toLowerCase().includes('staking') ||
      p.project?.toLowerCase().includes('rocket') ||
      p.project?.toLowerCase().includes('marinade') ||
      p.project?.toLowerCase().includes('jito') ||
      p.symbol?.toLowerCase().includes('steth') ||
      p.symbol?.toLowerCase().includes('stsol') ||
      p.exposure === 'single'
    )
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
    count: stakingPools.length,
    pools: stakingPools,
    timestamp: new Date().toISOString(),
  }
}, { method: 'get_yields' })

const getValidators = sg.wrap(async (args: ValidatorsInput) => {
  if (!args.chain || typeof args.chain !== 'string') {
    throw new Error('chain is required (e.g. "ethereum", "solana", "cosmos")')
  }
  const chain = args.chain.toLowerCase().trim()

  const data = await yieldsFetch<{ data: YieldPool[] }>('/pools')

  const chainPools = (data.data || [])
    .filter((p) => p.chain.toLowerCase() === chain)
    .sort((a, b) => (b.tvlUsd || 0) - (a.tvlUsd || 0))
    .slice(0, 25)
    .map((p) => ({
      pool: p.pool,
      project: p.project,
      symbol: p.symbol,
      tvlUsd: Math.round(p.tvlUsd || 0),
      apy: Math.round((p.apy || 0) * 100) / 100,
      apyBase: Math.round((p.apyBase || 0) * 100) / 100,
      stablecoin: p.stablecoin || false,
    }))

  if (chainPools.length === 0) {
    throw new Error(`No staking data found for chain "${chain}"`)
  }

  return {
    chain,
    count: chainPools.length,
    pools: chainPools,
    timestamp: new Date().toISOString(),
  }
}, { method: 'get_validators' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getYields, getValidators }

console.log('settlegrid-staking-data MCP server ready')
console.log('Methods: get_yields, get_validators')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
