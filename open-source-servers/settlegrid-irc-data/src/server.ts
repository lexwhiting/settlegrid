/**
 * settlegrid-irc-data — IRC Protocol Reference MCP Server
 *
 * Provides IRC protocol commands, formatting codes, and network information.
 * All data stored locally.
 *
 * Methods:
 *   get_command(name)             — Get IRC command details          (1c)
 *   format_message(text, options) — Format with IRC codes            (1c)
 *   list_networks()               — List IRC networks               (1c)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetCommandInput { name: string }
interface FormatInput { text: string; bold?: boolean; italic?: boolean; underline?: boolean; color?: number; bg_color?: number }

const COMMANDS: Record<string, { syntax: string; description: string; example: string }> = {
  join: { syntax: 'JOIN #channel [key]', description: 'Join a channel', example: 'JOIN #programming' },
  part: { syntax: 'PART #channel [message]', description: 'Leave a channel', example: 'PART #programming :Goodbye!' },
  privmsg: { syntax: 'PRIVMSG target :message', description: 'Send a message', example: 'PRIVMSG #chat :Hello everyone' },
  nick: { syntax: 'NICK newnick', description: 'Change your nickname', example: 'NICK cooluser' },
  quit: { syntax: 'QUIT [:message]', description: 'Disconnect from server', example: 'QUIT :See you later' },
  kick: { syntax: 'KICK #channel user [:reason]', description: 'Kick a user', example: 'KICK #chat baduser :Spamming' },
  mode: { syntax: 'MODE target [+/-modes] [params]', description: 'Set channel/user modes', example: 'MODE #chat +o username' },
  topic: { syntax: 'TOPIC #channel [:new topic]', description: 'View or set channel topic', example: 'TOPIC #chat :Welcome!' },
  whois: { syntax: 'WHOIS nickname', description: 'Get user information', example: 'WHOIS cooluser' },
  list: { syntax: 'LIST [#channel] [server]', description: 'List channels', example: 'LIST' },
  invite: { syntax: 'INVITE nickname #channel', description: 'Invite user to channel', example: 'INVITE friend #secret' },
  notice: { syntax: 'NOTICE target :message', description: 'Send a notice (no auto-reply)', example: 'NOTICE user :Important info' },
}

const IRC_COLORS: Record<number, string> = { 0: 'white', 1: 'black', 2: 'blue', 3: 'green', 4: 'red', 5: 'brown', 6: 'purple', 7: 'orange', 8: 'yellow', 9: 'light green', 10: 'cyan', 11: 'light cyan', 12: 'light blue', 13: 'pink', 14: 'grey', 15: 'light grey' }

const NETWORKS = [
  { name: 'Libera.Chat', server: 'irc.libera.chat', ports: '6667, 6697 (TLS)', users: 40000, description: 'Successor to Freenode, FOSS community' },
  { name: 'OFTC', server: 'irc.oftc.net', ports: '6667, 6697 (TLS)', users: 15000, description: 'Open and Free Technology Community' },
  { name: 'EFnet', server: 'irc.efnet.org', ports: '6667', users: 12000, description: 'One of the oldest IRC networks' },
  { name: 'DALnet', server: 'irc.dal.net', ports: '6667, 6697 (TLS)', users: 8000, description: 'General purpose network' },
  { name: 'Rizon', server: 'irc.rizon.net', ports: '6667, 6697 (TLS)', users: 20000, description: 'Anime and tech community' },
]

const sg = settlegrid.init({
  toolSlug: 'irc-data',
  pricing: { defaultCostCents: 1, methods: {
    get_command: { costCents: 1, displayName: 'Get IRC Command' },
    format_message: { costCents: 1, displayName: 'Format IRC Message' },
    list_networks: { costCents: 1, displayName: 'List Networks' },
  }},
})

const getCommand = sg.wrap(async (args: GetCommandInput) => {
  if (!args.name) throw new Error('command name required')
  const cmd = COMMANDS[args.name.toLowerCase()]
  if (!cmd) throw new Error(`Unknown command. Available: ${Object.keys(COMMANDS).join(', ')}`)
  return { command: args.name.toUpperCase(), ...cmd }
}, { method: 'get_command' })

const formatMessage = sg.wrap(async (args: FormatInput) => {
  if (!args.text) throw new Error('text required')
  let formatted = args.text
  if (args.bold) formatted = `\x02${formatted}\x02`
  if (args.italic) formatted = `\x1D${formatted}\x1D`
  if (args.underline) formatted = `\x1F${formatted}\x1F`
  if (args.color !== undefined) {
    const fg = String(args.color).padStart(2, '0')
    const bg = args.bg_color !== undefined ? `,${String(args.bg_color).padStart(2, '0')}` : ''
    formatted = `\x03${fg}${bg}${formatted}\x03`
  }
  return { original: args.text, formatted, irc_codes_used: true, available_colors: IRC_COLORS }
}, { method: 'format_message' })

const listNetworks = sg.wrap(async (_a: Record<string, never>) => {
  return { networks: NETWORKS, count: NETWORKS.length }
}, { method: 'list_networks' })

export { getCommand, formatMessage, listNetworks }
console.log('settlegrid-irc-data MCP server ready')
console.log('Methods: get_command, format_message, list_networks')
console.log('Pricing: 1c per call | Powered by SettleGrid')
