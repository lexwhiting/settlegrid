/**
 * settlegrid-cosmos — Cosmos Hub MCP Server
 *
 * Cosmos Hub blockchain data — staking, governance, and blocks.
 *
 * Methods:
 *   get_latest_block()            — Get the latest Cosmos Hub block  (1¢)
 *   get_validators()              — Get active validators  (1¢)
 *   get_proposals()               — Get governance proposals  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetLatestBlockInput {

}

interface GetValidatorsInput {

}

interface GetProposalsInput {

}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://rest.cosmos.directory/cosmoshub'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-cosmos/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Cosmos Hub API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'cosmos',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_latest_block: { costCents: 1, displayName: 'Latest Block' },
      get_validators: { costCents: 1, displayName: 'Validators' },
      get_proposals: { costCents: 1, displayName: 'Governance Proposals' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getLatestBlock = sg.wrap(async (args: GetLatestBlockInput) => {

  const data = await apiFetch<any>(`/cosmos/base/tendermint/v1beta1/blocks/latest`)
  return {
    block_id: data.block_id,
    block: data.block,
  }
}, { method: 'get_latest_block' })

const getValidators = sg.wrap(async (args: GetValidatorsInput) => {

  const data = await apiFetch<any>(`/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=10`)
  const items = (data.validators ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        operator_address: item.operator_address,
        description: item.description,
        tokens: item.tokens,
        commission: item.commission,
        status: item.status,
    })),
  }
}, { method: 'get_validators' })

const getProposals = sg.wrap(async (args: GetProposalsInput) => {

  const data = await apiFetch<any>(`/cosmos/gov/v1beta1/proposals?pagination.limit=10&pagination.reverse=true`)
  const items = (data.proposals ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        proposal_id: item.proposal_id,
        content: item.content,
        status: item.status,
        final_tally_result: item.final_tally_result,
        submit_time: item.submit_time,
    })),
  }
}, { method: 'get_proposals' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getLatestBlock, getValidators, getProposals }

console.log('settlegrid-cosmos MCP server ready')
console.log('Methods: get_latest_block, get_validators, get_proposals')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
