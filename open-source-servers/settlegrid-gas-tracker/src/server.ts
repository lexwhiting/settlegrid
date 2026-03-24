/**
 * settlegrid-gas-tracker — Ethereum Gas Price MCP Server
 *
 * Wraps the Etherscan gas oracle API with SettleGrid billing.
 * Free tier available without API key.
 *
 * Methods:
 *   get_gas_prices     — Current gas prices in Gwei     (1¢)
 *   get_gas_history    — Recent gas price history        (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GasOracleResult {
  SafeGasPrice: string
  ProposeGasPrice: string
  FastGasPrice: string
  suggestBaseFee: string
  gasUsedRatio: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const ETHERSCAN_BASE = 'https://api.etherscan.io/api'

async function etherscanFetch<T>(params: Record<string, string>): Promise<T> {
  const apiKey = process.env.ETHERSCAN_API_KEY || ''
  const query = new URLSearchParams({ ...params, ...(apiKey ? { apikey: apiKey } : {}) })
  const res = await fetch(`${ETHERSCAN_BASE}?${query.toString()}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Etherscan API ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json() as { status: string; result: T; message: string }
  if (data.status !== '1' && data.message !== 'OK') {
    throw new Error(`Etherscan error: ${data.message}`)
  }
  return data.result
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'gas-tracker',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_gas_prices: { costCents: 1, displayName: 'Current Gas Prices' },
      get_gas_history: { costCents: 2, displayName: 'Gas History' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getGasPrices = sg.wrap(async () => {
  const oracle = await etherscanFetch<GasOracleResult>({
    module: 'gastracker',
    action: 'gasoracle',
  })

  const baseFee = parseFloat(oracle.suggestBaseFee) || 0
  const ratios = oracle.gasUsedRatio
    ? oracle.gasUsedRatio.split(',').map((r) => parseFloat(r))
    : []

  return {
    timestamp: new Date().toISOString(),
    prices: {
      safe: { gwei: parseFloat(oracle.SafeGasPrice), label: 'Low priority (~10 min)' },
      standard: { gwei: parseFloat(oracle.ProposeGasPrice), label: 'Standard (~3 min)' },
      fast: { gwei: parseFloat(oracle.FastGasPrice), label: 'Fast (~30 sec)' },
    },
    baseFee: Math.round(baseFee * 100) / 100,
    gasUsedRatios: ratios.slice(0, 5),
  }
}, { method: 'get_gas_prices' })

const getGasHistory = sg.wrap(async () => {
  // Use block-based estimation for history — fetch last several blocks
  const blockResult = await etherscanFetch<string>({
    module: 'proxy',
    action: 'eth_blockNumber',
  })
  const latestBlock = parseInt(blockResult, 16)

  const snapshots: Array<{ block: number; baseFeeGwei: number }> = []

  // Fetch gas info from recent blocks (last 10 blocks)
  for (let i = 0; i < 10; i++) {
    const blockHex = '0x' + (latestBlock - i).toString(16)
    const block = await etherscanFetch<{
      baseFeePerGas?: string
      number: string
      timestamp: string
    }>({
      module: 'proxy',
      action: 'eth_getBlockByNumber',
      tag: blockHex,
      boolean: 'false',
    })

    if (block && block.baseFeePerGas) {
      const baseFeeWei = parseInt(block.baseFeePerGas, 16)
      snapshots.push({
        block: parseInt(block.number, 16),
        baseFeeGwei: Math.round((baseFeeWei / 1e9) * 100) / 100,
      })
    }
  }

  return {
    timestamp: new Date().toISOString(),
    latestBlock,
    snapshots,
  }
}, { method: 'get_gas_history' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getGasPrices, getGasHistory }

console.log('settlegrid-gas-tracker MCP server ready')
console.log('Methods: get_gas_prices, get_gas_history')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
