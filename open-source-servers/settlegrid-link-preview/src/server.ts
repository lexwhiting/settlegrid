/**
 * settlegrid-link-preview — URL Link Preview MCP Server
 *
 * Direct HTML fetching + OpenGraph parsing — no external API needed.
 *
 * Methods:
 *   preview(url)             — Get link preview card data    (2¢)
 *   extract_metadata(url)    — Extract all meta tags         (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface UrlInput {
  url: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function validateUrl(url: unknown): string {
  if (!url || typeof url !== 'string') throw new Error('url is required')
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http/https URLs')
    return parsed.href
  } catch {
    throw new Error('Invalid URL format')
  }
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'settlegrid-link-preview/1.0 (bot)',
      Accept: 'text/html',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`)
  const text = await res.text()
  // Only parse the head section to save memory
  return text.slice(0, 100000)
}

function extractMeta(html: string, property: string): string {
  // Check og: and twitter: meta tags
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${property}["']`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match) return match[1]
  }
  return ''
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match ? match[1].trim() : ''
}

function extractAllMeta(html: string): Array<{ name: string; content: string }> {
  const metas: Array<{ name: string; content: string }> = []
  const regex = /<meta[^>]+>/gi
  let match: RegExpExecArray | null
  while ((match = regex.exec(html)) !== null && metas.length < 50) {
    const tag = match[0]
    const name = tag.match(/(?:property|name)=["']([^"']*)["']/i)?.[1]
    const content = tag.match(/content=["']([^"']*)["']/i)?.[1]
    if (name && content) {
      metas.push({ name, content: content.slice(0, 500) })
    }
  }
  return metas
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'link-preview',
  pricing: {
    defaultCostCents: 2,
    methods: {
      preview: { costCents: 2, displayName: 'Link Preview' },
      extract_metadata: { costCents: 2, displayName: 'Extract Metadata' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const preview = sg.wrap(async (args: UrlInput) => {
  const url = validateUrl(args.url)
  const html = await fetchHtml(url)

  const title = extractMeta(html, 'og:title') || extractTitle(html)
  const description = extractMeta(html, 'og:description') || extractMeta(html, 'description')
  const image = extractMeta(html, 'og:image')
  const siteName = extractMeta(html, 'og:site_name')
  const type = extractMeta(html, 'og:type')
  const favicon = extractMeta(html, 'icon') || '/favicon.ico'

  const domain = new URL(url).hostname

  return {
    url,
    domain,
    title: title.slice(0, 200) || null,
    description: description.slice(0, 500) || null,
    image: image || null,
    siteName: siteName || null,
    type: type || null,
    favicon: favicon.startsWith('http') ? favicon : `https://${domain}${favicon}`,
  }
}, { method: 'preview' })

const extractMetadata = sg.wrap(async (args: UrlInput) => {
  const url = validateUrl(args.url)
  const html = await fetchHtml(url)

  const metas = extractAllMeta(html)
  const title = extractTitle(html)
  const domain = new URL(url).hostname

  // Group by type
  const og = metas.filter((m) => m.name.startsWith('og:'))
  const twitter = metas.filter((m) => m.name.startsWith('twitter:'))
  const standard = metas.filter((m) => !m.name.startsWith('og:') && !m.name.startsWith('twitter:'))

  return {
    url,
    domain,
    title,
    metaCount: metas.length,
    openGraph: og,
    twitter,
    standard,
  }
}, { method: 'extract_metadata' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { preview, extractMetadata }

console.log('settlegrid-link-preview MCP server ready')
console.log('Methods: preview, extract_metadata')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
