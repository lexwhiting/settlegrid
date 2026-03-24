/**
 * settlegrid-fantom-explorer — Fantom Blockchain Explorer MCP Server
 *
 * Wraps FTMScan API with SettleGrid billing.
 * Free key from https://ftmscan.com/apis.
 *
 * Methods:
 *   get_ftm_balance(address) — FTM balance (1¢)
 *   get_ftm_transactions(address, limit?) — transactions (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface BalanceInput { address: string }
interface TxInput { address: string; limit?: number }

const API_BASE = 'https://api.ftmscan.com/api'
const API_KEY = process.env.FTMSCAN_API_KEY || ''

async function apiFetch<T>(params: string): Promise<T> {
  const sep = API_KEY ? `&apikey=${API_KEY}` : ''
  const res = await fetch(`${API_BASE}?${params}${sep}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'fantom-explorer',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_ftm_balance: { costCents: 1, displayName: 'FTM Balance' },
      get_ftm_transactions: { costCents: 1, displayName: 'FTM Transactions' },
    },
  },
})

const getFtmBalance = sg.wrap(async (args: BalanceInput) => {
  if (!args.address?.startsWith('0x')) throw new Error('Valid 0x address required')
  const data = await apiFetch<any>(`module=account&action=balance&address=${args.address}&tag=latest`)
  return { address: args.address, balance_ftm: parseFloat(data.result) / 1e18, raw_wei: data.result }
}, { method: 'get_ftm_balance' })

const getFtmTransactions = sg.wrap(async (args: TxInput) => {
  if (!args.address?.startsWith('0x')) throw new Error('Valid 0x address required')
  const limit = args.limit ?? 20
  const data = await apiFetch<any>(`module=account&action=txlist&address=${args.address}&startblock=0&endblock=99999999&page=1&offset=${limit}&sort=desc`)
  return {
    transactions: (data.result || []).map((tx: any) => ({
      hash: tx.hash, block: tx.blockNumber, from: tx.from, to: tx.to,
      value_ftm: parseFloat(tx.value) / 1e18, timestamp: parseInt(tx.timeStamp),
    })),
  }
}, { method: 'get_ftm_transactions' })

export { getFtmBalance, getFtmTransactions }

console.log('settlegrid-fantom-explorer MCP server ready')
console.log('Methods: get_ftm_balance, get_ftm_transactions')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
