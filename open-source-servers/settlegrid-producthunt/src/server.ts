/**
 * settlegrid-producthunt — Product Hunt Posts MCP Server
 *
 * Wraps the Product Hunt GraphQL API with SettleGrid billing.
 * Requires a Product Hunt developer token.
 *
 * Methods:
 *   get_posts(first)       — Get top posts      (2¢)
 *   search_posts(query)    — Search products    (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PostsInput {
  first?: number
}

interface SearchInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const PH_GQL = 'https://api.producthunt.com/v2/api/graphql'
const TOKEN = process.env.PRODUCTHUNT_TOKEN || ''

async function phFetch<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  if (!TOKEN) throw new Error('PRODUCTHUNT_TOKEN environment variable is required')
  const res = await fetch(PH_GQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Product Hunt API ${res.status}: ${body.slice(0, 200)}`)
  }
  const json = await res.json() as { data: T; errors?: any[] }
  if (json.errors?.length) throw new Error(`PH GQL: ${json.errors[0].message}`)
  return json.data
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'producthunt',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_posts: { costCents: 2, displayName: 'Get Posts' },
      search_posts: { costCents: 2, displayName: 'Search Posts' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPosts = sg.wrap(async (args: PostsInput) => {
  const first = Math.min(Math.max(args.first ?? 10, 1), 20)
  const data = await phFetch<{ posts: { edges: any[] } }>(
    `query($first: Int!) { posts(first: $first) { edges { node { id name tagline votesCount url thumbnail { url } topics { edges { node { name } } } } } } }`,
    { first }
  )
  return {
    count: data.posts.edges.length,
    posts: data.posts.edges.map((e: any) => ({
      id: e.node.id,
      name: e.node.name,
      tagline: e.node.tagline,
      votes: e.node.votesCount,
      url: e.node.url,
      thumbnail: e.node.thumbnail?.url,
      topics: e.node.topics?.edges?.map((t: any) => t.node.name) || [],
    })),
  }
}, { method: 'get_posts' })

const searchPosts = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const data = await phFetch<{ posts: { edges: any[] } }>(
    `query($query: String!) { posts(first: 10, search: $query) { edges { node { id name tagline votesCount url } } } }`,
    { query: args.query }
  )
  return {
    query: args.query,
    count: data.posts.edges.length,
    posts: data.posts.edges.map((e: any) => ({
      id: e.node.id,
      name: e.node.name,
      tagline: e.node.tagline,
      votes: e.node.votesCount,
      url: e.node.url,
    })),
  }
}, { method: 'search_posts' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPosts, searchPosts }

console.log('settlegrid-producthunt MCP server ready')
console.log('Methods: get_posts, search_posts')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
