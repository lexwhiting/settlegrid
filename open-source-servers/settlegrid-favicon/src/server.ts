/**
 * settlegrid-favicon — Website Favicon Extraction MCP Server
 *
 * Extract favicon URLs from any website. No API key needed.
 *
 * Methods:
 *   get_favicon(domain, size?) — Get favicon URL for a domain (1¢)
 *   get_favicons_bulk(domains) — Bulk favicon extraction (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface FaviconInput { domain: string; size?: number }
interface BulkInput { domains: string[] }

function cleanDomain(input: string): string {
  let d = input.trim().toLowerCase()
  d = d.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '')
  return d
}

const sg = settlegrid.init({
  toolSlug: 'favicon',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_favicon: { costCents: 1, displayName: 'Get Favicon' },
      get_favicons_bulk: { costCents: 2, displayName: 'Bulk Favicons' },
    },
  },
})

const getFavicon = sg.wrap(async (args: FaviconInput) => {
  const domain = cleanDomain(args.domain || '')
  if (!domain) throw new Error('domain required')
  const size = args.size || 64
  return {
    domain,
    google: `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`,
    duckduckgo: `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    iconHorse: `https://icon.horse/icon/${domain}`,
    faviconKit: `https://api.faviconkit.com/${domain}/${size}`,
    fallback: `https://${domain}/favicon.ico`,
    appleTouchIcon: `https://${domain}/apple-touch-icon.png`,
    sizes: {
      small: `https://www.google.com/s2/favicons?domain=${domain}&sz=16`,
      medium: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
      large: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
      xlarge: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    },
  }
}, { method: 'get_favicon' })

const getFaviconsBulk = sg.wrap(async (args: BulkInput) => {
  if (!Array.isArray(args.domains) || args.domains.length === 0) throw new Error('domains array required')
  if (args.domains.length > 50) throw new Error('Maximum 50 domains')
  const results = args.domains.map((d) => {
    const domain = cleanDomain(d)
    return {
      domain,
      google: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
      duckduckgo: `https://icons.duckduckgo.com/ip3/${domain}.ico`,
      iconHorse: `https://icon.horse/icon/${domain}`,
    }
  })
  return { count: results.length, favicons: results }
}, { method: 'get_favicons_bulk' })

export { getFavicon, getFaviconsBulk }

console.log('settlegrid-favicon MCP server ready')
console.log('Methods: get_favicon, get_favicons_bulk')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
