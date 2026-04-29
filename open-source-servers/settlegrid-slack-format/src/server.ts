/**
 * settlegrid-slack-format — Slack Message Formatter MCP Server
 *
 * Slack Message Formatter tools with SettleGrid billing.
 * Pricing: 1-3c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

interface FormatInput { text: string; bold?: boolean; italic?: boolean; code?: boolean; strikethrough?: boolean; quote?: boolean }
interface BlockInput { type: string; text?: string; fields?: Array<{ label: string; value: string }> }

const sg = settlegrid.init({ toolSlug: 'slack-format', pricing: { defaultCostCents: 1, methods: {
  format_message: { costCents: 1, displayName: 'Format Message' },
  create_block: { costCents: 1, displayName: 'Create Block Kit' },
  list_emoji: { costCents: 1, displayName: 'List Common Emoji' },
}}})

const formatMessage = sg.wrap(async (args: FormatInput) => {
  if (!args.text) throw new Error('text required')
  let f = args.text
  if (args.bold) f = `*${f}*`
  if (args.italic) f = `_${f}_`
  if (args.code) f = '`' + f + '`'
  if (args.strikethrough) f = `~${f}~`
  if (args.quote) f = f.split('\n').map(l => `> ${l}`).join('\n')
  return { original: args.text, formatted: f, char_count: f.length, within_limit: f.length <= 40000 }
}, { method: 'format_message' })

const createBlock = sg.wrap(async (args: BlockInput) => {
  if (!args.type) throw new Error('type required (section, header, divider, actions)')
  const blocks: Record<string, unknown>[] = []
  if (args.type === 'header') blocks.push({ type: 'header', text: { type: 'plain_text', text: args.text ?? 'Header' } })
  else if (args.type === 'divider') blocks.push({ type: 'divider' })
  else if (args.type === 'section' && args.fields) blocks.push({ type: 'section', fields: args.fields.map(f => ({ type: 'mrkdwn', text: `*${f.label}*\n${f.value}` })) })
  else blocks.push({ type: 'section', text: { type: 'mrkdwn', text: args.text ?? '' } })
  return { blocks, json: JSON.stringify({ blocks }, null, 2) }
}, { method: 'create_block' })

const COMMON_EMOJI = [':thumbsup:',':thumbsdown:',':white_check_mark:',':x:',':rocket:',':fire:',':tada:',':warning:',':bulb:',':eyes:',':pray:',':heart:',':star:',':100:',':rotating_light:',':memo:']

const listEmoji = sg.wrap(async (_a: Record<string, never>) => {
  return { emoji: COMMON_EMOJI, count: COMMON_EMOJI.length, note: 'These are standard Slack emoji shortcodes' }
}, { method: 'list_emoji' })

export { formatMessage, createBlock, listEmoji }
console.log('settlegrid-slack-format MCP server ready | Powered by SettleGrid')
