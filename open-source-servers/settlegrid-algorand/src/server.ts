/**
 * settlegrid-algorand — Algorand MCP Server
 *
 * Algorand blockchain data — accounts, blocks, and transactions.
 *
 * Methods:
 *   get_account(address)          — Get Algorand account details  (1¢)
 *   get_status()                  — Get Algorand node and network status  (1¢)
 *   get_block(round)              — Get Algorand block by round number  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetAccountInput {
  address: string
}

interface GetStatusInput {

}

interface GetBlockInput {
  round: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://mainnet-api.algonode.cloud/v2'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-algorand/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Algorand API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'algorand',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_account: { costCents: 1, displayName: 'Account Info' },
      get_status: { costCents: 1, displayName: 'Node Status' },
      get_block: { costCents: 1, displayName: 'Block Info' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getAccount = sg.wrap(async (args: GetAccountInput) => {
  if (!args.address || typeof args.address !== 'string') throw new Error('address is required')
  const address = args.address.trim()
  const data = await apiFetch<any>(`/accounts/${encodeURIComponent(address)}`)
  return {
    address: data.address,
    amount: data.amount,
    status: data.status,
    total-apps-opted-in: data.total-apps-opted-in,
    total-assets-opted-in: data.total-assets-opted-in,
    total-created-apps: data.total-created-apps,
  }
}, { method: 'get_account' })

const getStatus = sg.wrap(async (args: GetStatusInput) => {

  const data = await apiFetch<any>(`/status`)
  return {
    last-round: data.last-round,
    time-since-last-round: data.time-since-last-round,
    last-version: data.last-version,
    catchup-time: data.catchup-time,
  }
}, { method: 'get_status' })

const getBlock = sg.wrap(async (args: GetBlockInput) => {
  if (typeof args.round !== 'number') throw new Error('round is required and must be a number')
  const round = args.round
  const data = await apiFetch<any>(`/blocks/${round}`)
  return {
    block: data.block,
  }
}, { method: 'get_block' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getAccount, getStatus, getBlock }

console.log('settlegrid-algorand MCP server ready')
console.log('Methods: get_account, get_status, get_block')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
