/**
 * settlegrid-uuid-generator — UUID Generator MCP Server
 *
 * Generates UUIDs locally with SettleGrid billing.
 * No API key needed — purely local generation.
 *
 * Methods:
 *   generate_uuid(count?) — generate UUIDs (1¢)
 *   parse_uuid(uuid) — parse UUID metadata (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'
import { randomUUID } from 'node:crypto'

interface GenerateInput { count?: number }
interface ParseInput { uuid: string }

const sg = settlegrid.init({
  toolSlug: 'uuid-generator',
  pricing: {
    defaultCostCents: 1,
    methods: {
      generate_uuid: { costCents: 1, displayName: 'Generate UUID' },
      parse_uuid: { costCents: 1, displayName: 'Parse UUID' },
    },
  },
})

const generateUuid = sg.wrap(async (args: GenerateInput) => {
  const count = Math.min(Math.max(args.count ?? 1, 1), 100)
  const uuids: string[] = []
  for (let i = 0; i < count; i++) uuids.push(randomUUID())
  return { count, uuids }
}, { method: 'generate_uuid' })

const parseUuid = sg.wrap(async (args: ParseInput) => {
  if (!args.uuid) throw new Error('uuid is required')
  const cleaned = args.uuid.replace(/[^0-9a-fA-F]/g, '')
  if (cleaned.length !== 32) throw new Error('Invalid UUID format')
  const version = parseInt(cleaned[12], 16)
  const variantBits = parseInt(cleaned[16], 16)
  let variant = 'unknown'
  if ((variantBits & 0x8) === 0) variant = 'NCS'
  else if ((variantBits & 0xc) === 0x8) variant = 'RFC4122'
  else if ((variantBits & 0xe) === 0xc) variant = 'Microsoft'
  else variant = 'Future'
  return {
    uuid: args.uuid, version, variant,
    is_nil: cleaned === '0'.repeat(32),
    hex: cleaned, bytes: cleaned.length / 2,
    urn: `urn:uuid:${args.uuid}`,
  }
}, { method: 'parse_uuid' })

export { generateUuid, parseUuid }

console.log('settlegrid-uuid-generator MCP server ready')
console.log('Methods: generate_uuid, parse_uuid')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
