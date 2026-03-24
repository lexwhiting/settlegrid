/**
 * settlegrid-cardano — Blockfrost Cardano MCP Server
 *
 * Cardano blockchain data from Blockfrost — blocks, addresses, and assets.
 *
 * Methods:
 *   get_latest_block()            — Get the latest Cardano block  (2¢)
 *   get_address(address)          — Get Cardano address details  (2¢)
 *   get_asset(asset)              — Get native asset details by policy ID and asset name  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetLatestBlockInput {

}

interface GetAddressInput {
  address: string
}

interface GetAssetInput {
  asset: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://cardano-mainnet.blockfrost.io/api/v0'
const API_KEY = process.env.BLOCKFROST_PROJECT_ID ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-cardano/1.0', 'project_id': API_KEY },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Blockfrost Cardano API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'cardano',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_latest_block: { costCents: 2, displayName: 'Latest Block' },
      get_address: { costCents: 2, displayName: 'Address Info' },
      get_asset: { costCents: 2, displayName: 'Asset Info' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getLatestBlock = sg.wrap(async (args: GetLatestBlockInput) => {

  const data = await apiFetch<any>(`/blocks/latest`)
  return {
    hash: data.hash,
    height: data.height,
    slot: data.slot,
    epoch: data.epoch,
    time: data.time,
    tx_count: data.tx_count,
    size: data.size,
  }
}, { method: 'get_latest_block' })

const getAddress = sg.wrap(async (args: GetAddressInput) => {
  if (!args.address || typeof args.address !== 'string') throw new Error('address is required')
  const address = args.address.trim()
  const data = await apiFetch<any>(`/addresses/${encodeURIComponent(address)}`)
  return {
    address: data.address,
    amount: data.amount,
    stake_address: data.stake_address,
    type: data.type,
    script: data.script,
  }
}, { method: 'get_address' })

const getAsset = sg.wrap(async (args: GetAssetInput) => {
  if (!args.asset || typeof args.asset !== 'string') throw new Error('asset is required')
  const asset = args.asset.trim()
  const data = await apiFetch<any>(`/assets/${encodeURIComponent(asset)}`)
  return {
    asset: data.asset,
    policy_id: data.policy_id,
    asset_name: data.asset_name,
    quantity: data.quantity,
    initial_mint_tx_hash: data.initial_mint_tx_hash,
    metadata: data.metadata,
  }
}, { method: 'get_asset' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getLatestBlock, getAddress, getAsset }

console.log('settlegrid-cardano MCP server ready')
console.log('Methods: get_latest_block, get_address, get_asset')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
