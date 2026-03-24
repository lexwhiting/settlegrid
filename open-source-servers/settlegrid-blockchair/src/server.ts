/**
 * settlegrid-blockchair — Blockchair MCP Server
 *
 * Multi-chain blockchain explorer — Bitcoin, Ethereum, and more.
 *
 * Methods:
 *   get_stats(chain)              — Get blockchain statistics for a chain  (1¢)
 *   get_block(chain, height)      — Get block details by height  (1¢)
 *   get_transaction(chain, hash)  — Get transaction details by hash  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetStatsInput {
  chain: string
}

interface GetBlockInput {
  chain: string
  height: number
}

interface GetTransactionInput {
  chain: string
  hash: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.blockchair.com'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-blockchair/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Blockchair API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'blockchair',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_stats: { costCents: 1, displayName: 'Chain Stats' },
      get_block: { costCents: 1, displayName: 'Block Info' },
      get_transaction: { costCents: 1, displayName: 'Transaction Info' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getStats = sg.wrap(async (args: GetStatsInput) => {
  if (!args.chain || typeof args.chain !== 'string') throw new Error('chain is required')
  const chain = args.chain.trim()
  const data = await apiFetch<any>(`/${encodeURIComponent(chain)}/stats`)
  const items = (data.data ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        blocks: item.blocks,
        transactions: item.transactions,
        market_price_usd: item.market_price_usd,
        hashrate_24h: item.hashrate_24h,
        difficulty: item.difficulty,
        mempool_transactions: item.mempool_transactions,
    })),
  }
}, { method: 'get_stats' })

const getBlock = sg.wrap(async (args: GetBlockInput) => {
  if (!args.chain || typeof args.chain !== 'string') throw new Error('chain is required')
  const chain = args.chain.trim()
  if (typeof args.height !== 'number') throw new Error('height is required and must be a number')
  const height = args.height
  const data = await apiFetch<any>(`/${encodeURIComponent(chain)}/dashboards/block/${height}`)
  return {
    data: data.data,
    context: data.context,
  }
}, { method: 'get_block' })

const getTransaction = sg.wrap(async (args: GetTransactionInput) => {
  if (!args.chain || typeof args.chain !== 'string') throw new Error('chain is required')
  const chain = args.chain.trim()
  if (!args.hash || typeof args.hash !== 'string') throw new Error('hash is required')
  const hash = args.hash.trim()
  const data = await apiFetch<any>(`/${encodeURIComponent(chain)}/dashboards/transaction/${encodeURIComponent(hash)}`)
  return {
    data: data.data,
    context: data.context,
  }
}, { method: 'get_transaction' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getStats, getBlock, getTransaction }

console.log('settlegrid-blockchair MCP server ready')
console.log('Methods: get_stats, get_block, get_transaction')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
