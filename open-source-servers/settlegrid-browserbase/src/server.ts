/**
 * settlegrid-browserbase — Browserbase Cloud Browser Sessions MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface CreateSessionInput {
  projectId: string
  browserSettings?: Record<string, unknown>
  timeout?: number
  proxies?: boolean
}

interface GetSessionInput {
  sessionId: string
}

interface ListSessionsInput {
  projectId: string
  status?: string
}

interface StopSessionInput {
  sessionId: string
}

interface GetSessionRecordingInput {
  sessionId: string
}

interface GetSessionLogsInput {
  sessionId: string
}

const BASE = 'https://www.browserbase.com'

function getApiKey(): string {
  const k = process.env.BROWSERBASE_API_KEY
  if (!k) throw new Error('BROWSERBASE_API_KEY environment variable is required')
  return k
}

async function apiFetch(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const key = getApiKey()
  const res = await fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-BB-API-Key': key,
      'User-Agent': 'settlegrid-browserbase/1.0',
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Browserbase API error ${res.status}: ${errText.slice(0, 300)}`)
  }
  const text = await res.text()
  if (!text) return {}
  return JSON.parse(text)
}

const sg = settlegrid.init({
  toolSlug: 'browserbase',
  pricing: {
    defaultCostCents: 1,
    methods: {
      create_session: { costCents: 5, displayName: 'Create Session' },
      get_session: { costCents: 1, displayName: 'Get Session' },
      list_sessions: { costCents: 1, displayName: 'List Sessions' },
      stop_session: { costCents: 2, displayName: 'Stop Session' },
      get_session_recording: { costCents: 2, displayName: 'Get Session Recording' },
      get_session_logs: { costCents: 1, displayName: 'Get Session Logs' },
    },
  },
})

const createSession = sg.wrap(async (args: CreateSessionInput) => {
  const projectId = args.projectId?.trim()
  if (!projectId) throw new Error('projectId is required')
  const timeout = Math.min(args.timeout || 300, 3600)
  const body: Record<string, unknown> = { projectId, timeout }
  if (args.browserSettings) body.browserSettings = args.browserSettings
  if (args.proxies !== undefined) body.proxies = args.proxies ? [{ type: 'browserbase' }] : []
  return apiFetch('/v1/sessions', { method: 'POST', body })
}, { method: 'create_session' })

const getSession = sg.wrap(async (args: GetSessionInput) => {
  const sessionId = args.sessionId?.trim()
  if (!sessionId) throw new Error('sessionId is required')
  return apiFetch(`/v1/sessions/${encodeURIComponent(sessionId)}`)
}, { method: 'get_session' })

const listSessions = sg.wrap(async (args: ListSessionsInput) => {
  const projectId = args.projectId?.trim()
  if (!projectId) throw new Error('projectId is required')
  const params = new URLSearchParams({ projectId })
  if (args.status) params.set('status', args.status.toUpperCase())
  return apiFetch(`/v1/sessions?${params.toString()}`)
}, { method: 'list_sessions' })

const stopSession = sg.wrap(async (args: StopSessionInput) => {
  const sessionId = args.sessionId?.trim()
  if (!sessionId) throw new Error('sessionId is required')
  return apiFetch(`/v1/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'POST',
    body: { status: 'REQUEST_RELEASE' },
  })
}, { method: 'stop_session' })

const getSessionRecording = sg.wrap(async (args: GetSessionRecordingInput) => {
  const sessionId = args.sessionId?.trim()
  if (!sessionId) throw new Error('sessionId is required')
  return apiFetch(`/v1/sessions/${encodeURIComponent(sessionId)}/recording`)
}, { method: 'get_session_recording' })

const getSessionLogs = sg.wrap(async (args: GetSessionLogsInput) => {
  const sessionId = args.sessionId?.trim()
  if (!sessionId) throw new Error('sessionId is required')
  return apiFetch(`/v1/sessions/${encodeURIComponent(sessionId)}/logs`)
}, { method: 'get_session_logs' })

export { createSession, getSession, listSessions, stopSession, getSessionRecording, getSessionLogs }
console.log('settlegrid-browserbase MCP server ready')
console.log('Methods: create_session, get_session, list_sessions, stop_session, get_session_recording, get_session_logs')
console.log('Pricing: 1-5¢ per call | Powered by SettleGrid')