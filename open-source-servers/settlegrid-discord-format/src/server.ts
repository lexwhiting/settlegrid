/**
 * settlegrid-discord-format — Discord Message Formatter MCP Server
 *
 * Formats text with Discord markdown, generates embed structures,
 * and provides Discord timestamp formatting.
 *
 * Methods:
 *   format_message(text, options)  — Format with Discord markdown    (1c)
 *   create_embed(fields)           — Create embed JSON structure     (1c)
 *   format_timestamp(date, style?) — Format Discord timestamp        (1c)
 */

import { settlegrid } from '@settlegrid/mcp'

interface FormatInput { text: string; bold?: boolean; italic?: boolean; code?: boolean; spoiler?: boolean; quote?: boolean }
interface EmbedInput { title: string; description?: string; color?: number; fields?: Array<{ name: string; value: string; inline?: boolean }>; footer?: string; url?: string; thumbnail?: string }
interface TimestampInput { date: string; style?: string }

const TIMESTAMP_STYLES: Record<string, { flag: string; example: string; description: string }> = {
  short_time: { flag: 't', example: '16:20', description: 'Short time' },
  long_time: { flag: 'T', example: '16:20:30', description: 'Long time' },
  short_date: { flag: 'd', example: '20/04/2021', description: 'Short date' },
  long_date: { flag: 'D', example: '20 April 2021', description: 'Long date' },
  short_datetime: { flag: 'f', example: '20 April 2021 16:20', description: 'Short date/time (default)' },
  long_datetime: { flag: 'F', example: 'Tuesday, 20 April 2021 16:20', description: 'Long date/time' },
  relative: { flag: 'R', example: '2 months ago', description: 'Relative time' },
}

const sg = settlegrid.init({
  toolSlug: 'discord-format',
  pricing: { defaultCostCents: 1, methods: {
    format_message: { costCents: 1, displayName: 'Format Message' },
    create_embed: { costCents: 1, displayName: 'Create Embed' },
    format_timestamp: { costCents: 1, displayName: 'Format Timestamp' },
  }},
})

const formatMessage = sg.wrap(async (args: FormatInput) => {
  if (!args.text) throw new Error('text required')
  let formatted = args.text
  if (args.bold) formatted = `**${formatted}**`
  if (args.italic) formatted = `*${formatted}*`
  if (args.code) formatted = `\`${formatted}\``
  if (args.spoiler) formatted = `||${formatted}||`
  if (args.quote) formatted = formatted.split('\n').map(l => `> ${l}`).join('\n')
  return { original: args.text, formatted, char_count: formatted.length, within_limit: formatted.length <= 2000 }
}, { method: 'format_message' })

const createEmbed = sg.wrap(async (args: EmbedInput) => {
  if (!args.title) throw new Error('title required')
  const embed: Record<string, unknown> = {
    title: args.title.slice(0, 256),
    type: 'rich',
  }
  if (args.description) embed.description = args.description.slice(0, 4096)
  if (args.color) embed.color = args.color
  if (args.url) embed.url = args.url
  if (args.thumbnail) embed.thumbnail = { url: args.thumbnail }
  if (args.footer) embed.footer = { text: args.footer.slice(0, 2048) }
  if (args.fields?.length) {
    embed.fields = args.fields.slice(0, 25).map(f => ({
      name: f.name.slice(0, 256),
      value: f.value.slice(0, 1024),
      inline: f.inline ?? false,
    }))
  }
  embed.timestamp = new Date().toISOString()
  return { embed, json: JSON.stringify(embed, null, 2) }
}, { method: 'create_embed' })

const formatTimestamp = sg.wrap(async (args: TimestampInput) => {
  if (!args.date) throw new Error('date required (ISO 8601 or YYYY-MM-DD)')
  const d = new Date(args.date)
  if (isNaN(d.getTime())) throw new Error('Invalid date')
  const unix = Math.floor(d.getTime() / 1000)
  const style = args.style ?? 'short_datetime'
  const info = TIMESTAMP_STYLES[style]
  if (!info) throw new Error(`Unknown style. Available: ${Object.keys(TIMESTAMP_STYLES).join(', ')}`)
  return {
    date: args.date,
    unix_timestamp: unix,
    discord_format: `<t:${unix}:${info.flag}>`,
    style,
    description: info.description,
    example_output: info.example,
    all_formats: Object.entries(TIMESTAMP_STYLES).map(([k, v]) => ({ style: k, format: `<t:${unix}:${v.flag}>`, description: v.description })),
  }
}, { method: 'format_timestamp' })

export { formatMessage, createEmbed, formatTimestamp }
console.log('settlegrid-discord-format MCP server ready')
console.log('Methods: format_message, create_embed, format_timestamp')
console.log('Pricing: 1c per call | Powered by SettleGrid')
