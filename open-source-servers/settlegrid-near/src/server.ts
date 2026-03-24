/**
 * settlegrid-near — NEAR Blocks MCP Server
 *
 * NEAR Protocol blockchain explorer — accounts, blocks, and transactions.
 *
 * Methods:
 *   get_account(account_id)       — Get NEAR account details  (1¢)
 *   get_blocks()                  — Get recent NEAR blocks  (1¢)
 *   get_txns()                    — Get recent NEAR transactions  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetAccountInput {
  account_id: string
}

interface GetBlocksInput {

}

interface GetTxnsInput {

}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.nearblocks.io/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-near/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NEAR Blocks API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'near',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_account: { costCents: 1, displayName: 'Account Info' },
      get_blocks: { costCents: 1, displayName: 'Recent Blocks' },
      get_txns: { costCents: 1, displayName: 'Recent Transactions' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getAccount = sg.wrap(async (args: GetAccountInput) => {
  if (!args.account_id || typeof args.account_id !== 'string') throw new Error('account_id is required')
  const account_id = args.account_id.trim()
  const data = await apiFetch<any>(`/account/${encodeURIComponent(account_id)}`)
  return {
    account_id: data.account_id,
    amount: data.amount,
    code_hash: data.code_hash,
    storage_usage: data.storage_usage,
    block_height: data.block_height,
  }
}, { method: 'get_account' })

const getBlocks = sg.wrap(async (args: GetBlocksInput) => {

  const data = await apiFetch<any>(`/blocks?limit=10`)
  const items = (data.blocks ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        block_height: item.block_height,
        block_hash: item.block_hash,
        author_account_id: item.author_account_id,
        block_timestamp: item.block_timestamp,
        gas_price: item.gas_price,
    })),
  }
}, { method: 'get_blocks' })

const getTxns = sg.wrap(async (args: GetTxnsInput) => {

  const data = await apiFetch<any>(`/txns?limit=10`)
  const items = (data.txns ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        transaction_hash: item.transaction_hash,
        signer_account_id: item.signer_account_id,
        receiver_account_id: item.receiver_account_id,
        block_timestamp: item.block_timestamp,
    })),
  }
}, { method: 'get_txns' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getAccount, getBlocks, getTxns }

console.log('settlegrid-near MCP server ready')
console.log('Methods: get_account, get_blocks, get_txns')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
