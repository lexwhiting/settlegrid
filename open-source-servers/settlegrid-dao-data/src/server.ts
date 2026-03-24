/**
 * settlegrid-dao-data — DAO Governance Data MCP Server
 *
 * Wraps the free Snapshot GraphQL API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_daos               — List top DAOs by member count   (1¢)
 *   get_proposals(dao)     — Recent proposals for a DAO      (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProposalsInput {
  dao: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const SNAPSHOT_URL = 'https://hub.snapshot.org/graphql'

async function snapshotQuery<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(SNAPSHOT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Snapshot API ${res.status}: ${body.slice(0, 200)}`)
  }
  const json = await res.json() as { data: T; errors?: Array<{ message: string }> }
  if (json.errors?.length) {
    throw new Error(`Snapshot error: ${json.errors[0].message}`)
  }
  return json.data
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'dao-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_daos: { costCents: 1, displayName: 'List DAOs' },
      get_proposals: { costCents: 2, displayName: 'DAO Proposals' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getDaos = sg.wrap(async () => {
  const data = await snapshotQuery<{
    spaces: Array<{
      id: string
      name: string
      about: string
      network: string
      members: string[]
      proposalsCount: number
    }>
  }>(`
    query {
      spaces(
        first: 30,
        skip: 0,
        orderBy: "proposalsCount",
        orderDirection: desc
      ) {
        id
        name
        about
        network
        members
        proposalsCount
      }
    }
  `)

  return {
    count: data.spaces.length,
    daos: data.spaces.map((s) => ({
      id: s.id,
      name: s.name,
      about: s.about?.slice(0, 200) || null,
      network: s.network,
      members: s.members?.length ?? 0,
      proposalsCount: s.proposalsCount ?? 0,
    })),
  }
}, { method: 'get_daos' })

const getProposals = sg.wrap(async (args: ProposalsInput) => {
  if (!args.dao || typeof args.dao !== 'string') {
    throw new Error('dao is required (space ID, e.g. "aave.eth")')
  }
  const dao = args.dao.trim()

  const data = await snapshotQuery<{
    proposals: Array<{
      id: string
      title: string
      body: string
      state: string
      author: string
      created: number
      start: number
      end: number
      choices: string[]
      scores: number[]
      scores_total: number
      votes: number
    }>
  }>(`
    query ($space: String!) {
      proposals(
        first: 20,
        skip: 0,
        where: { space_in: [$space] },
        orderBy: "created",
        orderDirection: desc
      ) {
        id
        title
        body
        state
        author
        created
        start
        end
        choices
        scores
        scores_total
        votes
      }
    }
  `, { space: dao })

  return {
    dao,
    count: data.proposals.length,
    proposals: data.proposals.map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body?.slice(0, 300) || null,
      state: p.state,
      author: p.author,
      created: new Date(p.created * 1000).toISOString(),
      start: new Date(p.start * 1000).toISOString(),
      end: new Date(p.end * 1000).toISOString(),
      choices: p.choices,
      scores: p.scores,
      totalScore: p.scores_total,
      votes: p.votes,
    })),
  }
}, { method: 'get_proposals' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getDaos, getProposals }

console.log('settlegrid-dao-data MCP server ready')
console.log('Methods: get_daos, get_proposals')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
