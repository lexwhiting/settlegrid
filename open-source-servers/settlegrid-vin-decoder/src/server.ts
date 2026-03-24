/**
 * settlegrid-vin-decoder — VIN Decoder MCP Server
 *
 * Decode Vehicle Identification Numbers via the NHTSA VPIC API.
 *
 * Methods:
 *   decode_vin(vin)               — Decode a 17-char VIN to get vehicle specs  (1¢)
 *   decode_vin_batch(vins)        — Decode multiple VINs (semicolon-separated)  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DecodeVinInput {
  vin: string
}

interface DecodeVinBatchInput {
  vins: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-vin-decoder/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`VIN Decoder API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'vin-decoder',
  pricing: {
    defaultCostCents: 1,
    methods: {
      decode_vin: { costCents: 1, displayName: 'Decode VIN' },
      decode_vin_batch: { costCents: 1, displayName: 'Batch Decode VINs' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const decodeVin = sg.wrap(async (args: DecodeVinInput) => {
  if (!args.vin || typeof args.vin !== 'string') throw new Error('vin is required')
  const vin = args.vin.trim()
  const data = await apiFetch<any>(`/DecodeVin/${encodeURIComponent(vin)}?format=json`)
  const items = (data.Results ?? []).slice(0, 25)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        Variable: item.Variable,
        Value: item.Value,
        ValueId: item.ValueId,
    })),
  }
}, { method: 'decode_vin' })

const decodeVinBatch = sg.wrap(async (args: DecodeVinBatchInput) => {
  if (!args.vins || typeof args.vins !== 'string') throw new Error('vins is required')
  const vins = args.vins.trim()
  const data = await apiFetch<any>(`/DecodeVINValuesBatch/${encodeURIComponent(vins)}?format=json`)
  const items = (data.Results ?? []).slice(0, 20)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        VIN: item.VIN,
        Variable: item.Variable,
        Value: item.Value,
    })),
  }
}, { method: 'decode_vin_batch' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { decodeVin, decodeVinBatch }

console.log('settlegrid-vin-decoder MCP server ready')
console.log('Methods: decode_vin, decode_vin_batch')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
