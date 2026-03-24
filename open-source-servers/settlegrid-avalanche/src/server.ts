/**
 * settlegrid-avalanche — Avalanche Glacier MCP Server
 *
 * Avalanche blockchain data from the Glacier API.
 *
 * Methods:
 *   get_chains()                  — Get all supported Avalanche chains  (1¢)
 *   get_block(block_id)           — Get block details on C-Chain by number  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetChainsInput {

}

interface GetBlockInput {
  block_id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://glacier-api.avax.network/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-avalanche/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Avalanche Glacier API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'avalanche',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_chains: { costCents: 1, displayName: 'List Chains' },
      get_block: { costCents: 1, displayName: 'Block Info' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getChains = sg.wrap(async (args: GetChainsInput) => {

  const data = await apiFetch<any>(`/chains`)
  const items = (data.chains ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        chainId: item.chainId,
        chainName: item.chainName,
        vmName: item.vmName,
        explorerUrl: item.explorerUrl,
        networkToken: item.networkToken,
    })),
  }
}, { method: 'get_chains' })

const getBlock = sg.wrap(async (args: GetBlockInput) => {
  if (!args.block_id || typeof args.block_id !== 'string') throw new Error('block_id is required')
  const block_id = args.block_id.trim()
  const data = await apiFetch<any>(`/chains/43114/blocks/${encodeURIComponent(block_id)}`)
  return {
    blockNumber: data.blockNumber,
    blockTimestamp: data.blockTimestamp,
    blockHash: data.blockHash,
    txCount: data.txCount,
    gasUsed: data.gasUsed,
    gasLimit: data.gasLimit,
  }
}, { method: 'get_block' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getChains, getBlock }

console.log('settlegrid-avalanche MCP server ready')
console.log('Methods: get_chains, get_block')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
