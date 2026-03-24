/**
 * settlegrid-webhook-relay — Webhook Relay MCP Server
 *
 * Local webhook capture — no external API needed.
 *
 * Methods:
 *   create_endpoint()          — Create a new webhook endpoint   (1¢)
 *   list_events(endpoint)      — List events at endpoint         (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'
import { randomBytes } from 'crypto'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListEventsInput {
  endpoint: string
}

interface WebhookEvent {
  id: string
  timestamp: string
  method: string
  headers: Record<string, string>
  body: string
}

interface Endpoint {
  id: string
  created: string
  url: string
  events: WebhookEvent[]
}

// ─── In-Memory Store ────────────────────────────────────────────────────────

const endpoints = new Map<string, Endpoint>()
const MAX_ENDPOINTS = 100
const MAX_EVENTS_PER_ENDPOINT = 50

function generateId(): string {
  return randomBytes(12).toString('hex')
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'webhook-relay',
  pricing: {
    defaultCostCents: 1,
    methods: {
      create_endpoint: { costCents: 1, displayName: 'Create Endpoint' },
      list_events: { costCents: 1, displayName: 'List Events' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const createEndpoint = sg.wrap(async () => {
  // Evict oldest if at capacity
  if (endpoints.size >= MAX_ENDPOINTS) {
    const oldest = [...endpoints.entries()].sort(
      (a, b) => new Date(a[1].created).getTime() - new Date(b[1].created).getTime()
    )[0]
    if (oldest) endpoints.delete(oldest[0])
  }

  const id = generateId()
  const endpoint: Endpoint = {
    id,
    created: new Date().toISOString(),
    url: `https://webhook-relay.settlegrid.ai/hook/${id}`,
    events: [],
  }

  endpoints.set(id, endpoint)

  return {
    id: endpoint.id,
    url: endpoint.url,
    created: endpoint.created,
    note: 'Send POST/PUT/PATCH requests to the URL above. Events are stored in memory and expire on server restart.',
    maxEvents: MAX_EVENTS_PER_ENDPOINT,
  }
}, { method: 'create_endpoint' })

const listEvents = sg.wrap(async (args: ListEventsInput) => {
  if (!args.endpoint || typeof args.endpoint !== 'string') {
    throw new Error('endpoint ID is required')
  }

  const ep = endpoints.get(args.endpoint)
  if (!ep) {
    throw new Error(`Endpoint "${args.endpoint}" not found. It may have expired or been evicted.`)
  }

  return {
    endpoint: ep.id,
    url: ep.url,
    created: ep.created,
    eventCount: ep.events.length,
    events: ep.events.slice(-20).reverse().map((e) => ({
      id: e.id,
      timestamp: e.timestamp,
      method: e.method,
      headers: e.headers,
      bodyPreview: e.body.slice(0, 500),
      bodySize: e.body.length,
    })),
  }
}, { method: 'list_events' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { createEndpoint, listEvents }

console.log('settlegrid-webhook-relay MCP server ready')
console.log('Methods: create_endpoint, list_events')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
