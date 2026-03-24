/**
 * settlegrid-arbiscan — Arbiscan MCP Server
 *
 * Arbitrum blockchain explorer — balances, transactions, and tokens.
 *
 * Methods:
 *   get_balance(address)          — Get ETH balance for an Arbitrum address  (2¢)
 *   get_transactions(address)     — Get transaction list for an address  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetBalanceInput {
  address: string
}

interface GetTransactionsInput {
  address: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.arbiscan.io/api'
const API_KEY = process.env.ARBISCAN_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-arbiscan/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Arbiscan API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'arbiscan',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_balance: { costCents: 2, displayName: 'ETH Balance' },
      get_transactions: { costCents: 2, displayName: 'Transactions' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getBalance = sg.wrap(async (args: GetBalanceInput) => {
  if (!args.address || typeof args.address !== 'string') throw new Error('address is required')
  const address = args.address.trim()
  const data = await apiFetch<any>(`?module=account&action=balance&address=${encodeURIComponent(address)}&tag=latest&apikey=${API_KEY}`)
  return {
    status: data.status,
    message: data.message,
    result: data.result,
  }
}, { method: 'get_balance' })

const getTransactions = sg.wrap(async (args: GetTransactionsInput) => {
  if (!args.address || typeof args.address !== 'string') throw new Error('address is required')
  const address = args.address.trim()
  const data = await apiFetch<any>(`?module=account&action=txlist&address=${encodeURIComponent(address)}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc&apikey=${API_KEY}`)
  const items = (data.result ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        hash: item.hash,
        from: item.from,
        to: item.to,
        value: item.value,
        timeStamp: item.timeStamp,
        blockNumber: item.blockNumber,
        gasUsed: item.gasUsed,
    })),
  }
}, { method: 'get_transactions' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getBalance, getTransactions }

console.log('settlegrid-arbiscan MCP server ready')
console.log('Methods: get_balance, get_transactions')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
