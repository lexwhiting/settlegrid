/**
 * settlegrid-downdetector — Service Outage Monitor MCP Server
 *
 * Wraps public service status checking with SettleGrid billing.
 * No API key needed — uses public HTTP checks.
 *
 * Methods:
 *   check_status(domain) — Check if service is up (1¢)
 *   get_recent_outages(limit?) — Recent outages (1¢)
 *   list_services() — Monitored services (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface StatusInput { domain: string }
interface OutagesInput { limit?: number }

interface StatusResult {
  domain: string
  is_up: boolean
  response_time_ms: number | null
  status_code: number | null
  checked_at: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const POPULAR_SERVICES = [
  'google.com', 'youtube.com', 'facebook.com', 'twitter.com', 'instagram.com',
  'reddit.com', 'netflix.com', 'amazon.com', 'github.com', 'discord.com',
  'twitch.tv', 'spotify.com', 'slack.com', 'zoom.us', 'microsoft.com',
  'apple.com', 'cloudflare.com', 'aws.amazon.com', 'azure.microsoft.com',
  'outlook.com', 'gmail.com', 'dropbox.com', 'steam.com', 'paypal.com',
]

function normalizeDomain(domain: string): string {
  let d = domain.trim().toLowerCase()
  d = d.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (!d.includes('.')) throw new Error('Invalid domain format')
  return d
}

async function checkDomain(domain: string): Promise<StatusResult> {
  const start = Date.now()
  try {
    const res = await fetch(`https://${domain}`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000),
    })
    return {
      domain,
      is_up: res.ok || res.status < 500,
      response_time_ms: Date.now() - start,
      status_code: res.status,
      checked_at: new Date().toISOString(),
    }
  } catch (err) {
    return {
      domain,
      is_up: false,
      response_time_ms: null,
      status_code: null,
      checked_at: new Date().toISOString(),
    }
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'downdetector',
  pricing: {
    defaultCostCents: 1,
    methods: {
      check_status: { costCents: 1, displayName: 'Check Status' },
      get_recent_outages: { costCents: 1, displayName: 'Recent Outages' },
      list_services: { costCents: 1, displayName: 'List Services' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const checkStatus = sg.wrap(async (args: StatusInput) => {
  if (!args.domain) throw new Error('domain is required')
  const domain = normalizeDomain(args.domain)
  return checkDomain(domain)
}, { method: 'check_status' })

const getRecentOutages = sg.wrap(async (args: OutagesInput) => {
  const limit = args.limit ?? 10
  if (limit < 1 || limit > 50) throw new Error('limit must be 1-50')
  const services = POPULAR_SERVICES.slice(0, limit)
  const results = await Promise.all(services.map(d => checkDomain(d)))
  const down = results.filter(r => !r.is_up)
  return {
    checked: results.length,
    down_count: down.length,
    down_services: down,
    all_results: results,
  }
}, { method: 'get_recent_outages' })

const listServices = sg.wrap(async () => {
  return {
    services: POPULAR_SERVICES.map(d => ({ domain: d, category: 'popular' })),
    count: POPULAR_SERVICES.length,
  }
}, { method: 'list_services' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { checkStatus, getRecentOutages, listServices }

console.log('settlegrid-downdetector MCP server ready')
console.log('Methods: check_status, get_recent_outages, list_services')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
