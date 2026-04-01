/**
 * settlegrid-telegram-tools — Telegram Message Tools MCP Server
 *
 * Telegram Message Tools tools with SettleGrid billing.
 * Pricing: 1-3c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

interface FormatInput { text: string; format?: string }
interface ParseLinkInput { url: string }

const sg = settlegrid.init({ toolSlug: 'telegram-tools', pricing: { defaultCostCents: 1, methods: {
  format_message: { costCents: 1, displayName: 'Format Message' },
  parse_deep_link: { costCents: 1, displayName: 'Parse Deep Link' },
  get_limits: { costCents: 1, displayName: 'Get Telegram Limits' },
}}})

const formatMessage = sg.wrap(async (args: FormatInput) => {
  if (!args.text) throw new Error('text required')
  const fmt = (args.format ?? 'markdown').toLowerCase()
  let formatted = args.text
  if (fmt === 'html') formatted = args.text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\*(.*?)\*/g, '<i>$1</i>').replace(/`(.*?)`/g, '<code>$1</code>').replace(/~~(.*?)~~/g, '<s>$1</s>')
  return { original: args.text, formatted, format: fmt, char_count: formatted.length, within_limit: formatted.length <= 4096 }
}, { method: 'format_message' })

const parseDeepLink = sg.wrap(async (args: ParseLinkInput) => {
  if (!args.url) throw new Error('url required')
  const patterns: Record<string, RegExp> = { username: /t\.me\/([a-zA-Z0-9_]+)$/, message: /t\.me\/([a-zA-Z0-9_]+)\/(\d+)/, invite: /t\.me\/\+([a-zA-Z0-9_-]+)/, start: /t\.me\/([a-zA-Z0-9_]+)\?start=(.+)/, sticker_set: /t\.me\/addstickers\/(.+)/ }
  for (const [type, regex] of Object.entries(patterns)) { const match = regex.exec(args.url); if (match) return { url: args.url, type, parsed: { primary: match[1], secondary: match[2] ?? null } } }
  return { url: args.url, type: 'unknown', parsed: null }
}, { method: 'parse_deep_link' })

const getLimits = sg.wrap(async (_a: Record<string, never>) => {
  return { limits: { message_length: 4096, caption_length: 1024, file_size_mb: 2000, photo_size_mb: 10, username_min: 5, username_max: 32, group_members: 200000, channel_members: 'unlimited', inline_results: 50, poll_options: 10, sticker_set_size: 120 } }
}, { method: 'get_limits' })

export { formatMessage, parseDeepLink, getLimits }
console.log('settlegrid-telegram-tools MCP server ready | Powered by SettleGrid')
