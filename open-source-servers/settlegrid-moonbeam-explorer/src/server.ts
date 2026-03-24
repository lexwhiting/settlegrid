/**
 * settlegrid-moonbeam-explorer — Moonbeam Blockchain Explorer MCP Server
 *
 * Wraps Moonbeam Blockscout API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_moonbeam_address(address) — address info (1¢)
 *   get_moonbeam_block(number) — block info (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface AddressInput { address: string }
interface BlockInput { number: number }

const API_BASE = 'https://moonbeam.blockscout.com/api/v2'

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
  toolSlug: 'moonbeam-explorer',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_moonbeam_address: { costCents: 1, displayName: 'Moonbeam Address' },
      get_moonbeam_block: { costCents: 1, displayName: 'Moonbeam Block' },
    },
  },
})

const getMoonbeamAddress = sg.wrap(async (args: AddressInput) => {
  if (!args.address?.startsWith('0x')) throw new Error('Valid 0x address required')
  const data = await apiFetch<any>(`/addresses/${args.address}`)
  return {
    address: data.hash, balance_glmr: data.coin_balance ? parseFloat(data.coin_balance) / 1e18 : 0,
    tx_count: data.transactions_count, is_contract: data.is_contract, name: data.name || null,
  }
}, { method: 'get_moonbeam_address' })

const getMoonbeamBlock = sg.wrap(async (args: BlockInput) => {
  if (typeof args.number !== 'number') throw new Error('block number required')
  const data = await apiFetch<any>(`/blocks/${args.number}`)
  return {
    number: data.height, hash: data.hash, timestamp: data.timestamp,
    tx_count: data.tx_count, gas_used: data.gas_used, gas_limit: data.gas_limit,
    miner: data.miner?.hash, size: data.size,
  }
}, { method: 'get_moonbeam_block' })

export { getMoonbeamAddress, getMoonbeamBlock }

console.log('settlegrid-moonbeam-explorer MCP server ready')
console.log('Methods: get_moonbeam_address, get_moonbeam_block')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
