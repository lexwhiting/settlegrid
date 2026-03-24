/**
 * settlegrid-wayback-machine — Wayback Machine MCP Server
 *
 * Check if URLs are archived in the Internet Archive Wayback Machine.
 *
 * Methods:
 *   check_url(url)                — Check if a URL has been archived and get the latest snapshot  (1¢)
 *   get_snapshot(url, timestamp)  — Get a specific archived snapshot by URL and timestamp  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CheckUrlInput {
  url: string
}

interface GetSnapshotInput {
  url: string
  timestamp?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://archive.org'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-wayback-machine/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Wayback Machine API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'wayback-machine',
  pricing: {
    defaultCostCents: 1,
    methods: {
      check_url: { costCents: 1, displayName: 'Check URL' },
      get_snapshot: { costCents: 1, displayName: 'Get Snapshot' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const checkUrl = sg.wrap(async (args: CheckUrlInput) => {
  if (!args.url || typeof args.url !== 'string') throw new Error('url is required')
  const url = args.url.trim()
  const data = await apiFetch<any>(`/wayback/available?url=${encodeURIComponent(url)}`)
  return {
    url: data.url,
    archived_snapshots: data.archived_snapshots,
  }
}, { method: 'check_url' })

const getSnapshot = sg.wrap(async (args: GetSnapshotInput) => {
  if (!args.url || typeof args.url !== 'string') throw new Error('url is required')
  const url = args.url.trim()
  const timestamp = typeof args.timestamp === 'string' ? args.timestamp.trim() : ''
  const data = await apiFetch<any>(`/wayback/available?url=${encodeURIComponent(url)}&timestamp=${encodeURIComponent(timestamp)}`)
  return {
    url: data.url,
    archived_snapshots: data.archived_snapshots,
  }
}, { method: 'get_snapshot' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { checkUrl, getSnapshot }

console.log('settlegrid-wayback-machine MCP server ready')
console.log('Methods: check_url, get_snapshot')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
