/**
 * settlegrid-company-logo — Company Logo Finder MCP Server
 *
 * Methods:
 *   get_logo(domain)                 (1¢)
 *   get_logo_url(domain, size)       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetLogoInput { domain: string; size?: number; format?: string }

const USER_AGENT = 'settlegrid-company-logo/1.0 (contact@settlegrid.ai)'

const sg = settlegrid.init({
  toolSlug: 'company-logo',
  pricing: { defaultCostCents: 1, methods: {
    get_logo: { costCents: 1, displayName: 'Get company logo' },
    get_logo_url: { costCents: 1, displayName: 'Get logo URL' },
  }},
})

const getLogo = sg.wrap(async (args: GetLogoInput) => {
  if (!args.domain) throw new Error('domain is required (e.g. google.com)')
  const domain = args.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const size = args.size || 128
  const format = args.format || 'png'
  const url = `https://logo.clearbit.com/${encodeURIComponent(domain)}?size=${size}&format=${format}`
  const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': USER_AGENT } })
  return {
    domain,
    logo_url: url,
    available: res.ok,
    size,
    format,
  }
}, { method: 'get_logo' })

const getLogoUrl = sg.wrap(async (args: GetLogoInput) => {
  if (!args.domain) throw new Error('domain is required')
  const domain = args.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const size = args.size || 128
  return {
    domain,
    urls: {
      small: `https://logo.clearbit.com/${domain}?size=64`,
      medium: `https://logo.clearbit.com/${domain}?size=128`,
      large: `https://logo.clearbit.com/${domain}?size=256`,
      custom: `https://logo.clearbit.com/${domain}?size=${size}`,
    },
  }
}, { method: 'get_logo_url' })

export { getLogo, getLogoUrl }

console.log('settlegrid-company-logo MCP server ready')
console.log('Methods: get_logo, get_logo_url')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
