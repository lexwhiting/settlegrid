/**
 * settlegrid-bgp-data — BGP Routing Data MCP Server
 *
 * Wraps RIPE Stat API with SettleGrid billing.
 * No API key needed — RIPE Stat is free and public.
 *
 * Methods:
 *   get_prefixes(asn) — Announced prefixes (1¢)
 *   get_routing_status(prefix) — Routing status (1¢)
 *   get_asn_info(asn) — ASN information (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PrefixInput { asn: string }
interface RoutingInput { prefix: string }
interface AsnInput { asn: string }

interface RipeResponse {
  status: string
  data: any
  query_id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://stat.ripe.net/data'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function normalizeAsn(asn: string): string {
  const s = asn.trim().toUpperCase()
  return s.startsWith('AS') ? s.replace('AS', '') : s
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'bgp-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_prefixes: { costCents: 1, displayName: 'ASN Prefixes' },
      get_routing_status: { costCents: 1, displayName: 'Routing Status' },
      get_asn_info: { costCents: 1, displayName: 'ASN Info' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPrefixes = sg.wrap(async (args: PrefixInput) => {
  if (!args.asn) throw new Error('asn is required')
  const asn = normalizeAsn(args.asn)
  const data = await apiFetch<RipeResponse>(`/announced-prefixes/data.json?resource=AS${asn}`)
  return {
    asn: `AS${asn}`,
    prefixes: data.data?.prefixes || [],
    count: data.data?.prefixes?.length || 0,
    query_id: data.query_id,
  }
}, { method: 'get_prefixes' })

const getRoutingStatus = sg.wrap(async (args: RoutingInput) => {
  if (!args.prefix) throw new Error('prefix is required')
  const data = await apiFetch<RipeResponse>(`/routing-status/data.json?resource=${encodeURIComponent(args.prefix)}`)
  return {
    prefix: args.prefix,
    status: data.data,
    query_id: data.query_id,
  }
}, { method: 'get_routing_status' })

const getAsnInfo = sg.wrap(async (args: AsnInput) => {
  if (!args.asn) throw new Error('asn is required')
  const asn = normalizeAsn(args.asn)
  const data = await apiFetch<RipeResponse>(`/as-overview/data.json?resource=AS${asn}`)
  return {
    asn: `AS${asn}`,
    info: data.data,
    query_id: data.query_id,
  }
}, { method: 'get_asn_info' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPrefixes, getRoutingStatus, getAsnInfo }

console.log('settlegrid-bgp-data MCP server ready')
console.log('Methods: get_prefixes, get_routing_status, get_asn_info')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
