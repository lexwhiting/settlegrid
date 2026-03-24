/**
 * settlegrid-etherscan — Etherscan Blockchain Data MCP Server
 *
 * Wraps the Etherscan API with SettleGrid billing.
 * Requires ETHERSCAN_API_KEY environment variable.
 *
 * Methods:
 *   get_balance(address)          — ETH balance           (2¢)
 *   get_transactions(address)     — Transaction list      (2¢)
 *   get_gas_price()               — Gas price oracle      (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface BalanceInput { address: string }
interface TxInput { address: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.etherscan.io/api'

function getKey(): string {
  const k = process.env.ETHERSCAN_API_KEY
  if (!k) throw new Error('ETHERSCAN_API_KEY environment variable is required')
  return k
}

async function esFetch<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(BASE)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('apikey', getKey())
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-etherscan/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Etherscan API ${res.status}: ${body.slice(0, 200)}`)
  }
  const json = await res.json() as { status: string; message: string; result: T }
  if (json.status === '0' && json.message === 'NOTOK') {
    throw new Error(`Etherscan error: ${String(json.result).slice(0, 200)}`)
  }
  return json.result
}

function validateAddress(addr: string): string {
  const trimmed = addr.trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    throw new Error('Invalid Ethereum address. Must be 0x followed by 40 hex characters.')
  }
  return trimmed
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'etherscan',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_balance: { costCents: 2, displayName: 'ETH Balance' },
      get_transactions: { costCents: 2, displayName: 'Transactions' },
      get_gas_price: { costCents: 2, displayName: 'Gas Price' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getBalance = sg.wrap(async (args: BalanceInput) => {
  if (!args.address || typeof args.address !== 'string') {
    throw new Error('address is required (Ethereum address starting with 0x)')
  }
  const address = validateAddress(args.address)
  const weiBalance = await esFetch<string>({ module: 'account', action: 'balance', address, tag: 'latest' })
  const ethBalance = Number(weiBalance) / 1e18
  return { address, balanceWei: weiBalance, balanceEth: ethBalance }
}, { method: 'get_balance' })

const getTransactions = sg.wrap(async (args: TxInput) => {
  if (!args.address || typeof args.address !== 'string') {
    throw new Error('address is required')
  }
  const address = validateAddress(args.address)
  const txs = await esFetch<Array<Record<string, string>>>({
    module: 'account',
    action: 'txlist',
    address,
    startblock: '0',
    endblock: '99999999',
    page: '1',
    offset: '20',
    sort: 'desc',
  })
  return {
    address,
    count: Array.isArray(txs) ? txs.length : 0,
    transactions: Array.isArray(txs) ? txs : [],
  }
}, { method: 'get_transactions' })

const getGasPrice = sg.wrap(async () => {
  const data = await esFetch<Record<string, string>>({ module: 'gastracker', action: 'gasoracle' })
  return {
    safeGasPrice: data.SafeGasPrice,
    proposeGasPrice: data.ProposeGasPrice,
    fastGasPrice: data.FastGasPrice,
    suggestBaseFee: data.suggestBaseFee,
  }
}, { method: 'get_gas_price' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getBalance, getTransactions, getGasPrice }

console.log('settlegrid-etherscan MCP server ready')
console.log('Methods: get_balance, get_transactions, get_gas_price')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
