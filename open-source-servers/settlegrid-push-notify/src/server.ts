/**
 * settlegrid-push-notify — Push Notification MCP Server
 *
 * Wraps the free ntfy.sh service with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   send(title, body, topic)         — Send a push notification      (2¢)
 *   send_batch(notifications[])      — Send multiple notifications   (1¢/msg)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SendInput {
  title: string
  body: string
  topic: string
  priority?: number
  tags?: string[]
}

interface BatchInput {
  notifications: Array<{ title: string; body: string; topic: string }>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const NTFY_BASE = 'https://ntfy.sh'

async function sendNotification(topic: string, title: string, body: string, priority?: number, tags?: string[]): Promise<{ id: string; time: number }> {
  const headers: Record<string, string> = {
    Title: title.slice(0, 256),
    'Content-Type': 'text/plain',
  }
  if (priority) headers['Priority'] = String(Math.min(5, Math.max(1, priority)))
  if (tags?.length) headers['Tags'] = tags.slice(0, 5).join(',')

  const res = await fetch(`${NTFY_BASE}/${encodeURIComponent(topic)}`, {
    method: 'POST',
    headers,
    body: body.slice(0, 4096),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`ntfy.sh error ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json() as { id: string; time: number }
  return data
}

function validateTopic(topic: unknown): string {
  if (!topic || typeof topic !== 'string') throw new Error('topic is required')
  const clean = topic.trim()
  if (clean.length < 1 || clean.length > 64) throw new Error('topic must be 1-64 characters')
  if (!/^[a-zA-Z0-9_-]+$/.test(clean)) throw new Error('topic must be alphanumeric with _ or -')
  return clean
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'push-notify',
  pricing: {
    defaultCostCents: 2,
    methods: {
      send: { costCents: 2, displayName: 'Send Notification' },
      send_batch: { costCents: 1, displayName: 'Batch Send' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const send = sg.wrap(async (args: SendInput) => {
  if (!args.title || typeof args.title !== 'string') throw new Error('title is required')
  if (!args.body || typeof args.body !== 'string') throw new Error('body is required')
  const topic = validateTopic(args.topic)

  const result = await sendNotification(topic, args.title, args.body, args.priority, args.tags)

  return {
    success: true,
    topic,
    messageId: result.id,
    timestamp: new Date(result.time * 1000).toISOString(),
    title: args.title,
    bodyPreview: args.body.slice(0, 100),
  }
}, { method: 'send' })

const sendBatch = sg.wrap(async (args: BatchInput) => {
  if (!Array.isArray(args.notifications) || args.notifications.length === 0) {
    throw new Error('notifications must be a non-empty array')
  }
  if (args.notifications.length > 20) throw new Error('Maximum 20 notifications per batch')

  const results = await Promise.allSettled(
    args.notifications.map(async (n) => {
      const topic = validateTopic(n.topic)
      if (!n.title || !n.body) throw new Error('Each notification needs title and body')
      const result = await sendNotification(topic, n.title, n.body)
      return { topic, messageId: result.id, success: true }
    })
  )

  const sent = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length

  return {
    total: args.notifications.length,
    sent,
    failed,
    results: results.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : { topic: args.notifications[i].topic, success: false, error: (r.reason as Error).message }
    ),
  }
}, { method: 'send_batch' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { send, sendBatch }

console.log('settlegrid-push-notify MCP server ready')
console.log('Methods: send, send_batch')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
