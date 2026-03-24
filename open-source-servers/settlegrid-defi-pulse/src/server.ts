/**
 * settlegrid-defi-pulse — DeFi Protocol TVL MCP Server
 *
 * Wraps the free DefiLlama API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_protocols            — List top DeFi protocols by TVL  (1¢)
 *   get_tvl(protocol)        — Current TVL for a protocol      (1¢)
 *   get_history(protocol)    — Historical TVL for a protocol   (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProtocolInput {
  protocol: string
}

interface LlamaProtocol {
  name: string
  slug: string
  tvl: number
  chain: string
  category: string
  change_1d: number
  change_7d: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const LLAMA_BASE = 'https://api.llama.fi'

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

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'defi-pulse',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_protocols: { costCents: 1, displayName: 'List Protocols' },
      get_tvl: { costCents: 1, displayName: 'Protocol TVL' },
      get_history: { costCents: 2, displayName: 'TVL History' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getProtocols = sg.wrap(async () => {
  const protocols = await llamaFetch<LlamaProtocol[]>('/protocols')

  return {
    count: Math.min(protocols.length, 50),
    protocols: protocols.slice(0, 50).map((p) => ({
      name: p.name,
      slug: p.slug,
      tvl: p.tvl,
      chain: p.chain,
      category: p.category,
      change_1d: p.change_1d,
      change_7d: p.change_7d,
    })),
  }
}, { method: 'get_protocols' })

const getTvl = sg.wrap(async (args: ProtocolInput) => {
  if (!args.protocol || typeof args.protocol !== 'string') {
    throw new Error('protocol is required (e.g. "aave", "uniswap")')
  }
  const slug = args.protocol.toLowerCase().trim()

  const data = await llamaFetch<{
    name: string
    tvl: Array<{ date: number; totalLiquidityUSD: number }>
    currentChainTvls: Record<string, number>
  }>(`/protocol/${encodeURIComponent(slug)}`)

  const latest = data.tvl[data.tvl.length - 1]

  return {
    protocol: data.name,
    tvl: latest?.totalLiquidityUSD ?? 0,
    chains: data.currentChainTvls,
  }
}, { method: 'get_tvl' })

const getHistory = sg.wrap(async (args: ProtocolInput) => {
  if (!args.protocol || typeof args.protocol !== 'string') {
    throw new Error('protocol is required (e.g. "aave", "uniswap")')
  }
  const slug = args.protocol.toLowerCase().trim()

  const data = await llamaFetch<{
    name: string
    tvl: Array<{ date: number; totalLiquidityUSD: number }>
  }>(`/protocol/${encodeURIComponent(slug)}`)

  const history = data.tvl.slice(-90).map((point) => ({
    date: new Date(point.date * 1000).toISOString().split('T')[0],
    tvl: point.totalLiquidityUSD,
  }))

  return {
    protocol: data.name,
    days: history.length,
    history,
  }
}, { method: 'get_history' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getProtocols, getTvl, getHistory }

console.log('settlegrid-defi-pulse MCP server ready')
console.log('Methods: get_protocols, get_tvl, get_history')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
