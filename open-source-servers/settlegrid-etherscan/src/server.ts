/**
 * settlegrid-etherscan — Etherscan MCP Server
 *
 * Wraps the Etherscan API with SettleGrid billing.
 * Requires ETHERSCAN_API_KEY environment variable.
 *
 * Methods:
 *   get_balance(address)                     (1¢)
 *   get_transactions(address)                (2¢)
 *   get_gas_price()                          (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetBalanceInput {
  address: string
}

interface GetTransactionsInput {
  address: string
  page?: number
  offset?: number
}

interface GetGasPriceInput {
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.etherscan.io/api'
const USER_AGENT = 'settlegrid-etherscan/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.ETHERSCAN_API_KEY
  if (!key) throw new Error('ETHERSCAN_API_KEY environment variable is required')
  return key
}

async function apiFetch<T>(path: string, options: {
  method?: string
  params?: Record<string, string>
  body?: unknown
  headers?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  url.searchParams.set('apikey', getApiKey())
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    ...options.headers,
  }
  const fetchOpts: RequestInit = { method: options.method ?? 'GET', headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
    ;(headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  const res = await fetch(url.toString(), fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Etherscan API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'etherscan',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_balance: { costCents: 1, displayName: 'Get ETH balance for an address' },
      get_transactions: { costCents: 2, displayName: 'Get transaction list for an address' },
      get_gas_price: { costCents: 1, displayName: 'Get current gas price oracle' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getBalance = sg.wrap(async (args: GetBalanceInput) => {
  if (!args.address || typeof args.address !== 'string') {
    throw new Error('address is required (ethereum address)')
  }

  const params: Record<string, string> = {}
  params['address'] = args.address

  const data = await apiFetch<Record<string, unknown>>('', {
    params,
  })

  return data
}, { method: 'get_balance' })

const getTransactions = sg.wrap(async (args: GetTransactionsInput) => {
  if (!args.address || typeof args.address !== 'string') {
    throw new Error('address is required (ethereum address)')
  }

  const params: Record<string, string> = {}
  params['address'] = args.address
  if (args.page !== undefined) params['page'] = String(args.page)
  if (args.offset !== undefined) params['offset'] = String(args.offset)

  const data = await apiFetch<Record<string, unknown>>('', {
    params,
  })

  return data
}, { method: 'get_transactions' })

const getGasPrice = sg.wrap(async (args: GetGasPriceInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('', {
    params,
  })

  return data
}, { method: 'get_gas_price' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getBalance, getTransactions, getGasPrice }

console.log('settlegrid-etherscan MCP server ready')
console.log('Methods: get_balance, get_transactions, get_gas_price')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
