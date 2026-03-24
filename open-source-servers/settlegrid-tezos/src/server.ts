/**
 * settlegrid-tezos — TzKT Tezos MCP Server
 *
 * Tezos blockchain data from TzKT — accounts, operations, and baking.
 *
 * Methods:
 *   get_account(address)          — Get Tezos account details  (1¢)
 *   get_head()                    — Get the latest Tezos block  (1¢)
 *   get_operations()              — Get recent Tezos operations  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetAccountInput {
  address: string
}

interface GetHeadInput {

}

interface GetOperationsInput {

}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.tzkt.io/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-tezos/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`TzKT Tezos API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'tezos',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_account: { costCents: 1, displayName: 'Account Info' },
      get_head: { costCents: 1, displayName: 'Latest Block' },
      get_operations: { costCents: 1, displayName: 'Recent Operations' },
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
    type: data.type,
    balance: data.balance,
    numTransactions: data.numTransactions,
    firstActivity: data.firstActivity,
    lastActivity: data.lastActivity,
  }
}, { method: 'get_account' })

const getHead = sg.wrap(async (args: GetHeadInput) => {

  const data = await apiFetch<any>(`/head`)
  return {
    level: data.level,
    hash: data.hash,
    timestamp: data.timestamp,
    baker: data.baker,
    priority: data.priority,
    deposit: data.deposit,
    reward: data.reward,
  }
}, { method: 'get_head' })

const getOperations = sg.wrap(async (args: GetOperationsInput) => {

  const data = await apiFetch<any>(`/operations/transactions?limit=10&sort.desc=id`)
  return {
    hash: data.hash,
    type: data.type,
    sender: data.sender,
    target: data.target,
    amount: data.amount,
    timestamp: data.timestamp,
    status: data.status,
  }
}, { method: 'get_operations' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getAccount, getHead, getOperations }

console.log('settlegrid-tezos MCP server ready')
console.log('Methods: get_account, get_head, get_operations')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
