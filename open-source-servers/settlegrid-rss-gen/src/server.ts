/**
 * settlegrid-rss-gen — RSS Feed Generator MCP Server
 *
 * RSS Feed Generator tools with SettleGrid billing.
 * Pricing: 1-3c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

interface GenerateInput { title: string; link: string; description: string; items: Array<{ title: string; link: string; description: string; pubDate?: string }> }
interface ValidateInput { url: string }

const sg = settlegrid.init({ toolSlug: 'rss-gen', pricing: { defaultCostCents: 1, methods: {
  generate_feed: { costCents: 1, displayName: 'Generate RSS Feed' },
  validate_url: { costCents: 1, displayName: 'Validate Feed URL' },
}}})

const generateFeed = sg.wrap(async (args: GenerateInput) => {
  if (!args.title || !args.link || !args.items?.length) throw new Error('title, link, and items required')
  const itemsXml = args.items.slice(0, 50).map(i => `    <item>
      <title><![CDATA[${i.title}]]></title>
      <link>${i.link}</link>
      <description><![CDATA[${i.description}]]></description>
      <pubDate>${i.pubDate ?? new Date().toUTCString()}</pubDate>
    </item>`).join('\n')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title><![CDATA[${args.title}]]></title>
    <link>${args.link}</link>
    <description><![CDATA[${args.description}]]></description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>settlegrid-rss-gen</generator>
${itemsXml}
  </channel>
</rss>`
  return { xml, items: args.items.length, bytes: xml.length }
}, { method: 'generate_feed' })

const validateUrl = sg.wrap(async (args: ValidateInput) => {
  if (!args.url) throw new Error('url required')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(args.url, { signal: controller.signal, headers: { Accept: 'application/rss+xml, application/xml, text/xml' } })
    const text = await res.text()
    const isRss = text.includes('<rss') || text.includes('<feed')
    return { url: args.url, status: res.status, is_feed: isRss, content_type: res.headers.get('content-type') ?? 'unknown', size_bytes: text.length }
  } catch { return { url: args.url, valid: false, error: 'Could not fetch URL' } }
  finally { clearTimeout(timeout) }
}, { method: 'validate_url' })

export { generateFeed, validateUrl }
console.log('settlegrid-rss-gen MCP server ready | Powered by SettleGrid')
