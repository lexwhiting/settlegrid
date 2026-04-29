/**
 * settlegrid-hyperbrowser — Hyperbrowser Browser Sessions MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface CreateSessionInput {
  region?: string
  proxy?: string
  adblock?: boolean
  trackers?: boolean
}

interface GetSessionInput {
  sessionId: string
}

interface StopSessionInput {
  sessionId: string
}

interface ListSessionsInput {
  limit?: number
}

const BASE = 'https://hyperbrowser.ai/api'

function getApiKey(): string {
  const k = process.env.HYPERBROWSER_API_KEY
  if (!k) throw new Error('HYPERBROWSER_API_KEY environment variable is required')
  return k
}

async function apiFetch(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const apiKey = getApiKey()
  const fetchOptions: RequestInit = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'User-Agent': 'settlegrid-hyperbrowser/1.0',
    },
  }
  if (options.body !== undefined) {
    fetchOptions.body = JSON.stringify(options.body)
  }
  const res = await fetch(`${BASE}${path}`, fetchOptions)
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Hyperbrowser API ${res.status}: ${errText.slice(0, 200)}`)
  }
  return res.json()
}

const sg = settlegrid.init({
  toolSlug: 'hyperbrowser',
  pricing: {
    defaultCostCents: 2,
    methods: {
      create_session: { costCents: 5, displayName: 'Create Session' },
      get_session: { costCents: 1, displayName: 'Get Session' },
      stop_session: { costCents: 2, displayName: 'Stop Session' },
      list_sessions: { costCents: 1, displayName: 'List Sessions' },
    },
  },
})

const createSession = sg.wrap(async (args: CreateSessionInput) => {
  const body: Record<string, unknown> = {}
  if (args.region) body.region = args.region.trim().toLowerCase()
  if (args.proxy) body.proxy = args.proxy.trim()
  if (args.adblock !== undefined) body.adblock = args.adblock
  if (args.trackers !== undefined) body.trackers = args.trackers
  return apiFetch('/sessions', { method: 'POST', body })
}, { method: 'create_session' })

const getSession = sg.wrap(async (args: GetSessionInput) => {
  const id = args.sessionId?.trim()
  if (!id) throw new Error('sessionId is required')
  return apiFetch(`/sessions/${encodeURIComponent(id)}`)
}, { method: 'get_session' })

const stopSession = sg.wrap(async (args: StopSessionInput) => {
  const id = args.sessionId?.trim()
  if (!id) throw new Error('sessionId is required')
  return apiFetch(`/sessions/${encodeURIComponent(id)}/stop`, { method: 'POST' })
}, { method: 'stop_session' })

const listSessions = sg.wrap(async (args: ListSessionsInput) => {
  const limit = Math.min(args.limit || 20, 50)
  return apiFetch(`/sessions?limit=${limit}`)
}, { method: 'list_sessions' })

export { createSession, getSession, stopSession, listSessions }
console.log('settlegrid-hyperbrowser MCP server ready')
console.log('Methods: create_session, get_session, stop_session, list_sessions')
console.log('Pricing: 1-5¢ per call | Powered by SettleGrid')