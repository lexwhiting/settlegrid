/**
 * settlegrid-matrix-chat — Matrix Protocol Tools MCP Server
 *
 * Provides Matrix chat protocol formatting, room alias resolution,
 * and message formatting utilities.
 *
 * Methods:
 *   format_message(text, format?)  — Format Matrix message           (1c)
 *   parse_matrix_id(id)            — Parse Matrix identifier        (1c)
 *   get_homeservers()              — List public homeservers        (1c)
 */

import { settlegrid } from '@settlegrid/mcp'

interface FormatInput { text: string; format?: string }
interface ParseIdInput { id: string }

const HOMESERVERS = [
  { name: 'matrix.org', url: 'https://matrix.org', registration: 'open', description: 'Official Matrix.org server' },
  { name: 'envs.net', url: 'https://matrix.envs.net', registration: 'open', description: 'Community server' },
  { name: 'tchncs.de', url: 'https://tchncs.de', registration: 'open', description: 'German community server' },
  { name: 'nitro.chat', url: 'https://nitro.chat', registration: 'open', description: 'Privacy-focused server' },
]

const sg = settlegrid.init({
  toolSlug: 'matrix-chat',
  pricing: { defaultCostCents: 1, methods: {
    format_message: { costCents: 1, displayName: 'Format Message' },
    parse_matrix_id: { costCents: 1, displayName: 'Parse Matrix ID' },
    get_homeservers: { costCents: 1, displayName: 'Get Homeservers' },
  }},
})

const formatMessage = sg.wrap(async (args: FormatInput) => {
  if (!args.text) throw new Error('text required')
  const fmt = (args.format ?? 'markdown').toLowerCase()
  let html = args.text
  if (fmt === 'html') {
    html = args.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/`(.*?)`/g, '<code>$1</code>').replace(/\n/g, '<br/>')
  }
  return { original: args.text, formatted: html, format: fmt, msgtype: 'm.text', body: args.text, formatted_body: html }
}, { method: 'format_message' })

const parseMatrixId = sg.wrap(async (args: ParseIdInput) => {
  if (!args.id) throw new Error('id required (e.g. @user:matrix.org or #room:matrix.org)')
  const sigil = args.id[0]
  const types: Record<string, string> = { '@': 'user', '#': 'room_alias', '!': 'room_id', '+': 'community', '$': 'event' }
  const type = types[sigil] ?? 'unknown'
  const parts = args.id.slice(1).split(':')
  return { id: args.id, type, localpart: parts[0] ?? '', server: parts[1] ?? '', valid: parts.length === 2 && !!parts[0] && !!parts[1] }
}, { method: 'parse_matrix_id' })

const getHomeservers = sg.wrap(async (_a: Record<string, never>) => {
  return { homeservers: HOMESERVERS, count: HOMESERVERS.length, protocol_version: 'Matrix v1.8' }
}, { method: 'get_homeservers' })

export { formatMessage, parseMatrixId, getHomeservers }
console.log('settlegrid-matrix-chat MCP server ready')
console.log('Pricing: 1c per call | Powered by SettleGrid')
