/**
 * settlegrid-bbc-news — BBC News MCP Server
 *
 * Latest BBC News headlines parsed from RSS feed.
 *
 * Methods:
 *   get_headlines()               — Get latest BBC News headlines  (1¢)
 *   get_section(section)          — Get BBC News headlines by section  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetHeadlinesInput {}

interface GetSectionInput {
  section: string
}

interface RssItem {
  title: string
  link: string
  description: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BBC_BASE = 'https://feeds.bbci.co.uk/news'

async function fetchRss(url: string): Promise<RssItem[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'settlegrid-bbc-news/1.0' },
  })
  if (!res.ok) {
    throw new Error(`BBC RSS ${res.status}: ${res.statusText}`)
  }
  const xml = await res.text()
  const items: RssItem[] = []
  const itemRegex = /<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<description><!\[CDATA\[(.*?)\]\]><\/description>[\s\S]*?<\/item>/g
  const itemRegexSimple = /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<description>(.*?)<\/description>[\s\S]*?<\/item>/g
  let match: RegExpExecArray | null
  while ((match = itemRegex.exec(xml)) !== null) {
    items.push({ title: match[1].trim(), link: match[2].trim(), description: match[3].trim() })
  }
  if (items.length === 0) {
    while ((match = itemRegexSimple.exec(xml)) !== null) {
      items.push({ title: match[1].trim(), link: match[2].trim(), description: match[3].trim() })
    }
  }
  return items.slice(0, 20)
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'bbc-news',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_headlines: { costCents: 1, displayName: 'Get Headlines' },
      get_section: { costCents: 1, displayName: 'Get Section' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getHeadlines = sg.wrap(async (_args: GetHeadlinesInput) => {
  const items = await fetchRss(`${BBC_BASE}/rss.xml`)
  return { count: items.length, items }
}, { method: 'get_headlines' })

const getSection = sg.wrap(async (args: GetSectionInput) => {
  if (!args.section || typeof args.section !== 'string') throw new Error('section is required')
  const section = args.section.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
  const items = await fetchRss(`${BBC_BASE}/${section}/rss.xml`)
  return { section, count: items.length, items }
}, { method: 'get_section' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getHeadlines, getSection }

console.log('settlegrid-bbc-news MCP server ready')
console.log('Methods: get_headlines, get_section')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
