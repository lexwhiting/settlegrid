/**
 * settlegrid-archive-org — Archive.org Search MCP Server
 *
 * Wraps Internet Archive API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_archive(query, media_type?, limit?) — search IA (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string; media_type?: string; limit?: number }

const sg = settlegrid.init({
  toolSlug: 'archive-org',
  pricing: { defaultCostCents: 1, methods: { search_archive: { costCents: 1, displayName: 'Search Archive' } } },
})

const searchArchive = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const limit = args.limit ?? 10
  let q = args.query
  if (args.media_type) q += ` AND mediatype:${args.media_type}`
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&output=json&rows=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  const data = await res.json() as any
  return {
    total: data.response?.numFound,
    items: (data.response?.docs || []).map((d: any) => ({
      identifier: d.identifier, title: d.title, creator: d.creator,
      mediatype: d.mediatype, date: d.date, description: d.description?.slice(0, 200),
      url: `https://archive.org/details/${d.identifier}`,
      downloads: d.downloads,
    })),
  }
}, { method: 'search_archive' })

export { searchArchive }

console.log('settlegrid-archive-org MCP server ready')
console.log('Methods: search_archive')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
