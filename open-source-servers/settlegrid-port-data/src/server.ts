/**
 * settlegrid-port-data — Port Call Data MCP Server
 *
 * Port call schedules and vessel visits from Digitraffic.
 *
 * Methods:
 *   get_port_calls()              — Get recent port calls  (1¢)
 *   get_port_call(port_call_id)   — Get details for a specific port call  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetPortCallsInput {

}

interface GetPortCallInput {
  port_call_id: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://meri.digitraffic.fi/api/port-call/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-port-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Port Call Data API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'port-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_port_calls: { costCents: 1, displayName: 'Port Calls' },
      get_port_call: { costCents: 1, displayName: 'Port Call Detail' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPortCalls = sg.wrap(async (args: GetPortCallsInput) => {

  const data = await apiFetch<any>(`/port-calls`)
  const items = (data.portCalls ?? []).slice(0, 15)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        portCallId: item.portCallId,
        portToVisit: item.portToVisit,
        vesselName: item.vesselName,
        eta: item.eta,
        ata: item.ata,
    })),
  }
}, { method: 'get_port_calls' })

const getPortCall = sg.wrap(async (args: GetPortCallInput) => {
  if (typeof args.port_call_id !== 'number') throw new Error('port_call_id is required and must be a number')
  const port_call_id = args.port_call_id
  const data = await apiFetch<any>(`/port-calls/${port_call_id}`)
  return {
    portCallId: data.portCallId,
    portToVisit: data.portToVisit,
    vesselName: data.vesselName,
    nationality: data.nationality,
    eta: data.eta,
    ata: data.ata,
    etd: data.etd,
    atd: data.atd,
  }
}, { method: 'get_port_call' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPortCalls, getPortCall }

console.log('settlegrid-port-data MCP server ready')
console.log('Methods: get_port_calls, get_port_call')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
