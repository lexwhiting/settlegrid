/**
 * settlegrid-user-agent — User Agent Parser MCP Server
 *
 * Parse user agent strings into browser, OS, and device info.
 *
 * Methods:
 *   parse_ua(ua)                  — Parse a user agent string into components  (1¢)
 *   detect_bot(ua)                — Check if a user agent is a known bot  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ParseUaInput {
  ua: string
}

interface DetectBotInput {
  ua: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BOT_PATTERNS = [
  { pattern: /googlebot/i, name: 'Googlebot' },
  { pattern: /bingbot/i, name: 'Bingbot' },
  { pattern: /slurp/i, name: 'Yahoo Slurp' },
  { pattern: /duckduckbot/i, name: 'DuckDuckBot' },
  { pattern: /baiduspider/i, name: 'Baiduspider' },
  { pattern: /yandexbot/i, name: 'YandexBot' },
  { pattern: /facebookexternalhit/i, name: 'Facebook Crawler' },
  { pattern: /twitterbot/i, name: 'Twitterbot' },
  { pattern: /linkedinbot/i, name: 'LinkedInBot' },
  { pattern: /applebot/i, name: 'Applebot' },
  { pattern: /semrushbot/i, name: 'SemrushBot' },
  { pattern: /ahrefsbot/i, name: 'AhrefsBot' },
  { pattern: /mj12bot/i, name: 'Majestic' },
  { pattern: /dotbot/i, name: 'DotBot' },
  { pattern: /chatgpt/i, name: 'ChatGPT' },
  { pattern: /claudebot/i, name: 'ClaudeBot' },
  { pattern: /gptbot/i, name: 'GPTBot' },
  { pattern: /bot|crawler|spider|scraper/i, name: 'Unknown Bot' },
]

function extractBrowser(ua: string): { name: string; version: string } {
  const tests: Array<{ re: RegExp; name: string }> = [
    { re: /Edg(?:e|A|iOS)?\/(\S+)/, name: 'Edge' },
    { re: /OPR\/(\S+)/, name: 'Opera' },
    { re: /(?:Samsung|SamsungBrowser)\/(\S+)/, name: 'Samsung Browser' },
    { re: /Chrome\/(\S+)/, name: 'Chrome' },
    { re: /Firefox\/(\S+)/, name: 'Firefox' },
    { re: /Version\/(\S+).*Safari/, name: 'Safari' },
    { re: /MSIE (\S+)/, name: 'IE' },
    { re: /Trident.*rv:(\S+)/, name: 'IE' },
  ]
  for (const { re, name } of tests) {
    const m = ua.match(re)
    if (m) return { name, version: m[1] }
  }
  return { name: 'Unknown', version: '' }
}

function extractOS(ua: string): { name: string; version: string } {
  const tests: Array<{ re: RegExp; name: string }> = [
    { re: /Windows NT (\d+\.\d+)/, name: 'Windows' },
    { re: /Mac OS X (\d+[._]\d+[._]?\d*)/, name: 'macOS' },
    { re: /Android (\d+\.?\d*)/, name: 'Android' },
    { re: /iPhone OS (\d+[._]\d+)/, name: 'iOS' },
    { re: /iPad.*OS (\d+[._]\d+)/, name: 'iPadOS' },
    { re: /Linux/, name: 'Linux' },
    { re: /CrOS/, name: 'Chrome OS' },
  ]
  for (const { re, name } of tests) {
    const m = ua.match(re)
    if (m) return { name, version: (m[1] || '').replace(/_/g, '.') }
  }
  return { name: 'Unknown', version: '' }
}

function extractDevice(ua: string): string {
  if (/Mobi|Android.*Mobile|iPhone/i.test(ua)) return 'mobile'
  if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) return 'tablet'
  return 'desktop'
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'user-agent',
  pricing: {
    defaultCostCents: 1,
    methods: {
      parse_ua: { costCents: 1, displayName: 'Parse User Agent' },
      detect_bot: { costCents: 1, displayName: 'Detect Bot' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const parseUa = sg.wrap(async (args: ParseUaInput) => {
  if (!args.ua || typeof args.ua !== 'string') throw new Error('ua is required')
  const ua = args.ua.trim()
  return {
    browser: extractBrowser(ua),
    os: extractOS(ua),
    device: extractDevice(ua),
  }
}, { method: 'parse_ua' })

const detectBot = sg.wrap(async (args: DetectBotInput) => {
  if (!args.ua || typeof args.ua !== 'string') throw new Error('ua is required')
  const ua = args.ua.trim()
  for (const { pattern, name } of BOT_PATTERNS) {
    if (pattern.test(ua)) return { isBot: true, botName: name }
  }
  return { isBot: false, botName: null }
}, { method: 'detect_bot' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { parseUa, detectBot }

console.log('settlegrid-user-agent MCP server ready')
console.log('Methods: parse_ua, detect_bot')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
