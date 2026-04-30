/**
 * settlegrid-langfuse-datasets — Langfuse Annotation Queues MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://cloud.langfuse.com'

interface ListQueuesInput { page?: number; limit?: number }
interface GetQueueInput { queueId: string }
interface CreateQueueInput { name: string; description?: string }
interface ListQueueItemsInput { queueId: string; status?: string; page?: number; limit?: number }
interface GetQueueItemInput { queueId: string; itemId: string }
interface CreateQueueItemInput { queueId: string; traceId: string; observationId?: string }
interface UpdateQueueItemInput { queueId: string; itemId: string; status: string }
interface DeleteQueueItemInput { queueId: string; itemId: string }

function getCredentials(): { publicKey: string; secretKey: string } {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY
  const secretKey = process.env.LANGFUSE_SECRET_KEY
  if (!publicKey) throw new Error('LANGFUSE_PUBLIC_KEY environment variable is required')
  if (!secretKey) throw new Error('LANGFUSE_SECRET_KEY environment variable is required')
  return { publicKey, secretKey }
}

function makeAuthHeader(publicKey: string, secretKey: string): string {
  return 'Basic ' + Buffer.from(`${publicKey}:${secretKey}`).toString('base64')
}

async function apiFetch(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const { publicKey, secretKey } = getCredentials()
  const headers: Record<string, string> = {
    'Authorization': makeAuthHeader(publicKey, secretKey),
    'User-Agent': 'settlegrid-langfuse-datasets/1.0',
    'Content-Type': 'application/json',
  }
  const res = await fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Langfuse API ${res.status}: ${text.slice(0, 300)}`)
  }
  if (res.status === 204) return { success: true }
  return res.json()
}

const sg = settlegrid.init({
  toolSlug: 'langfuse-datasets',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_annotation_queues: { costCents: 1, displayName: 'List Annotation Queues' },
      get_annotation_queue: { costCents: 1, displayName: 'Get Annotation Queue' },
      create_annotation_queue: { costCents: 3, displayName: 'Create Annotation Queue' },
      list_queue_items: { costCents: 1, displayName: 'List Queue Items' },
      get_queue_item: { costCents: 1, displayName: 'Get Queue Item' },
      create_queue_item: { costCents: 3, displayName: 'Create Queue Item' },
      update_queue_item: { costCents: 3, displayName: 'Update Queue Item' },
      delete_queue_item: { costCents: 2, displayName: 'Delete Queue Item' },
    },
  },
})

const listAnnotationQueues = sg.wrap(async (args: ListQueuesInput) => {
  const page = args.page ?? 1
  const limit = Math.min(args.limit || 20, 50)
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(limit))
  return apiFetch(`/api/public/annotation-queues?${params.toString()}`)
}, { method: 'list_annotation_queues' })

const getAnnotationQueue = sg.wrap(async (args: GetQueueInput) => {
  const queueId = args.queueId?.trim()
  if (!queueId) throw new Error('queueId is required')
  return apiFetch(`/api/public/annotation-queues/${encodeURIComponent(queueId)}`)
}, { method: 'get_annotation_queue' })

const createAnnotationQueue = sg.wrap(async (args: CreateQueueInput) => {
  const name = args.name?.trim()
  if (!name) throw new Error('name is required')
  const body: Record<string, unknown> = { name }
  if (args.description) body.description = args.description
  return apiFetch('/api/public/annotation-queues', { method: 'POST', body })
}, { method: 'create_annotation_queue' })

const listQueueItems = sg.wrap(async (args: ListQueueItemsInput) => {
  const queueId = args.queueId?.trim()
  if (!queueId) throw new Error('queueId is required')
  const page = args.page ?? 1
  const limit = Math.min(args.limit || 20, 50)
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(limit))
  if (args.status) params.set('status', args.status)
  return apiFetch(`/api/public/annotation-queues/${encodeURIComponent(queueId)}/items?${params.toString()}`)
}, { method: 'list_queue_items' })

const getQueueItem = sg.wrap(async (args: GetQueueItemInput) => {
  const queueId = args.queueId?.trim()
  const itemId = args.itemId?.trim()
  if (!queueId) throw new Error('queueId is required')
  if (!itemId) throw new Error('itemId is required')
  return apiFetch(`/api/public/annotation-queues/${encodeURIComponent(queueId)}/items/${encodeURIComponent(itemId)}`)
}, { method: 'get_queue_item' })

const createQueueItem = sg.wrap(async (args: CreateQueueItemInput) => {
  const queueId = args.queueId?.trim()
  const traceId = args.traceId?.trim()
  if (!queueId) throw new Error('queueId is required')
  if (!traceId) throw new Error('traceId is required')
  const body: Record<string, unknown> = { traceId }
  if (args.observationId) body.observationId = args.observationId
  return apiFetch(`/api/public/annotation-queues/${encodeURIComponent(queueId)}/items`, { method: 'POST', body })
}, { method: 'create_queue_item' })

const updateQueueItem = sg.wrap(async (args: UpdateQueueItemInput) => {
  const queueId = args.queueId?.trim()
  const itemId = args.itemId?.trim()
  const status = args.status?.trim()
  if (!queueId) throw new Error('queueId is required')
  if (!itemId) throw new Error('itemId is required')
  if (!status) throw new Error('status is required')
  return apiFetch(
    `/api/public/annotation-queues/${encodeURIComponent(queueId)}/items/${encodeURIComponent(itemId)}`,
    { method: 'PATCH', body: { status } }
  )
}, { method: 'update_queue_item' })

const deleteQueueItem = sg.wrap(async (args: DeleteQueueItemInput) => {
  const queueId = args.queueId?.trim()
  const itemId = args.itemId?.trim()
  if (!queueId) throw new Error('queueId is required')
  if (!itemId) throw new Error('itemId is required')
  return apiFetch(
    `/api/public/annotation-queues/${encodeURIComponent(queueId)}/items/${encodeURIComponent(itemId)}`,
    { method: 'DELETE' }
  )
}, { method: 'delete_queue_item' })

export {
  listAnnotationQueues,
  getAnnotationQueue,
  createAnnotationQueue,
  listQueueItems,
  getQueueItem,
  createQueueItem,
  updateQueueItem,
  deleteQueueItem,
}

console.log('settlegrid-langfuse-datasets MCP server ready')
console.log('Methods: list_annotation_queues, get_annotation_queue, create_annotation_queue, list_queue_items, get_queue_item, create_queue_item, update_queue_item, delete_queue_item')
console.log('Pricing: 1-3¢ per call | Powered by SettleGrid')
