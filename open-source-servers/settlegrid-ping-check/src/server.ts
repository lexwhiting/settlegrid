/**
 * settlegrid-ping-check — Ping & Uptime Check MCP Server
 *
 * Wraps HackerTarget API with SettleGrid billing.
 * No API key needed — free tier available.
 *
 * Methods:
 *   ping(host) — Ping latency stats (1¢)
 *   traceroute(host) — Traceroute (2¢)
 *   check_http(url) — HTTP check (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PingInput { host: string }
interface TracerouteInput { host: string }
interface HttpInput { url: string }

interface PingStats {
  host: string
  packets_sent: number
  packets_received: number
  loss_percent: number
  min_ms: number | null
  avg_ms: number | null
  max_ms: number | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.hackertarget.com'

async function apiText(path: string): Promise<string> {
  const url = `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.text()
}

function validateHost(host: string): string {
  const h = host.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[:\/].*$/, '')
  if (!h) throw new Error('Invalid host')
  return h
}

function parsePingStats(text: string, host: string): PingStats {
  const lossMatch = text.match(/(\d+(?:\.\d+)?)% packet loss/)
  const rttMatch = text.match(/=\s*([\d.]+)\/([\d.]+)\/([\d.]+)/)
  const sentMatch = text.match(/(\d+) packets transmitted/)
  const recvMatch = text.match(/(\d+) (?:packets )?received/)
  return {
    host,
    packets_sent: sentMatch ? parseInt(sentMatch[1]) : 0,
    packets_received: recvMatch ? parseInt(recvMatch[1]) : 0,
    loss_percent: lossMatch ? parseFloat(lossMatch[1]) : 100,
    min_ms: rttMatch ? parseFloat(rttMatch[1]) : null,
    avg_ms: rttMatch ? parseFloat(rttMatch[2]) : null,
    max_ms: rttMatch ? parseFloat(rttMatch[3]) : null,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'ping-check',
  pricing: {
    defaultCostCents: 1,
    methods: {
      ping: { costCents: 1, displayName: 'Ping Host' },
      traceroute: { costCents: 2, displayName: 'Traceroute' },
      check_http: { costCents: 1, displayName: 'HTTP Check' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const ping = sg.wrap(async (args: PingInput) => {
  if (!args.host) throw new Error('host is required')
  const host = validateHost(args.host)
  const text = await apiText(`/ping?q=${host}`)
  const stats = parsePingStats(text, host)
  return { ...stats, raw: text.trim() }
}, { method: 'ping' })

const traceroute = sg.wrap(async (args: TracerouteInput) => {
  if (!args.host) throw new Error('host is required')
  const host = validateHost(args.host)
  const text = await apiText(`/mtr?q=${host}`)
  const hops = text.trim().split('\n').filter(l => l.match(/^\s*\d/)).map(line => {
    const parts = line.trim().split(/\s+/)
    return { hop: parseInt(parts[0]) || 0, host: parts[1] || '*', loss: parts[2] || '', avg_ms: parts[5] || '' }
  })
  return { host, hops, hop_count: hops.length, raw: text.trim() }
}, { method: 'traceroute' })

const checkHttp = sg.wrap(async (args: HttpInput) => {
  if (!args.url) throw new Error('url is required')
  let url = args.url.trim()
  if (!url.startsWith('http')) url = `https://${url}`
  const start = Date.now()
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15000) })
    return {
      url,
      is_up: res.ok,
      status_code: res.status,
      response_time_ms: Date.now() - start,
      headers: Object.fromEntries(res.headers.entries()),
    }
  } catch (err: any) {
    return {
      url,
      is_up: false,
      status_code: null,
      response_time_ms: Date.now() - start,
      error: err.message,
    }
  }
}, { method: 'check_http' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { ping, traceroute, checkHttp }

console.log('settlegrid-ping-check MCP server ready')
console.log('Methods: ping, traceroute, check_http')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
