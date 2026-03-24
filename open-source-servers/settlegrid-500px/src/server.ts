/**
 * settlegrid-500px — 500px Photo Exploration MCP Server
 *
 * Explore popular photos and photographers on 500px. No API key needed.
 *
 * Methods:
 *   search_500px_photos(query, limit?) — Search photos (1¢)
 *   get_popular_photos(feature?, limit?) — Get popular photos (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string; limit?: number }
interface PopularInput { feature?: string; limit?: number }

const GQL_URL = 'https://api.500px.com/graphql'

async function gqlFetch(query: string, variables: Record<string, any> = {}): Promise<any> {
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'settlegrid-500px/1.0' },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`500px API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

const sg = settlegrid.init({
  toolSlug: '500px',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_500px_photos: { costCents: 1, displayName: 'Search 500px Photos' },
      get_popular_photos: { costCents: 1, displayName: 'Popular 500px Photos' },
    },
  },
})

const search500pxPhotos = sg.wrap(async (args: SearchInput) => {
  const q = args.query?.trim()
  if (!q) throw new Error('query required')
  const limit = Math.min(args.limit || 20, 50)
  const data = await gqlFetch(`
    query SearchPhotos($query: String!, $first: Int) {
      photos: search(query: $query, type: PHOTOS, first: $first) {
        edges {
          node {
            ... on Photo {
              id
              name
              description
              width
              height
              canonicalUrl
              photographer { displayName username }
              category
              pulse { highest }
              likedByUsersCount
              viewCount
            }
          }
        }
      }
    }
  `, { query: q, first: limit }).catch(() => ({ data: { photos: { edges: [] } } }))
  const photos = (data.data?.photos?.edges || []).map((e: any) => ({
    id: e.node.id,
    name: e.node.name,
    photographer: e.node.photographer?.displayName,
    category: e.node.category,
    pulse: e.node.pulse?.highest,
    likes: e.node.likedByUsersCount,
    views: e.node.viewCount,
    url: e.node.canonicalUrl,
    dimensions: { width: e.node.width, height: e.node.height },
  }))
  return { query: q, count: photos.length, photos }
}, { method: 'search_500px_photos' })

const getPopularPhotos = sg.wrap(async (args: PopularInput) => {
  const feature = args.feature || 'popular'
  const limit = Math.min(args.limit || 20, 50)
  const validFeatures = ['popular', 'upcoming', 'editors', 'fresh_today']
  if (!validFeatures.includes(feature)) {
    throw new Error(`Invalid feature. Choose: ${validFeatures.join(', ')}`)
  }
  const data = await gqlFetch(`
    query PopularPhotos($feature: PhotoFeature!, $first: Int) {
      photos(feature: $feature, first: $first) {
        edges {
          node {
            id name canonicalUrl
            photographer { displayName }
            category
            pulse { highest }
            likedByUsersCount
          }
        }
      }
    }
  `, { feature: feature.toUpperCase(), first: limit }).catch(() => ({ data: { photos: { edges: [] } } }))
  const photos = (data.data?.photos?.edges || []).map((e: any) => ({
    id: e.node.id,
    name: e.node.name,
    photographer: e.node.photographer?.displayName,
    category: e.node.category,
    pulse: e.node.pulse?.highest,
    likes: e.node.likedByUsersCount,
    url: e.node.canonicalUrl,
  }))
  return { feature, count: photos.length, photos }
}, { method: 'get_popular_photos' })

export { search500pxPhotos, getPopularPhotos }

console.log('settlegrid-500px MCP server ready')
console.log('Methods: search_500px_photos, get_popular_photos')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
