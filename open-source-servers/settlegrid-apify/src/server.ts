/**
 * settlegrid-apify — Apify Platform MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.apify.com/v2'

function getApiToken(): string {
  const token = process.env.APIFY_API_TOKEN
  if (!token) throw new Error('APIFY_API_TOKEN environment variable is required')
  return token
}

async function apifyFetch(
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  const token = getApiToken()
  const url = `${BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-apify/1.0',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Apify API ${res.status}: ${errText.slice(0, 300)}`)
  }
  return res.json()
}

interface ListActorsInput { limit?: number; offset?: number }
interface GetActorInput { actorId: string }
interface RunActorInput { actorId: string; input?: Record<string, unknown>; timeout?: number }
interface GetActorRunInput { actorId: string; runId: string }
interface GetDatasetItemsInput { datasetId: string; limit?: number; offset?: number }
interface GetKVStoreRecordInput { storeId: string; key: string }
interface ListActorRunsInput { actorId: string; limit?: number; status?: string }

const sg = settlegrid.init({
  toolSlug: 'apify',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_actors: { costCents: 1, displayName: 'List Actors' },
      get_actor: { costCents: 1, displayName: 'Get Actor' },
      run_actor: { costCents: 10, displayName: 'Run Actor' },
      get_actor_run: { costCents: 1, displayName: 'Get Actor Run' },
      get_dataset_items: { costCents: 2, displayName: 'Get Dataset Items' },
      get_key_value_store_record: { costCents: 1, displayName: 'Get Key-Value Store Record' },
      list_actor_runs: { costCents: 1, displayName: 'List Actor Runs' },
    },
  },
})

const listActors = sg.wrap(async (args: ListActorsInput) => {
  const limit = Math.min(args.limit || 20, 50)
  const offset = Math.max(args.offset || 0, 0)
  const data = await apifyFetch(`/acts?limit=${limit}&offset=${offset}`) as { data: { items: unknown[]; total: number } }
  return {
    total: data.data.total,
    count: data.data.items.length,
    actors: data.data.items,
  }
}, { method: 'list_actors' })

const getActor = sg.wrap(async (args: GetActorInput) => {
  const actorId = args.actorId?.trim()
  if (!actorId) throw new Error('actorId is required')
  const data = await apifyFetch(`/acts/${encodeURIComponent(actorId)}`) as { data: unknown }
  return data.data
}, { method: 'get_actor' })

const runActor = sg.wrap(async (args: RunActorInput) => {
  const actorId = args.actorId?.trim()
  if (!actorId) throw new Error('actorId is required')
  const timeout = Math.min(args.timeout || 60, 300)
  const runData = await apifyFetch(
    `/acts/${encodeURIComponent(actorId)}/runs`,
    {
      method: 'POST',
      body: JSON.stringify(args.input || {}),
    }
  ) as { data: { id: string; status: string; defaultDatasetId: string; defaultKeyValueStoreId: string } }
  const runId = runData.data.id
  const deadline = Date.now() + timeout * 1000
  let statusData = runData
  while (
    ['READY', 'RUNNING'].includes(statusData.data.status) &&
    Date.now() < deadline
  ) {
    await new Promise(r => setTimeout(r, 3000))
    statusData = await apifyFetch(
      `/acts/${encodeURIComponent(actorId)}/runs/${runId}`
    ) as typeof runData
  }
  return {
    runId,
    status: statusData.data.status,
    defaultDatasetId: statusData.data.defaultDatasetId,
    defaultKeyValueStoreId: statusData.data.defaultKeyValueStoreId,
  }
}, { method: 'run_actor' })

const getActorRun = sg.wrap(async (args: GetActorRunInput) => {
  const actorId = args.actorId?.trim()
  const runId = args.runId?.trim()
  if (!actorId) throw new Error('actorId is required')
  if (!runId) throw new Error('runId is required')
  const data = await apifyFetch(`/acts/${encodeURIComponent(actorId)}/runs/${encodeURIComponent(runId)}`) as { data: unknown }
  return data.data
}, { method: 'get_actor_run' })

const getDatasetItems = sg.wrap(async (args: GetDatasetItemsInput) => {
  const datasetId = args.datasetId?.trim()
  if (!datasetId) throw new Error('datasetId is required')
  const limit = Math.min(args.limit || 20, 50)
  const offset = Math.max(args.offset || 0, 0)
  const data = await apifyFetch(`/datasets/${encodeURIComponent(datasetId)}/items?limit=${limit}&offset=${offset}`) as { data: { items: unknown[]; total: number } }
  return {
    total: data.data.total,
    count: data.data.items.length,
    items: data.data.items,
  }
}, { method: 'get_dataset_items' })

const getKeyValueStoreRecord = sg.wrap(async (args: GetKVStoreRecordInput) => {
  const storeId = args.storeId?.trim()
  const key = args.key?.trim()
  if (!storeId) throw new Error('storeId is required')
  if (!key) throw new Error('key is required')
  const token = getApiToken()
  const url = `${BASE}/key-value-stores/${encodeURIComponent(storeId)}/records/${encodeURIComponent(key)}`
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'settlegrid-apify/1.0',
    },
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Apify API ${res.status}: ${errText.slice(0, 300)}`)
  }
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return res.json()
  }
  const text = await res.text()
  return { content: text, contentType }
}, { method: 'get_key_value_store_record' })

const listActorRuns = sg.wrap(async (args: ListActorRunsInput) => {
  const actorId = args.actorId?.trim()
  if (!actorId) throw new Error('actorId is required')
  const limit = Math.min(args.limit || 10, 50)
  const statusFilter = args.status ? `&status=${encodeURIComponent(args.status)}` : ''
  const data = await apifyFetch(`/acts/${encodeURIComponent(actorId)}/runs?limit=${limit}${statusFilter}`) as { data: { items: unknown[]; total: number } }
  return {
    total: data.data.total,
    count: data.data.items.length,
    runs: data.data.items,
  }
}, { method: 'list_actor_runs' })

export { listActors, getActor, runActor, getActorRun, getDatasetItems, getKeyValueStoreRecord, listActorRuns }
console.log('settlegrid-apify MCP server ready')
console.log('Methods: list_actors, get_actor, run_actor, get_actor_run, get_dataset_items, get_key_value_store_record, list_actor_runs')
console.log('Pricing: 1-10¢ per call | Powered by SettleGrid')