/**
 * settlegrid-langfuse — Langfuse Annotation Queues MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://cloud.langfuse.com'

interface ListQueuesInput { page?: number; limit?: number }
interface CreateQueueInput { name: string; description?: string }
interface GetQueueInput { queueId: string }
interface ListQueueItemsInput { queueId: string; status?: string; page?: number; limit?: number }
interface CreateQueueItemInput { queueId: string; traceId: string; observationId?: string }
interface GetQueueItemInput { queueId: string; itemId: string }
interface UpdateQueueItemInput { queueId: string; itemId: string; status?: string }
interface DeleteQueueItemInput { queueId: string; itemId: string }

function getCredentials(): { publicKey: string; secretKey: string } {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY
  const secretKey = process.env.LANGFUSE_SECRET_KEY
  if (!publicKey) throw new Error('LANGFUSE_PUBLIC_KEY environment variable is required')
  if (!secretKey) throw new Error('LANGFUSE_SECRET_KEY environment variable is required')
  return { publicKey, secretKey }
}

function basicAuth(publicKey: string, secretKey: string): string {
  return 'Basic ' + Buffer.from(`${publicKey}:${secretKey}`).toString('base64')
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const { publicKey, secretKey } = getCredentials()
  const url = `${BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': basicAuth(publicKey, secretKey),
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-langfuse/1.0',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Langfuse API ${res.status}: ${text.slice(0, 300)}`)
  }
  if (res.status === 204) return { success: true }
  return res.json()
}

const sg = settlegrid.init({
  toolSlug: 'langfuse',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_annotation_queues: { costCents: 1, displayName: 'List Annotation Queues' },
      create_annotation_queue: { costCents: 3, displayName: 'Create Annotation Queue' },
      get_annotation_queue: { costCents: 1, displayName: 'Get Annotation Queue' },
      list_queue_items: { costCents: 1, displayName: 'List Queue Items' },
      create_queue_item: { costCents: 3, displayName: 'Create Queue Item' },
      get_queue_item: { costCents: 1, displayName: 'Get Queue Item' },
      update_queue_item: { costCents: 3, displayName: 'Update Queue Item' },
      delete_queue_item: { costCents: 3, displayName: 'Delete Queue Item' },
    },
  },
})

const listAnnotationQueues = sg.wrap(async (args: ListQueuesInput) => {
  const page = args.page || 1
  const limit = Math.min(args.limit || 20, 50)
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  return apiFetch(`/api/public/annotation-queues?${params}`)
}, { method: 'list_annotation_queues' })

const createAnnotationQueue = sg.wrap(async (args: CreateQueueInput) => {
  const name = args.name?.trim()
  if (!name) throw new Error('name is required')
  const body: Record<string, string> = { name }
  if (args.description) body.description = args.description
  return apiFetch('/api/public/annotation-queues', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}, { method: 'create_annotation_queue' })

const getAnnotationQueue = sg.wrap(async (args: GetQueueInput) => {
  const queueId = args.queueId?.trim()
  if (!queueId) throw new Error('queueId is required')
  return apiFetch(`/api/public/annotation-queues/${encodeURIComponent(queueId)}`)
}, { method: 'get_annotation_queue' })

const listQueueItems = sg.wrap(async (args: ListQueueItemsInput) => {
  const queueId = args.queueId?.trim()
  if (!queueId) throw new Error('queueId is required')
  const page = args.page || 1
  const limit = Math.min(args.limit || 20, 50)
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (args.status) params.set('status', args.status)
  return apiFetch(`/api/public/annotation-queues/${encodeURIComponent(queueId)}/items?${params}`)
}, { method: 'list_queue_items' })

const createQueueItem = sg.wrap(async (args: CreateQueueItemInput) => {
  const queueId = args.queueId?.trim()
  if (!queueId) throw new Error('queueId is required')
  const traceId = args.traceId?.trim()
  if (!traceId) throw new Error('traceId is required')
  const body: Record<string, string> = { traceId }
  if (args.observationId) body.observationId = args.observationId
  return apiFetch(`/api/public/annotation-queues/${encodeURIComponent(queueId)}/items`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}, { method: 'create_queue_item' })

const getQueueItem = sg.wrap(async (args: GetQueueItemInput) => {
  const queueId = args.queueId?.trim()
  if (!queueId) throw new Error('queueId is required')
  const itemId = args.itemId?.trim()
  if (!itemId) throw new Error('itemId is required')
  return apiFetch(`/api/public/annotation-queues/${encodeURIComponent(queueId)}/items/${encodeURIComponent(itemId)}`)
}, { method: 'get_queue_item' })

const updateQueueItem = sg.wrap(async (args: UpdateQueueItemInput) => {
  const queueId = args.queueId?.trim()
  if (!queueId) throw new Error('queueId is required')
  const itemId = args.itemId?.trim()
  if (!itemId) throw new Error('itemId is required')
  const body: Record<string, string> = {}
  if (args.status) body.status = args.status
  return apiFetch(`/api/public/annotation-queues/${encodeURIComponent(queueId)}/items/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}, { method: 'update_queue_item' })

const deleteQueueItem = sg.wrap(async (args: DeleteQueueItemInput) => {
  const queueId = args.queueId?.trim()
  if (!queueId) throw new Error('queueId is required')
  const itemId = args.itemId?.trim()
  if (!itemId) throw new Error('itemId is required')
  return apiFetch(`/api/public/annotation-queues/${encodeURIComponent(queueId)}/items/${encodeURIComponent(itemId)}`, {
    method: 'DELETE',
  })
}, { method: 'delete_queue_item' })

export { listAnnotationQueues, createAnnotationQueue, getAnnotationQueue, listQueueItems, createQueueItem, getQueueItem, updateQueueItem, deleteQueueItem }
console.log('settlegrid-langfuse MCP server ready')
console.log('Methods: list_annotation_queues, create_annotation_queue, get_annotation_queue, list_queue_items, create_queue_item, get_queue_item, update_queue_item, delete_queue_item')
console.log('Pricing: 1-3¢ per call | Powered by SettleGrid')