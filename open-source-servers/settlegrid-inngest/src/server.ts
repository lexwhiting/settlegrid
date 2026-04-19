/**
 * settlegrid-inngest — Inngest REST API MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.inngest.com'

interface ListEventsInput { limit?: number }
interface GetEventInput { eventId: string }
interface SendEventInput { name: string; data: Record<string, unknown>; id?: string }
interface GetEventRunsInput { eventId: string }
interface ListRunsInput { limit?: number }
interface GetRunInput { runId: string }
interface CancelRunInput { runId: string }
interface ListFunctionsInput { limit?: number }

function getApiKey(): string {
  const k = process.env.INNGEST_API_KEY
  if (!k) throw new Error('INNGEST_API_KEY environment variable is required')
  return k
}

async function apiFetch(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const apiKey = getApiKey()
  const res = await fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-inngest/1.0',
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Inngest API error ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

const sg = settlegrid.init({
  toolSlug: 'inngest',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_events: { costCents: 1, displayName: 'List Events' },
      get_event: { costCents: 1, displayName: 'Get Event' },
      send_event: { costCents: 3, displayName: 'Send Event' },
      get_event_runs: { costCents: 1, displayName: 'Get Event Runs' },
      list_runs: { costCents: 1, displayName: 'List Runs' },
      get_run: { costCents: 1, displayName: 'Get Run' },
      cancel_run: { costCents: 3, displayName: 'Cancel Run' },
      list_functions: { costCents: 1, displayName: 'List Functions' },
    },
  },
})

const listEvents = sg.wrap(async (args: ListEventsInput) => {
  const limit = Math.min(args.limit || 20, 50)
  return apiFetch(`/v1/events?limit=${limit}`)
}, { method: 'list_events' })

const getEvent = sg.wrap(async (args: GetEventInput) => {
  const id = args.eventId?.trim()
  if (!id) throw new Error('eventId is required')
  return apiFetch(`/v1/events/${encodeURIComponent(id)}`)
}, { method: 'get_event' })

const sendEvent = sg.wrap(async (args: SendEventInput) => {
  const name = args.name?.trim()
  if (!name) throw new Error('name is required')
  if (!args.data || typeof args.data !== 'object') throw new Error('data must be a JSON object')
  const payload: Record<string, unknown> = { name, data: args.data }
  if (args.id) payload.id = args.id.trim()
  return apiFetch('/v1/events', { method: 'POST', body: payload })
}, { method: 'send_event' })

const getEventRuns = sg.wrap(async (args: GetEventRunsInput) => {
  const id = args.eventId?.trim()
  if (!id) throw new Error('eventId is required')
  return apiFetch(`/v1/events/${encodeURIComponent(id)}/runs`)
}, { method: 'get_event_runs' })

const listRuns = sg.wrap(async (args: ListRunsInput) => {
  const limit = Math.min(args.limit || 20, 50)
  return apiFetch(`/v1/runs?limit=${limit}`)
}, { method: 'list_runs' })

const getRun = sg.wrap(async (args: GetRunInput) => {
  const id = args.runId?.trim()
  if (!id) throw new Error('runId is required')
  return apiFetch(`/v1/runs/${encodeURIComponent(id)}`)
}, { method: 'get_run' })

const cancelRun = sg.wrap(async (args: CancelRunInput) => {
  const id = args.runId?.trim()
  if (!id) throw new Error('runId is required')
  return apiFetch(`/v1/runs/${encodeURIComponent(id)}`, { method: 'DELETE' })
}, { method: 'cancel_run' })

const listFunctions = sg.wrap(async (args: ListFunctionsInput) => {
  const limit = Math.min(args.limit || 20, 50)
  return apiFetch(`/v1/functions?limit=${limit}`)
}, { method: 'list_functions' })

export { listEvents, getEvent, sendEvent, getEventRuns, listRuns, getRun, cancelRun, listFunctions }
console.log('settlegrid-inngest MCP server ready')
console.log('Methods: list_events, get_event, send_event, get_event_runs, list_runs, get_run, cancel_run, list_functions')
console.log('Pricing: 1-3¢ per call | Powered by SettleGrid')