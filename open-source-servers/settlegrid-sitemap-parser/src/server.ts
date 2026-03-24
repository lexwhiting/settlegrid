/**
 * settlegrid-sitemap-parser — Sitemap XML Parser MCP Server
 *
 * Methods:
 *   get_sitemap(url)                 (1¢)
 *   get_sitemap_stats(url)           (1¢)
 *   discover_sitemaps(domain)        (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetSitemapInput { url: string; limit?: number }
interface GetSitemapStatsInput { url: string }
interface DiscoverSitemapsInput { domain: string }

const USER_AGENT = 'settlegrid-sitemap-parser/1.0 (contact@settlegrid.ai)'

function extractUrls(xml: string): { loc: string; lastmod?: string; priority?: string }[] {
  const urls: { loc: string; lastmod?: string; priority?: string }[] = []
  const locRegex = /<loc>(.*?)<\/loc>/g
  const lastmodRegex = /<lastmod>(.*?)<\/lastmod>/g
  const priorityRegex = /<priority>(.*?)<\/priority>/g
  let match
  const locs: string[] = []
  const lastmods: string[] = []
  const priorities: string[] = []
  while ((match = locRegex.exec(xml)) !== null) locs.push(match[1])
  while ((match = lastmodRegex.exec(xml)) !== null) lastmods.push(match[1])
  while ((match = priorityRegex.exec(xml)) !== null) priorities.push(match[1])
  for (let i = 0; i < locs.length; i++) {
    urls.push({ loc: locs[i], lastmod: lastmods[i], priority: priorities[i] })
  }
  return urls
}

const sg = settlegrid.init({
  toolSlug: 'sitemap-parser',
  pricing: { defaultCostCents: 1, methods: {
    get_sitemap: { costCents: 1, displayName: 'Parse sitemap XML' },
    get_sitemap_stats: { costCents: 1, displayName: 'Get sitemap statistics' },
    discover_sitemaps: { costCents: 1, displayName: 'Discover sitemaps from robots.txt' },
  }},
})

const getSitemap = sg.wrap(async (args: GetSitemapInput) => {
  if (!args.url) throw new Error('url is required (sitemap URL)')
  let url = args.url
  if (!url.startsWith('http')) url = `https://${url}`
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
  const xml = await res.text()
  const urls = extractUrls(xml)
  const limit = Math.min(Math.max(args.limit ?? 50, 1), 200)
  return { url, total_urls: urls.length, urls: urls.slice(0, limit) }
}, { method: 'get_sitemap' })

const getSitemapStats = sg.wrap(async (args: GetSitemapStatsInput) => {
  if (!args.url) throw new Error('url is required')
  let url = args.url
  if (!url.startsWith('http')) url = `https://${url}`
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
  const xml = await res.text()
  const urls = extractUrls(xml)
  const isSitemapIndex = xml.includes('<sitemapindex')
  const domains = new Set(urls.map(u => { try { return new URL(u.loc).hostname } catch { return 'unknown' } }))
  return {
    url,
    type: isSitemapIndex ? 'sitemap_index' : 'sitemap',
    total_entries: urls.length,
    unique_domains: [...domains],
    size_bytes: xml.length,
  }
}, { method: 'get_sitemap_stats' })

const discoverSitemaps = sg.wrap(async (args: DiscoverSitemapsInput) => {
  if (!args.domain) throw new Error('domain is required')
  const domain = args.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const sitemaps: string[] = []
  try {
    const robotsRes = await fetch(`https://${domain}/robots.txt`, { headers: { 'User-Agent': USER_AGENT } })
    if (robotsRes.ok) {
      const text = await robotsRes.text()
      for (const line of text.split('\n')) {
        if (line.toLowerCase().trim().startsWith('sitemap:')) {
          sitemaps.push(line.split(':').slice(1).join(':').trim())
        }
      }
    }
  } catch { /* no robots.txt */ }
  const defaultPaths = ['/sitemap.xml', '/sitemap_index.xml', '/sitemap-index.xml']
  for (const path of defaultPaths) {
    if (!sitemaps.some(s => s.includes(path))) {
      try {
        const res = await fetch(`https://${domain}${path}`, { method: 'HEAD', headers: { 'User-Agent': USER_AGENT } })
        if (res.ok) sitemaps.push(`https://${domain}${path}`)
      } catch { /* skip */ }
    }
  }
  return { domain, count: sitemaps.length, sitemaps }
}, { method: 'discover_sitemaps' })

export { getSitemap, getSitemapStats, discoverSitemaps }

console.log('settlegrid-sitemap-parser MCP server ready')
console.log('Methods: get_sitemap, get_sitemap_stats, discover_sitemaps')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
