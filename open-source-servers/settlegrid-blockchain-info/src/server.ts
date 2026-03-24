/**
 * settlegrid-blockchain-info — Blockchain.info MCP Server
 *
 * Bitcoin blockchain data — blocks, transactions, and addresses.
 *
 * Methods:
 *   get_address(address)          — Get Bitcoin address balance and transactions  (1¢)
 *   get_block(hash)               — Get Bitcoin block details by hash  (1¢)
 *   get_ticker()                  — Get current BTC exchange rates  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetAddressInput {
  address: string
}

interface GetBlockInput {
  hash: string
}

interface GetTickerInput {

}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://blockchain.info'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-blockchain-info/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Blockchain.info API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'blockchain-info',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_address: { costCents: 1, displayName: 'Address Info' },
      get_block: { costCents: 1, displayName: 'Block Info' },
      get_ticker: { costCents: 1, displayName: 'BTC Ticker' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getAddress = sg.wrap(async (args: GetAddressInput) => {
  if (!args.address || typeof args.address !== 'string') throw new Error('address is required')
  const address = args.address.trim()
  const data = await apiFetch<any>(`/rawaddr/${encodeURIComponent(address)}?limit=10`)
  return {
    address: data.address,
    final_balance: data.final_balance,
    n_tx: data.n_tx,
    total_received: data.total_received,
    total_sent: data.total_sent,
    txs: data.txs,
  }
}, { method: 'get_address' })

const getBlock = sg.wrap(async (args: GetBlockInput) => {
  if (!args.hash || typeof args.hash !== 'string') throw new Error('hash is required')
  const hash = args.hash.trim()
  const data = await apiFetch<any>(`/rawblock/${encodeURIComponent(hash)}`)
  return {
    hash: data.hash,
    height: data.height,
    time: data.time,
    n_tx: data.n_tx,
    size: data.size,
    prev_block: data.prev_block,
  }
}, { method: 'get_block' })

const getTicker = sg.wrap(async (args: GetTickerInput) => {

  const data = await apiFetch<any>(`/ticker`)
  return {
    USD: data.USD,
    EUR: data.EUR,
    GBP: data.GBP,
    JPY: data.JPY,
  }
}, { method: 'get_ticker' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getAddress, getBlock, getTicker }

console.log('settlegrid-blockchain-info MCP server ready')
console.log('Methods: get_address, get_block, get_ticker')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
