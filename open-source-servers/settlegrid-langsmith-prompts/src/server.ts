/**
 * settlegrid-langsmith-prompts — LangSmith Tracing Sessions MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.smith.langchain.com'

function getApiKey(): string {
  const k = process.env.LANGSMITH_API_KEY
  if (!k) throw new Error('LANGSMITH_API_KEY environment variable is required')
  return k
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const apiKey = getApiKey()
  const url = `${BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-langsmith-prompts/1.0',
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`LangSmith API ${res.status}: ${errText}`)
  }
  return res.json()
}

interface ListSessionsInput {
  name_contains?: string
  limit?: number
  offset?: number
}

interface GetSessionInput {
  session_id: string
  include_stats?: boolean
}

interface CreateSessionInput {
  name: string
  description?: string
}

interface DeleteSessionInput {
  session_id: string
}

interface GetSessionMetadataInput {
  session_id: string
  k?: number
  metadata_keys?: string
}

interface ListSessionViewsInput {
  session_id: string
}

interface GetServerInfoInput {}

const sg = settlegrid.init({
  toolSlug: 'langsmith-prompts',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_sessions: { costCents: 1, displayName: 'List Sessions' },
      get_session: { costCents: 1, displayName: 'Get Session' },
      create_session: { costCents: 3, displayName: 'Create Session' },
      delete_session: { costCents: 2, displayName: 'Delete Session' },
      get_session_metadata: { costCents: 1, displayName: 'Get Session Metadata' },
      list_session_views: { costCents: 1, displayName: 'List Session Views' },
      get_server_info: { costCents: 1, displayName: 'Get Server Info' },
    },
  },
})

const listSessions = sg.wrap(async (args: ListSessionsInput) => {
  const limit = Math.min(args.limit || 20, 100)
  const offset = args.offset || 0
  const params = new URLSearchParams()
  params.set('limit', String(limit))
  params.set('offset', String(offset))
  if (args.name_contains?.trim()) {
    params.set('name_contains', args.name_contains.trim())
  }
  return apiFetch(`/api/v1/sessions?${params.toString()}`)
}, { method: 'list_sessions' })

const getSession = sg.wrap(async (args: GetSessionInput) => {
  const sessionId = args.session_id?.trim()
  if (!sessionId) throw new Error('session_id is required')
  const params = new URLSearchParams()
  if (args.include_stats) {
    params.set('include_stats', 'true')
  }
  const qs = params.toString() ? `?${params.toString()}` : ''
  return apiFetch(`/api/v1/sessions/${encodeURIComponent(sessionId)}${qs}`)
}, { method: 'get_session' })

const createSession = sg.wrap(async (args: CreateSessionInput) => {
  const name = args.name?.trim()
  if (!name) throw new Error('name is required')
  const body: Record<string, unknown> = { name }
  if (args.description?.trim()) {
    body.description = args.description.trim()
  }
  return apiFetch('/api/v1/sessions', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}, { method: 'create_session' })

const deleteSession = sg.wrap(async (args: DeleteSessionInput) => {
  const sessionId = args.session_id?.trim()
  if (!sessionId) throw new Error('session_id is required')
  const apiKey = getApiKey()
  const res = await fetch(`${BASE}/api/v1/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-langsmith-prompts/1.0',
    },
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`LangSmith API ${res.status}: ${errText}`)
  }
  return { success: true, session_id: sessionId }
}, { method: 'delete_session' })

const getSessionMetadata = sg.wrap(async (args: GetSessionMetadataInput) => {
  const sessionId = args.session_id?.trim()
  if (!sessionId) throw new Error('session_id is required')
  const params = new URLSearchParams()
  if (args.k) {
    params.set('k', String(Math.min(args.k, 100)))
  }
  if (args.metadata_keys?.trim()) {
    const keys = args.metadata_keys.split(',').map(k => k.trim()).filter(Boolean)
    keys.forEach(k => params.append('metadata_keys', k))
  }
  const qs = params.toString() ? `?${params.toString()}` : ''
  return apiFetch(`/api/v1/sessions/${encodeURIComponent(sessionId)}/metadata${qs}`)
}, { method: 'get_session_metadata' })

const listSessionViews = sg.wrap(async (args: ListSessionViewsInput) => {
  const sessionId = args.session_id?.trim()
  if (!sessionId) throw new Error('session_id is required')
  return apiFetch(`/api/v1/sessions/${encodeURIComponent(sessionId)}/views`)
}, { method: 'list_session_views' })

const getServerInfo = sg.wrap(async (_args: GetServerInfoInput) => {
  return apiFetch('/api/v1/info')
}, { method: 'get_server_info' })

export { listSessions, getSession, createSession, deleteSession, getSessionMetadata, listSessionViews, getServerInfo }
console.log('settlegrid-langsmith-prompts MCP server ready')
console.log('Methods: list_sessions, get_session, create_session, delete_session, get_session_metadata, list_session_views, get_server_info')
console.log('Pricing: 1-3¢ per call | Powered by SettleGrid')