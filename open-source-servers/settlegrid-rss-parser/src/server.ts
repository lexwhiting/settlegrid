/**
 * settlegrid-rss-parser — RSS Parser MCP Server
 *
 * Fetch and parse any RSS/Atom feed into structured data.
 *
 * Methods:
 *   parse_feed(url)               — Fetch and parse an RSS/Atom feed URL  (1¢)
 *   get_headlines(url, limit)     — Get headlines from an RSS feed URL  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ParseFeedInput {
  url: string
}

interface GetHeadlinesInput {
  url: string
  limit?: number
}

interface FeedItem {
  title: string
  link: string
  description: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTag(block: string, tag: string): string {
  const cdataMatch = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i').exec(block)
  if (cdataMatch) return cdataMatch[1].trim()
  const simpleMatch = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(block)
  return simpleMatch ? simpleMatch[1].trim() : ''
}

function getFeedTitle(xml: string): string {
  const channelMatch = /<channel>[\s\S]*?<title>(.*?)<\/title>/i.exec(xml)
  if (channelMatch) return channelMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim()
  const feedMatch = /<feed[^>]*>[\s\S]*?<title>(.*?)<\/title>/i.exec(xml)
  if (feedMatch) return feedMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim()
  return 'Unknown Feed'
}

function parseRssItems(xml: string): FeedItem[] {
  const items: FeedItem[] = []
  // RSS <item> elements
  const rssRegex = /<item>([\s\S]*?)<\/item>/gi
  let match: RegExpExecArray | null
  while ((match = rssRegex.exec(xml)) !== null) {
    const block = match[1]
    items.push({
      title: getTag(block, 'title'),
      link: getTag(block, 'link'),
      description: getTag(block, 'description').slice(0, 500),
    })
  }
  // Atom <entry> elements (fallback)
  if (items.length === 0) {
    const atomRegex = /<entry>([\s\S]*?)<\/entry>/gi
    while ((match = atomRegex.exec(xml)) !== null) {
      const block = match[1]
      const linkMatch = /<link[^>]*href=["']([^"']+)["']/i.exec(block)
      items.push({
        title: getTag(block, 'title'),
        link: linkMatch ? linkMatch[1] : getTag(block, 'id'),
        description: getTag(block, 'summary').slice(0, 500) || getTag(block, 'content').slice(0, 500),
      })
    }
  }
  return items
}

async function fetchFeed(url: string): Promise<{ title: string; items: FeedItem[] }> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'settlegrid-rss-parser/1.0', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
  })
  if (!res.ok) throw new Error(`Feed fetch failed ${res.status}: ${res.statusText}`)
  const xml = await res.text()
  return { title: getFeedTitle(xml), items: parseRssItems(xml) }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'rss-parser',
  pricing: {
    defaultCostCents: 1,
    methods: {
      parse_feed: { costCents: 1, displayName: 'Parse Feed' },
      get_headlines: { costCents: 1, displayName: 'Get Headlines' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const parseFeed = sg.wrap(async (args: ParseFeedInput) => {
  if (!args.url || typeof args.url !== 'string') throw new Error('url is required')
  const url = args.url.trim()
  if (!url.startsWith('http://') && !url.startsWith('https://')) throw new Error('url must start with http:// or https://')
  const feed = await fetchFeed(url)
  return { title: feed.title, count: feed.items.length, items: feed.items.slice(0, 25) }
}, { method: 'parse_feed' })

const getHeadlines = sg.wrap(async (args: GetHeadlinesInput) => {
  if (!args.url || typeof args.url !== 'string') throw new Error('url is required')
  const url = args.url.trim()
  if (!url.startsWith('http://') && !url.startsWith('https://')) throw new Error('url must start with http:// or https://')
  const max = Math.min(Math.max(typeof args.limit === 'number' ? args.limit : 10, 1), 50)
  const feed = await fetchFeed(url)
  const headlines = feed.items.slice(0, max).map(item => item.title)
  return { source: feed.title, headlines }
}, { method: 'get_headlines' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { parseFeed, getHeadlines }

console.log('settlegrid-rss-parser MCP server ready')
console.log('Methods: parse_feed, get_headlines')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
