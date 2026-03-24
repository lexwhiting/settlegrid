/**
 * settlegrid-twitch-data — Twitch Stream Data MCP Server
 *
 * Provides Twitch stream, channel, and game data.
 * Requires free Twitch Developer credentials.
 *
 * Methods:
 *   get_top_streams(limit)           (1¢)
 *   search_channels(query)           (1¢)
 *   get_stream_by_user(username)     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface TopStreamsInput { limit?: number; game_id?: string }
interface SearchChannelsInput { query: string }
interface GetStreamInput { username: string }

const API_BASE = 'https://api.twitch.tv/helix'
const USER_AGENT = 'settlegrid-twitch-data/1.0 (contact@settlegrid.ai)'

let accessToken: string | null = null

async function getToken(): Promise<string> {
  if (accessToken) return accessToken
  const clientId = process.env.TWITCH_CLIENT_ID || ''
  const clientSecret = process.env.TWITCH_CLIENT_SECRET || ''
  if (!clientId || !clientSecret) throw new Error('TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET are required')
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
  })
  if (!res.ok) throw new Error(`Twitch auth failed: ${res.status}`)
  const data = await res.json() as { access_token: string }
  accessToken = data.access_token
  return accessToken
}

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = await getToken()
  const url = new URL(`${API_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': USER_AGENT,
      Authorization: `Bearer ${token}`,
      'Client-Id': process.env.TWITCH_CLIENT_ID || '',
    },
  })
  if (!res.ok) throw new Error(`Twitch API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'twitch-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_top_streams: { costCents: 1, displayName: 'Get top live streams' },
      search_channels: { costCents: 1, displayName: 'Search channels' },
      get_stream_by_user: { costCents: 1, displayName: 'Get stream by username' },
    },
  },
})

const getTopStreams = sg.wrap(async (args: TopStreamsInput) => {
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100)
  const params: Record<string, string> = { first: String(limit) }
  if (args.game_id) params.game_id = args.game_id
  const data = await apiFetch<Record<string, unknown>>('/streams', params)
  return data
}, { method: 'get_top_streams' })

const searchChannels = sg.wrap(async (args: SearchChannelsInput) => {
  if (!args.query) throw new Error('query is required')
  const data = await apiFetch<Record<string, unknown>>('/search/channels', { query: args.query, first: '20' })
  return { query: args.query, ...data }
}, { method: 'search_channels' })

const getStreamByUser = sg.wrap(async (args: GetStreamInput) => {
  if (!args.username) throw new Error('username is required')
  const data = await apiFetch<Record<string, unknown>>('/streams', { user_login: args.username.toLowerCase() })
  return { username: args.username, ...data }
}, { method: 'get_stream_by_user' })

export { getTopStreams, searchChannels, getStreamByUser }

console.log('settlegrid-twitch-data MCP server ready')
console.log('Methods: get_top_streams, search_channels, get_stream_by_user')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
