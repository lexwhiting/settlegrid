/**
 * settlegrid-uuid-gen — UUID Generator MCP Server
 *
 * Generate UUIDs (v4) singly or in bulk.
 *
 * Methods:
 *   generate_v4()                 — Generate a single UUID v4  (1¢)
 *   generate_bulk(count)          — Generate multiple UUIDs  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'
import { randomUUID } from 'node:crypto'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GenerateV4Input {}

interface GenerateBulkInput {
  count?: number
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'uuid-gen',
  pricing: {
    defaultCostCents: 1,
    methods: {
      generate_v4: { costCents: 1, displayName: 'Generate UUID v4' },
      generate_bulk: { costCents: 1, displayName: 'Generate Bulk' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const generateV4 = sg.wrap(async (_args: GenerateV4Input) => {
  return { uuid: randomUUID() }
}, { method: 'generate_v4' })

const generateBulk = sg.wrap(async (args: GenerateBulkInput) => {
  const count = Math.min(Math.max(typeof args.count === 'number' ? args.count : 5, 1), 100)
  const uuids: string[] = []
  for (let i = 0; i < count; i++) uuids.push(randomUUID())
  return { uuids, count: uuids.length }
}, { method: 'generate_bulk' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { generateV4, generateBulk }

console.log('settlegrid-uuid-gen MCP server ready')
console.log('Methods: generate_v4, generate_bulk')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
