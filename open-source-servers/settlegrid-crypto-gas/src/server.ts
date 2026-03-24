/**
 * settlegrid-crypto-gas — Crypto Gas Prices MCP Server
 *
 * Fetches Ethereum gas prices with SettleGrid billing.
 * No API key needed for basic endpoint.
 *
 * Methods:
 *   get_eth_gas() — Ethereum gas prices (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

const API_BASE = 'https://api.blocknative.com/gasprices/blockprices'

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'crypto-gas',
  pricing: { defaultCostCents: 1, methods: { get_eth_gas: { costCents: 1, displayName: 'ETH Gas Prices' } } },
})

const getEthGas = sg.wrap(async () => {
  const data = await apiFetch<any>(API_BASE)
  const block = data.blockPrices?.[0]
  return {
    block_number: block?.blockNumber,
    base_fee_gwei: block?.baseFeePerGas,
    estimated_prices: block?.estimatedPrices?.map((p: any) => ({
      confidence: p.confidence,
      price_gwei: p.price,
      max_priority_fee: p.maxPriorityFeePerGas,
      max_fee: p.maxFeePerGas,
    })),
    system: data.system,
    unit: data.unit,
  }
}, { method: 'get_eth_gas' })

export { getEthGas }

console.log('settlegrid-crypto-gas MCP server ready')
console.log('Methods: get_eth_gas')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
