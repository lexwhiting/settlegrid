/**
 * settlegrid-hashnode — Hashnode Blog Posts MCP Server
 *
 * Wraps the Hashnode GraphQL API with SettleGrid billing.
 * No API key needed for public reads.
 *
 * Methods:
 *   search_posts(query, first)    — Search posts            (1¢)
 *   get_publication(host)         — Get publication info     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  first?: number
}

interface PublicationInput {
  host: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const GQL_URL = 'https://gql.hashnode.com'

async function gqlFetch<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Hashnode API ${res.status}: ${body.slice(0, 200)}`)
  }
  const json = await res.json() as { data: T; errors?: any[] }
  if (json.errors?.length) {
    throw new Error(`Hashnode GQL Error: ${json.errors[0].message}`)
  }
  return json.data
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'hashnode',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_posts: { costCents: 1, displayName: 'Search Posts' },
      get_publication: { costCents: 1, displayName: 'Get Publication' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPosts = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const first = Math.min(Math.max(args.first ?? 10, 1), 20)
  const data = await gqlFetch<{ searchPostsOfPublication: { edges: any[] } }>(
    `query SearchPosts($query: String!, $first: Int!) {
      searchPostsOfPublication(first: $first, filter: { query: $query }) {
        edges {
          node {
            id
            title
            brief
            url
            publishedAt
            reactionCount
            author { name username }
            tags { name }
          }
        }
      }
    }`,
    { query: args.query, first }
  )
  const edges = data.searchPostsOfPublication?.edges || []
  return {
    query: args.query,
    count: edges.length,
    posts: edges.map((e: any) => ({
      id: e.node.id,
      title: e.node.title,
      brief: e.node.brief?.slice(0, 300),
      url: e.node.url,
      publishedAt: e.node.publishedAt,
      reactions: e.node.reactionCount,
      author: e.node.author?.name,
      tags: e.node.tags?.map((t: any) => t.name) || [],
    })),
  }
}, { method: 'search_posts' })

const getPublication = sg.wrap(async (args: PublicationInput) => {
  if (!args.host || typeof args.host !== 'string') {
    throw new Error('host is required (e.g. "blog.example.com")')
  }
  const data = await gqlFetch<{ publication: any }>(
    `query GetPub($host: String!) {
      publication(host: $host) {
        id
        title
        displayTitle
        descriptionSEO
        url
        posts(first: 5) {
          edges {
            node { title brief url publishedAt }
          }
        }
      }
    }`,
    { host: args.host }
  )
  const pub = data.publication
  if (!pub) throw new Error(`Publication not found: ${args.host}`)
  return {
    id: pub.id,
    title: pub.title || pub.displayTitle,
    description: pub.descriptionSEO,
    url: pub.url,
    recentPosts: pub.posts?.edges?.map((e: any) => ({
      title: e.node.title,
      brief: e.node.brief?.slice(0, 200),
      url: e.node.url,
      publishedAt: e.node.publishedAt,
    })) || [],
  }
}, { method: 'get_publication' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPosts, getPublication }

console.log('settlegrid-hashnode MCP server ready')
console.log('Methods: search_posts, get_publication')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
