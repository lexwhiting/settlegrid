/**
 * settlegrid-hightouch — Hightouch MCP Server
 * Interact with Hightouch syncs, models, sources, and destinations.
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.hightouch.com/api/v1'

function getApiKey(): string {
  const k = process.env.HIGHTOUCH_API_KEY
  if (!k) throw new Error('HIGHTOUCH_API_KEY environment variable is required')
  return k
}

async function htFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const apiKey = getApiKey()
  const url = `${BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-hightouch/1.0',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Hightouch API ${res.status}: ${errText.slice(0, 200)}`)
  }
  return res.json()
}

interface ListSyncsInput { limit?: number }
interface GetSyncInput { syncId: string }
interface TriggerSyncInput { syncId: string; fullResync?: boolean }
interface ListSyncRunsInput { syncId: string; limit?: number }
interface ListModelsInput { limit?: number }
interface GetModelInput { modelId: string }
interface ListSourcesInput { limit?: number }
interface ListDestinationsInput { limit?: number }

const sg = settlegrid.init({
  toolSlug: 'hightouch',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_syncs: { costCents: 1, displayName: 'List Syncs' },
      get_sync: { costCents: 1, displayName: 'Get Sync' },
      trigger_sync: { costCents: 5, displayName: 'Trigger Sync' },
      list_sync_runs: { costCents: 1, displayName: 'List Sync Runs' },
      list_models: { costCents: 1, displayName: 'List Models' },
      get_model: { costCents: 1, displayName: 'Get Model' },
      list_sources: { costCents: 1, displayName: 'List Sources' },
      list_destinations: { costCents: 1, displayName: 'List Destinations' },
    },
  },
})

const listSyncs = sg.wrap(async (args: ListSyncsInput) => {
  const limit = Math.min(args.limit || 20, 50)
  const data = await htFetch(`/syncs?limit=${limit}`) as { data: unknown[] }
  return { count: Array.isArray(data.data) ? data.data.length : 0, syncs: data.data }
}, { method: 'list_syncs' })

const getSync = sg.wrap(async (args: GetSyncInput) => {
  const id = args.syncId?.trim()
  if (!id) throw new Error('syncId is required')
  return htFetch(`/syncs/${encodeURIComponent(id)}`)
}, { method: 'get_sync' })

const triggerSync = sg.wrap(async (args: TriggerSyncInput) => {
  const id = args.syncId?.trim()
  if (!id) throw new Error('syncId is required')
  const body = JSON.stringify({ fullResync: args.fullResync ?? false })
  return htFetch(`/syncs/${encodeURIComponent(id)}/trigger`, {
    method: 'POST',
    body,
  })
}, { method: 'trigger_sync' })

const listSyncRuns = sg.wrap(async (args: ListSyncRunsInput) => {
  const id = args.syncId?.trim()
  if (!id) throw new Error('syncId is required')
  const limit = Math.min(args.limit || 20, 50)
  const data = await htFetch(`/syncs/${encodeURIComponent(id)}/runs?limit=${limit}`) as { data: unknown[] }
  return { syncId: id, count: Array.isArray(data.data) ? data.data.length : 0, runs: data.data }
}, { method: 'list_sync_runs' })

const listModels = sg.wrap(async (args: ListModelsInput) => {
  const limit = Math.min(args.limit || 20, 50)
  const data = await htFetch(`/models?limit=${limit}`) as { data: unknown[] }
  return { count: Array.isArray(data.data) ? data.data.length : 0, models: data.data }
}, { method: 'list_models' })

const getModel = sg.wrap(async (args: GetModelInput) => {
  const id = args.modelId?.trim()
  if (!id) throw new Error('modelId is required')
  return htFetch(`/models/${encodeURIComponent(id)}`)
}, { method: 'get_model' })

const listSources = sg.wrap(async (args: ListSourcesInput) => {
  const limit = Math.min(args.limit || 20, 50)
  const data = await htFetch(`/sources?limit=${limit}`) as { data: unknown[] }
  return { count: Array.isArray(data.data) ? data.data.length : 0, sources: data.data }
}, { method: 'list_sources' })

const listDestinations = sg.wrap(async (args: ListDestinationsInput) => {
  const limit = Math.min(args.limit || 20, 50)
  const data = await htFetch(`/destinations?limit=${limit}`) as { data: unknown[] }
  return { count: Array.isArray(data.data) ? data.data.length : 0, destinations: data.data }
}, { method: 'list_destinations' })

export { listSyncs, getSync, triggerSync, listSyncRuns, listModels, getModel, listSources, listDestinations }
console.log('settlegrid-hightouch MCP server ready')
console.log('Methods: list_syncs, get_sync, trigger_sync, list_sync_runs, list_models, get_model, list_sources, list_destinations')
console.log('Pricing: 1-5¢ per call | Powered by SettleGrid')