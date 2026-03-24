/**
 * settlegrid-port-check — Port Availability Check MCP Server
 *
 * Wraps HackerTarget API with SettleGrid billing.
 * No API key needed — free tier available.
 *
 * Methods:
 *   check_port(host, port) — Check specific port (1¢)
 *   scan_common(host) — Scan common ports (2¢)
 *   get_headers(url) — HTTP headers (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PortInput { host: string; port: number }
interface ScanInput { host: string }
interface HeadersInput { url: string }

interface PortResult {
  host: string
  port: number
  state: string
  service?: string
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

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'port-check',
  pricing: {
    defaultCostCents: 1,
    methods: {
      check_port: { costCents: 1, displayName: 'Check Port' },
      scan_common: { costCents: 2, displayName: 'Common Port Scan' },
      get_headers: { costCents: 1, displayName: 'HTTP Headers' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const checkPort = sg.wrap(async (args: PortInput) => {
  if (!args.host) throw new Error('host is required')
  if (!args.port || args.port < 1 || args.port > 65535) throw new Error('port must be 1-65535')
  const host = validateHost(args.host)
  const text = await apiText(`/nmap?q=${host} -p ${args.port}`)
  const isOpen = text.toLowerCase().includes('open')
  return {
    host,
    port: args.port,
    state: isOpen ? 'open' : 'closed/filtered',
    raw: text.trim(),
  }
}, { method: 'check_port' })

const scanCommon = sg.wrap(async (args: ScanInput) => {
  if (!args.host) throw new Error('host is required')
  const host = validateHost(args.host)
  const text = await apiText(`/nmap?q=${host}`)
  const lines = text.trim().split('\n')
  const ports: PortResult[] = []
  for (const line of lines) {
    const match = line.match(/(\d+)\/tcp\s+(\S+)\s+(.*)/)
    if (match) {
      ports.push({ host, port: parseInt(match[1]), state: match[2], service: match[3].trim() })
    }
  }
  return {
    host,
    ports,
    open_count: ports.filter(p => p.state === 'open').length,
    total_scanned: ports.length,
    raw: text.trim(),
  }
}, { method: 'scan_common' })

const getHeaders = sg.wrap(async (args: HeadersInput) => {
  if (!args.url) throw new Error('url is required')
  let url = args.url.trim()
  if (!url.startsWith('http')) url = `https://${url}`
  const text = await apiText(`/httpheaders?q=${encodeURIComponent(url)}`)
  const headers: Record<string, string> = {}
  for (const line of text.trim().split('\n')) {
    const idx = line.indexOf(':')
    if (idx > 0) {
      headers[line.substring(0, idx).trim()] = line.substring(idx + 1).trim()
    }
  }
  return {
    url,
    headers,
    header_count: Object.keys(headers).length,
    raw: text.trim(),
  }
}, { method: 'get_headers' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { checkPort, scanCommon, getHeaders }

console.log('settlegrid-port-check MCP server ready')
console.log('Methods: check_port, scan_common, get_headers')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
