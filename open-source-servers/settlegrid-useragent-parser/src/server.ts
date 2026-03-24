/**
 * settlegrid-useragent-parser — User Agent Parser MCP Server
 *
 * Parses user agent strings locally with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   parse_useragent(ua) — parse user agent (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ParseInput { ua: string }

const sg = settlegrid.init({
  toolSlug: 'useragent-parser',
  pricing: {
    defaultCostCents: 1,
    methods: {
      parse_useragent: { costCents: 1, displayName: 'Parse User Agent' },
    },
  },
})

function detectBrowser(ua: string) {
  if (ua.includes('Firefox/')) return { name: 'Firefox', version: ua.match(/Firefox\/(\S+)/)?.[1] || '' }
  if (ua.includes('Edg/')) return { name: 'Edge', version: ua.match(/Edg\/(\S+)/)?.[1] || '' }
  if (ua.includes('Chrome/')) return { name: 'Chrome', version: ua.match(/Chrome\/(\S+)/)?.[1] || '' }
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return { name: 'Safari', version: ua.match(/Version\/(\S+)/)?.[1] || '' }
  if (ua.includes('MSIE') || ua.includes('Trident')) return { name: 'IE', version: ua.match(/(?:MSIE |rv:)(\S+)/)?.[1] || '' }
  return { name: 'Unknown', version: '' }
}

function detectOS(ua: string) {
  if (ua.includes('Windows NT 10')) return { name: 'Windows', version: '10/11' }
  if (ua.includes('Windows NT')) return { name: 'Windows', version: ua.match(/Windows NT (\S+)/)?.[1] || '' }
  if (ua.includes('Mac OS X')) return { name: 'macOS', version: ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, '.') || '' }
  if (ua.includes('Android')) return { name: 'Android', version: ua.match(/Android ([\d.]+)/)?.[1] || '' }
  if (ua.includes('iPhone') || ua.includes('iPad')) return { name: 'iOS', version: ua.match(/OS ([\d_]+)/)?.[1]?.replace(/_/g, '.') || '' }
  if (ua.includes('Linux')) return { name: 'Linux', version: '' }
  return { name: 'Unknown', version: '' }
}

function detectDevice(ua: string) {
  if (ua.includes('Mobile') || ua.includes('Android') && !ua.includes('Tablet')) return 'mobile'
  if (ua.includes('Tablet') || ua.includes('iPad')) return 'tablet'
  if (ua.includes('Bot') || ua.includes('bot') || ua.includes('Crawler')) return 'bot'
  return 'desktop'
}

const parseUseragent = sg.wrap(async (args: ParseInput) => {
  if (!args.ua) throw new Error('ua is required')
  const browser = detectBrowser(args.ua)
  const os = detectOS(args.ua)
  const device = detectDevice(args.ua)
  return {
    raw: args.ua, browser, os, device,
    is_mobile: device === 'mobile',
    is_bot: device === 'bot',
    length: args.ua.length,
  }
}, { method: 'parse_useragent' })

export { parseUseragent }

console.log('settlegrid-useragent-parser MCP server ready')
console.log('Methods: parse_useragent')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
