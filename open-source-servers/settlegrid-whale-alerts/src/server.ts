/**
 * settlegrid-whale-alerts — Crypto Whale Transaction MCP Server
 *
 * Wraps the free Blockchain.com API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_recent(chain)                  — Recent large transactions       (2¢)
 *   get_whale_transactions(min_usd)    — Filter by min USD value         (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface RecentInput {
  chain?: string
}

interface WhaleInput {
  min_usd?: number
}

interface BlockchainTx {
  hash: string
  time: number
  block_height: number
  out: Array<{ value: number; addr?: string }>
  inputs: Array<{ prev_out?: { value: number; addr?: string } }>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BC_BASE = 'https://blockchain.info'

async function bcFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BC_BASE}${path}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Blockchain.com API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

async function getBtcPrice(): Promise<number> {
  const data = await bcFetch<{ USD: { last: number } }>('/ticker')
  return data.USD?.last ?? 0
}

function satsToBtc(sats: number): number {
  return Math.round((sats / 1e8) * 1e8) / 1e8
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'whale-alerts',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_recent: { costCents: 2, displayName: 'Recent Large Transactions' },
      get_whale_transactions: { costCents: 2, displayName: 'Whale Transactions' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRecent = sg.wrap(async (args: RecentInput) => {
  const chain = (args.chain || 'bitcoin').toLowerCase().trim()
  if (chain !== 'bitcoin') {
    throw new Error('Currently only "bitcoin" chain is supported')
  }

  const btcPrice = await getBtcPrice()
  const data = await bcFetch<{ txs: BlockchainTx[] }>('/unconfirmed-transactions?format=json')

  const largeTxs = data.txs
    .map((tx) => {
      const totalOut = tx.out.reduce((sum, o) => sum + o.value, 0)
      const btcValue = satsToBtc(totalOut)
      return {
        hash: tx.hash,
        btc: btcValue,
        usd: Math.round(btcValue * btcPrice),
        outputs: tx.out.length,
        time: new Date(tx.time * 1000).toISOString(),
      }
    })
    .filter((tx) => tx.usd >= 100000)
    .sort((a, b) => b.usd - a.usd)
    .slice(0, 20)

  return {
    chain,
    btcPrice,
    count: largeTxs.length,
    transactions: largeTxs,
    timestamp: new Date().toISOString(),
  }
}, { method: 'get_recent' })

const getWhaleTransactions = sg.wrap(async (args: WhaleInput) => {
  const minUsd = args.min_usd ?? 1000000
  if (typeof minUsd !== 'number' || minUsd < 0) {
    throw new Error('min_usd must be a positive number')
  }

  const btcPrice = await getBtcPrice()
  const data = await bcFetch<{ txs: BlockchainTx[] }>('/unconfirmed-transactions?format=json')

  const whaleTxs = data.txs
    .map((tx) => {
      const totalOut = tx.out.reduce((sum, o) => sum + o.value, 0)
      const btcValue = satsToBtc(totalOut)
      const usdValue = btcValue * btcPrice
      return {
        hash: tx.hash,
        btc: btcValue,
        usd: Math.round(usdValue),
        from: tx.inputs[0]?.prev_out?.addr || 'unknown',
        to: tx.out[0]?.addr || 'unknown',
        time: new Date(tx.time * 1000).toISOString(),
      }
    })
    .filter((tx) => tx.usd >= minUsd)
    .sort((a, b) => b.usd - a.usd)
    .slice(0, 20)

  return {
    minUsd,
    btcPrice,
    count: whaleTxs.length,
    transactions: whaleTxs,
    timestamp: new Date().toISOString(),
  }
}, { method: 'get_whale_transactions' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRecent, getWhaleTransactions }

console.log('settlegrid-whale-alerts MCP server ready')
console.log('Methods: get_recent, get_whale_transactions')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
