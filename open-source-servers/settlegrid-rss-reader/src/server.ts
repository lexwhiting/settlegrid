/**
 * settlegrid-rss-reader — RSS/Atom Feed Reader MCP Server
 *
 * Direct RSS fetching + XML parsing — no external API needed.
 *
 * Methods:
 *   parse_feed(url)           — Parse feed metadata          (1¢)
 *   get_entries(url, limit)   — Get feed entries              (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface FeedInput {
  url: string
}

interface EntriesInput {
  url: string
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function validateUrl(url: unknown): string {
  if (!url || typeof url !== 'string') throw new Error('url is required')
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http/https URLs allowed')
    return parsed.href
  } catch {
    throw new Error('Invalid URL format')
  }
}

async function fetchFeed(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      'User-Agent': 'settlegrid-rss-reader/1.0',
    },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`)
  const text = await res.text()
  if (text.length > 2_000_000) throw new Error('Feed too large (max 2MB)')
  return text
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  return match ? match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : ''
}

function extractAttribute(xml: string, tag: string, attr: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i'))
  return match ? match[1] : ''
}

function parseItems(xml: string): Array<{ title: string; link: string; description: string; pubDate: string; author: string }> {
  const items: Array<{ title: string; link: string; description: string; pubDate: string; author: string }> = []

  // RSS <item> or Atom <entry>
  const itemRegex = /<(?:item|entry)[\s>]([\s\S]*?)<\/(?:item|entry)>/gi
  let match: RegExpExecArray | null

  while ((match = itemRegex.exec(xml)) !== null && items.length < 100) {
    const content = match[1]
    const link = extractTag(content, 'link') || extractAttribute(content, 'link', 'href')
    items.push({
      title: extractTag(content, 'title'),
      link,
      description: extractTag(content, 'description') || extractTag(content, 'summary') || extractTag(content, 'content'),
      pubDate: extractTag(content, 'pubDate') || extractTag(content, 'published') || extractTag(content, 'updated'),
      author: extractTag(content, 'author') || extractTag(content, 'dc:creator'),
    })
  }

  return items
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'rss-reader',
  pricing: {
    defaultCostCents: 1,
    methods: {
      parse_feed: { costCents: 1, displayName: 'Parse Feed' },
      get_entries: { costCents: 1, displayName: 'Get Entries' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const parseFeed = sg.wrap(async (args: FeedInput) => {
  const url = validateUrl(args.url)
  const xml = await fetchFeed(url)

  const isAtom = xml.includes('<feed')
  const title = extractTag(xml, 'title')
  const description = extractTag(xml, 'description') || extractTag(xml, 'subtitle')
  const link = extractTag(xml, 'link') || extractAttribute(xml, 'link', 'href')
  const language = extractTag(xml, 'language')
  const lastBuild = extractTag(xml, 'lastBuildDate') || extractTag(xml, 'updated')
  const items = parseItems(xml)

  return {
    url,
    format: isAtom ? 'atom' : 'rss',
    title,
    description: description.slice(0, 500),
    link,
    language: language || null,
    lastUpdated: lastBuild || null,
    entryCount: items.length,
  }
}, { method: 'parse_feed' })

const getEntries = sg.wrap(async (args: EntriesInput) => {
  const url = validateUrl(args.url)
  const limit = Math.min(Math.max(args.limit || 10, 1), 50)
  const xml = await fetchFeed(url)

  const title = extractTag(xml, 'title')
  const items = parseItems(xml).slice(0, limit)

  return {
    feed: title,
    url,
    count: items.length,
    entries: items.map((item) => ({
      title: item.title,
      link: item.link,
      description: item.description.replace(/<[^>]+>/g, '').slice(0, 300),
      pubDate: item.pubDate || null,
      author: item.author || null,
    })),
  }
}, { method: 'get_entries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { parseFeed, getEntries }

console.log('settlegrid-rss-reader MCP server ready')
console.log('Methods: parse_feed, get_entries')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
