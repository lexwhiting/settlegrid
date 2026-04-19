/**
 * settlegrid-langsmith — LangSmith MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.smith.langchain.com'

interface GetServerInfoInput {}
interface ListSessionsInput {
  name?: string
  name_contains?: string
  limit?: number
  offset?: number
  include_stats?: boolean
}
interface GetSessionInput {
  session_id: string
  include_stats?: boolean
}
interface CreateSessionInput {
  name: string
  description?: string
  upsert?: boolean
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
interface GetSessionViewInput {
  session_id: string
  view_id: string
}

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
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-langsmith/1.0',
      'X-Api-Key': apiKey,
      ...(options.headers as Record<string, string> ?? {}),
    },
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`LangSmith API ${res.status}: ${errText}`)
  }
  return res.json()
}

const sg = settlegrid.init({
  toolSlug: 'langsmith',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_server_info: { costCents: 1, displayName: 'Get Server Info' },
      list_sessions: { costCents: 1, displayName: 'List Sessions' },
      get_session: { costCents: 1, displayName: 'Get Session' },
      create_session: { costCents: 3, displayName: 'Create Session' },
      delete_session: { costCents: 3, displayName: 'Delete Session' },
      get_session_metadata: { costCents: 1, displayName: 'Get Session Metadata' },
      list_session_views: { costCents: 1, displayName: 'List Session Views' },
      get_session_view: { costCents: 1, displayName: 'Get Session View' },
    },
  },
})

const getServerInfo = sg.wrap(async (_args: GetServerInfoInput) => {
  return apiFetch('/api/v1/info')
}, { method: 'get_server_info' })

const listSessions = sg.wrap(async (args: ListSessionsInput) => {
  const limit = Math.min(args.limit || 20, 100)
  const offset = Math.max(args.offset || 0, 0)
  const params = new URLSearchParams()
  params.set('limit', String(limit))
  params.set('offset', String(offset))
  if (args.name) params.set('name', args.name)
  if (args.name_contains) params.set('name_contains', args.name_contains)
  if (args.include_stats !== undefined) params.set('include_stats', String(args.include_stats))
  return apiFetch(`/api/v1/sessions?${params.toString()}`)
}, { method: 'list_sessions' })

const getSession = sg.wrap(async (args: GetSessionInput) => {
  const id = args.session_id?.trim()
  if (!id) throw new Error('session_id is required')
  const params = new URLSearchParams()
  if (args.include_stats !== undefined) params.set('include_stats', String(args.include_stats))
  const qs = params.toString() ? `?${params.toString()}` : ''
  return apiFetch(`/api/v1/sessions/${encodeURIComponent(id)}${qs}`)
}, { method: 'get_session' })

const createSession = sg.wrap(async (args: CreateSessionInput) => {
  const name = args.name?.trim()
  if (!name) throw new Error('name is required')
  const upsert = args.upsert ? '?upsert=true' : ''
  const body: Record<string, unknown> = { name }
  if (args.description) body.description = args.description
  return apiFetch(`/api/v1/sessions${upsert}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}, { method: 'create_session' })

const deleteSession = sg.wrap(async (args: DeleteSessionInput) => {
  const id = args.session_id?.trim()
  if (!id) throw new Error('session_id is required')
  return apiFetch(`/api/v1/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
}, { method: 'delete_session' })

const getSessionMetadata = sg.wrap(async (args: GetSessionMetadataInput) => {
  const id = args.session_id?.trim()
  if (!id) throw new Error('session_id is required')
  const params = new URLSearchParams()
  const k = Math.min(args.k || 10, 100)
  params.set('k', String(k))
  if (args.metadata_keys) {
    const keys = args.metadata_keys.split(',').map(k => k.trim()).filter(Boolean)
    for (const key of keys) params.append('metadata_keys', key)
  }
  return apiFetch(`/api/v1/sessions/${encodeURIComponent(id)}/metadata?${params.toString()}`)
}, { method: 'get_session_metadata' })

const listSessionViews = sg.wrap(async (args: ListSessionViewsInput) => {
  const id = args.session_id?.trim()
  if (!id) throw new Error('session_id is required')
  return apiFetch(`/api/v1/sessions/${encodeURIComponent(id)}/views`)
}, { method: 'list_session_views' })

const getSessionView = sg.wrap(async (args: GetSessionViewInput) => {
  const sessionId = args.session_id?.trim()
  if (!sessionId) throw new Error('session_id is required')
  const viewId = args.view_id?.trim()
  if (!viewId) throw new Error('view_id is required')
  return apiFetch(`/api/v1/sessions/${encodeURIComponent(sessionId)}/views/${encodeURIComponent(viewId)}`)
}, { method: 'get_session_view' })

export {
  getServerInfo,
  listSessions,
  getSession,
  createSession,
  deleteSession,
  getSessionMetadata,
  listSessionViews,
  getSessionView,
}
console.log('settlegrid-langsmith MCP server ready')
console.log('Methods: get_server_info, list_sessions, get_session, create_session, delete_session, get_session_metadata, list_session_views, get_session_view')
console.log('Pricing: 1-3¢ per call | Powered by SettleGrid')