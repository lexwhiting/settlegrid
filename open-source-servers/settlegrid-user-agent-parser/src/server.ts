/**
 * settlegrid-user-agent-parser — User Agent String Parsing MCP Server
 *
 * Parse user agent strings to extract browser, OS, and device info. All local.
 *
 * Methods:
 *   parse_user_agent(ua) — Parse a user agent string (free)
 *   detect_bot(ua) — Check if user agent is a bot (free)
 *   get_browser_list() — List known browsers (free)
 */

import { settlegrid } from '@settlegrid/mcp'

interface UAInput { ua: string }

const BROWSERS: Array<{ name: string; pattern: RegExp; versionGroup: number }> = [
  { name: 'Edge', pattern: /Edg(?:e|A|iOS)?\/(\d+[\d.]*)/, versionGroup: 1 },
  { name: 'Opera', pattern: /(?:OPR|Opera)\/(\d+[\d.]*)/, versionGroup: 1 },
  { name: 'Brave', pattern: /Brave\/(\d+[\d.]*)/, versionGroup: 1 },
  { name: 'Vivaldi', pattern: /Vivaldi\/(\d+[\d.]*)/, versionGroup: 1 },
  { name: 'Samsung Internet', pattern: /SamsungBrowser\/(\d+[\d.]*)/, versionGroup: 1 },
  { name: 'UC Browser', pattern: /UCBrowser\/(\d+[\d.]*)/, versionGroup: 1 },
  { name: 'Firefox', pattern: /Firefox\/(\d+[\d.]*)/, versionGroup: 1 },
  { name: 'Chrome', pattern: /Chrome\/(\d+[\d.]*)/, versionGroup: 1 },
  { name: 'Safari', pattern: /Version\/(\d+[\d.]*).*Safari/, versionGroup: 1 },
  { name: 'IE', pattern: /(?:MSIE |Trident.*rv:)(\d+[\d.]*)/, versionGroup: 1 },
]

const OS_PATTERNS: Array<{ name: string; pattern: RegExp; versionPattern?: RegExp }> = [
  { name: 'iOS', pattern: /iPhone|iPad|iPod/, versionPattern: /OS (\d+[_\d.]*)/ },
  { name: 'Android', pattern: /Android/, versionPattern: /Android (\d+[\d.]*)/ },
  { name: 'Windows', pattern: /Windows/, versionPattern: /Windows NT (\d+[\d.]*)/ },
  { name: 'macOS', pattern: /Macintosh/, versionPattern: /Mac OS X (\d+[_\d.]*)/ },
  { name: 'Linux', pattern: /Linux/, versionPattern: /Linux/ },
  { name: 'ChromeOS', pattern: /CrOS/ },
]

const WIN_VERSIONS: Record<string, string> = {
  '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7', '6.0': 'Vista', '5.1': 'XP',
}

const BOT_PATTERNS = [
  /bot/i, /crawl/i, /spider/i, /slurp/i, /Googlebot/i, /Bingbot/i,
  /facebookexternalhit/i, /Twitterbot/i, /LinkedInBot/i, /WhatsApp/i,
  /Slack/i, /Discordbot/i, /TelegramBot/i, /curl/i, /wget/i,
  /Python-urllib/i, /Go-http-client/i, /Java\/\d/, /libwww/i,
]

function parseBrowser(ua: string): { name: string; version: string } {
  for (const b of BROWSERS) {
    const match = ua.match(b.pattern)
    if (match) return { name: b.name, version: match[b.versionGroup] || '' }
  }
  return { name: 'Unknown', version: '' }
}

function parseOS(ua: string): { name: string; version: string } {
  for (const os of OS_PATTERNS) {
    if (os.pattern.test(ua)) {
      let version = ''
      if (os.versionPattern) {
        const match = ua.match(os.versionPattern)
        if (match) version = match[1]?.replace(/_/g, '.') || ''
      }
      if (os.name === 'Windows' && version) version = WIN_VERSIONS[version] || version
      return { name: os.name, version }
    }
  }
  return { name: 'Unknown', version: '' }
}

function parseDevice(ua: string): { type: string; mobile: boolean } {
  if (/iPad|Tablet|PlayBook/i.test(ua)) return { type: 'Tablet', mobile: true }
  if (/Mobile|iPhone|Android.*Mobile|Windows Phone/i.test(ua)) return { type: 'Mobile', mobile: true }
  if (/Smart-TV|SmartTV|SMART-TV|GoogleTV|AppleTV|webOS/i.test(ua)) return { type: 'Smart TV', mobile: false }
  return { type: 'Desktop', mobile: false }
}

const sg = settlegrid.init({
  toolSlug: 'user-agent-parser',
  pricing: {
    defaultCostCents: 0,
    methods: {
      parse_user_agent: { costCents: 0, displayName: 'Parse User Agent' },
      detect_bot: { costCents: 0, displayName: 'Detect Bot' },
      get_browser_list: { costCents: 0, displayName: 'Browser List' },
    },
  },
})

const parseUserAgent = sg.wrap(async (args: UAInput) => {
  const ua = args.ua?.trim()
  if (!ua) throw new Error('ua (user agent string) required')
  const browser = parseBrowser(ua)
  const os = parseOS(ua)
  const device = parseDevice(ua)
  const isBot = BOT_PATTERNS.some(p => p.test(ua))
  return { ua: ua.slice(0, 500), browser, os, device, isBot }
}, { method: 'parse_user_agent' })

const detectBot = sg.wrap(async (args: UAInput) => {
  const ua = args.ua?.trim()
  if (!ua) throw new Error('ua (user agent string) required')
  const isBot = BOT_PATTERNS.some(p => p.test(ua))
  const matchedPattern = BOT_PATTERNS.find(p => p.test(ua))?.source || null
  return { ua: ua.slice(0, 200), isBot, matchedPattern, confidence: isBot ? 'high' : 'low' }
}, { method: 'detect_bot' })

const getBrowserList = sg.wrap(async () => {
  return {
    browsers: BROWSERS.map(b => b.name),
    operatingSystems: OS_PATTERNS.map(o => o.name),
    botPatterns: BOT_PATTERNS.length,
  }
}, { method: 'get_browser_list' })

export { parseUserAgent, detectBot, getBrowserList }

console.log('settlegrid-user-agent-parser MCP server ready')
console.log('Methods: parse_user_agent, detect_bot, get_browser_list')
console.log('Pricing: Free (local computation) | Powered by SettleGrid')
