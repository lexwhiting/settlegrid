/**
 * settlegrid-url-tools — URL Tools MCP Server
 *
 * Parses and encodes URLs locally with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   parse_url(url) — parse URL (1¢)
 *   encode_url(text) — encode URL (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface UrlInput { url: string }
interface EncodeInput { text: string }

const sg = settlegrid.init({
  toolSlug: 'url-tools',
  pricing: { defaultCostCents: 1, methods: { parse_url: { costCents: 1, displayName: 'Parse URL' }, encode_url: { costCents: 1, displayName: 'Encode URL' } } },
})

const parseUrl = sg.wrap(async (args: UrlInput) => {
  if (!args.url) throw new Error('url is required')
  try {
    const u = new URL(args.url)
    const params: Record<string, string> = {}
    u.searchParams.forEach((v, k) => { params[k] = v })
    return {
      valid: true, protocol: u.protocol, hostname: u.hostname, port: u.port || null,
      pathname: u.pathname, search: u.search, hash: u.hash,
      origin: u.origin, params, host: u.host,
    }
  } catch {
    return { valid: false, error: 'Invalid URL format', input: args.url }
  }
}, { method: 'parse_url' })

const encodeUrl = sg.wrap(async (args: EncodeInput) => {
  if (!args.text && args.text !== '') throw new Error('text is required')
  return {
    original: args.text,
    encoded: encodeURIComponent(args.text),
    encoded_full: encodeURI(args.text),
  }
}, { method: 'encode_url' })

export { parseUrl, encodeUrl }

console.log('settlegrid-url-tools MCP server ready')
console.log('Methods: parse_url, encode_url')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
