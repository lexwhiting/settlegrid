/**
 * settlegrid-mooc-search — MOOC Search MCP Server
 *
 * MOOC Search tools with SettleGrid billing.
 *
 * Pricing: 1-2c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

const PLATFORMS = [
  { name: 'Coursera', url: 'https://coursera.org', courses: 7000, free_courses: 2100, certificates: true },
  { name: 'edX', url: 'https://edx.org', courses: 4000, free_courses: 3000, certificates: true },
  { name: 'Khan Academy', url: 'https://khanacademy.org', courses: 10000, free_courses: 10000, certificates: false },
  { name: 'Udacity', url: 'https://udacity.com', courses: 200, free_courses: 50, certificates: true },
  { name: 'MIT OCW', url: 'https://ocw.mit.edu', courses: 2500, free_courses: 2500, certificates: false },
  { name: 'freeCodeCamp', url: 'https://freecodecamp.org', courses: 12, free_courses: 12, certificates: true },
]

const sg = settlegrid.init({
  toolSlug: 'mooc-search',
  pricing: { defaultCostCents: 1, methods: {
    search: { costCents: 1, displayName: 'Search MOOCs' },
    list_platforms: { costCents: 1, displayName: 'List Platforms' },
  }},
})

const search = sg.wrap(async (args: { query: string; free_only?: boolean }) => {
  if (!args.query) throw new Error('query required')
  let platforms = [...PLATFORMS]
  if (args.free_only) platforms = platforms.filter(p => p.free_courses > 0)
  return { query: args.query, platforms: platforms.map(p => ({ ...p, search_url: `${p.url}/search?query=${encodeURIComponent(args.query)}` })), count: platforms.length, tip: 'Visit the search URLs for actual course listings' }
}, { method: 'search' })

const listPlatforms = sg.wrap(async (_a: Record<string, never>) => {
  return { platforms: PLATFORMS, count: PLATFORMS.length, total_courses: PLATFORMS.reduce((s, p) => s + p.courses, 0) }
}, { method: 'list_platforms' })

export { search, listPlatforms }
console.log('settlegrid-mooc-search MCP server ready | Powered by SettleGrid')
