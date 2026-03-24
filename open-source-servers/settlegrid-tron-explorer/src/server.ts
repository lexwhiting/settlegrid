/**
 * settlegrid-tron-explorer — Tron Blockchain Explorer MCP Server
 *
 * Wraps TronGrid API with SettleGrid billing.
 * No API key needed for basic queries.
 *
 * Methods:
 *   get_tron_account(address) — account info (1¢)
 *   get_tron_transactions(address, limit?) — transactions (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface AccountInput { address: string }
interface TxInput { address: string; limit?: number }

const API_BASE = 'https://api.trongrid.io'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'tron-explorer',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_tron_account: { costCents: 1, displayName: 'Tron Account' },
      get_tron_transactions: { costCents: 1, displayName: 'Tron Transactions' },
    },
  },
})

const getTronAccount = sg.wrap(async (args: AccountInput) => {
  if (!args.address || !args.address.startsWith('T')) throw new Error('Valid Tron address required (starts with T)')
  const data = await apiFetch<any>(`/v1/accounts/${args.address}`)
  const acct = data.data?.[0] || {}
  return {
    address: acct.address,
    balance_trx: (acct.balance || 0) / 1e6,
    bandwidth: acct.free_net_usage || 0,
    energy: acct.account_resource?.energy_usage || 0,
    created: acct.create_time,
  }
}, { method: 'get_tron_account' })

const getTronTransactions = sg.wrap(async (args: TxInput) => {
  if (!args.address) throw new Error('address is required')
  const limit = args.limit ?? 20
  const data = await apiFetch<any>(`/v1/accounts/${args.address}/transactions?limit=${limit}`)
  return {
    total: data.meta?.total || 0,
    transactions: (data.data || []).map((tx: any) => ({
      txID: tx.txID,
      block: tx.blockNumber,
      timestamp: tx.block_timestamp,
      type: tx.raw_data?.contract?.[0]?.type,
    })),
  }
}, { method: 'get_tron_transactions' })

export { getTronAccount, getTronTransactions }

console.log('settlegrid-tron-explorer MCP server ready')
console.log('Methods: get_tron_account, get_tron_transactions')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
