/**
 * settlegrid-gnosis-explorer — Gnosis Chain Explorer MCP Server
 *
 * Wraps Gnosis Blockscout API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_gnosis_address(address) — address info (1¢)
 *   get_gnosis_tx(hash) — transaction details (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface AddressInput { address: string }
interface TxInput { hash: string }

const API_BASE = 'https://gnosis.blockscout.com/api/v2'

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'gnosis-explorer',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_gnosis_address: { costCents: 1, displayName: 'Gnosis Address' },
      get_gnosis_tx: { costCents: 1, displayName: 'Gnosis Transaction' },
    },
  },
})

const getGnosisAddress = sg.wrap(async (args: AddressInput) => {
  if (!args.address?.startsWith('0x')) throw new Error('Valid 0x address required')
  const data = await apiFetch<any>(`/addresses/${args.address}`)
  return {
    address: data.hash, name: data.name || null,
    balance_xdai: data.coin_balance ? parseFloat(data.coin_balance) / 1e18 : 0,
    tx_count: data.transactions_count, token_transfers: data.token_transfers_count,
    is_contract: data.is_contract,
  }
}, { method: 'get_gnosis_address' })

const getGnosisTx = sg.wrap(async (args: TxInput) => {
  if (!args.hash?.startsWith('0x')) throw new Error('Valid transaction hash required')
  const data = await apiFetch<any>(`/transactions/${args.hash}`)
  return {
    hash: data.hash, block: data.block, status: data.status,
    from: data.from?.hash, to: data.to?.hash,
    value: data.value, fee: data.fee?.value,
    timestamp: data.timestamp, method: data.method,
  }
}, { method: 'get_gnosis_tx' })

export { getGnosisAddress, getGnosisTx }

console.log('settlegrid-gnosis-explorer MCP server ready')
console.log('Methods: get_gnosis_address, get_gnosis_tx')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
