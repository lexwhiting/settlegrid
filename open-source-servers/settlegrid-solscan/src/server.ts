/**
 * settlegrid-solscan — Solscan MCP Server
 *
 * Solana blockchain explorer — accounts, transactions, and tokens.
 *
 * Methods:
 *   get_account(address)          — Get Solana account details  (1¢)
 *   get_transaction(signature)    — Get Solana transaction details  (1¢)
 *   get_token_holders(token_address) — Get top holders of a Solana token  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetAccountInput {
  address: string
}

interface GetTransactionInput {
  signature: string
}

interface GetTokenHoldersInput {
  token_address: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://public-api.solscan.io'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-solscan/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Solscan API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'solscan',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_account: { costCents: 1, displayName: 'Account Info' },
      get_transaction: { costCents: 1, displayName: 'Transaction Info' },
      get_token_holders: { costCents: 1, displayName: 'Token Holders' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getAccount = sg.wrap(async (args: GetAccountInput) => {
  if (!args.address || typeof args.address !== 'string') throw new Error('address is required')
  const address = args.address.trim()
  const data = await apiFetch<any>(`/account/${encodeURIComponent(address)}`)
  return {
    lamports: data.lamports,
    ownerProgram: data.ownerProgram,
    type: data.type,
    rentEpoch: data.rentEpoch,
  }
}, { method: 'get_account' })

const getTransaction = sg.wrap(async (args: GetTransactionInput) => {
  if (!args.signature || typeof args.signature !== 'string') throw new Error('signature is required')
  const signature = args.signature.trim()
  const data = await apiFetch<any>(`/transaction/${encodeURIComponent(signature)}`)
  return {
    blockTime: data.blockTime,
    slot: data.slot,
    fee: data.fee,
    status: data.status,
    signer: data.signer,
    parsedInstruction: data.parsedInstruction,
  }
}, { method: 'get_transaction' })

const getTokenHolders = sg.wrap(async (args: GetTokenHoldersInput) => {
  if (!args.token_address || typeof args.token_address !== 'string') throw new Error('token_address is required')
  const token_address = args.token_address.trim()
  const data = await apiFetch<any>(`/token/holders?tokenAddress=${encodeURIComponent(token_address)}&limit=10&offset=0`)
  const items = (data.data ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        address: item.address,
        amount: item.amount,
        decimals: item.decimals,
        owner: item.owner,
    })),
  }
}, { method: 'get_token_holders' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getAccount, getTransaction, getTokenHolders }

console.log('settlegrid-solscan MCP server ready')
console.log('Methods: get_account, get_transaction, get_token_holders')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
