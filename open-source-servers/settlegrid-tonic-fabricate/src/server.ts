/**
 * settlegrid-tonic-fabricate — Tonic Fabricate Synthetic Data MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface GenerateDataInput {
  schema: object
  numRows?: number
  seed?: number
}

const BASE = 'https://app.tonic.ai'

function getApiKey(): string {
  const k = process.env.TONIC_API_KEY
  if (!k) throw new Error('TONIC_API_KEY environment variable is required')
  return k
}

const sg = settlegrid.init({
  toolSlug: 'tonic-fabricate',
  pricing: {
    defaultCostCents: 5,
    methods: {
      generate_data: { costCents: 5, displayName: 'Generate Synthetic Data' },
    },
  },
})

const generateData = sg.wrap(async (args: GenerateDataInput) => {
  const apiKey = getApiKey()

  if (!args.schema || typeof args.schema !== 'object') {
    throw new Error('schema is required and must be an object')
  }

  const numRows = Math.min(args.numRows || 10, 1000)

  const body: Record<string, unknown> = {
    schema: args.schema,
    numRows,
  }
  if (args.seed !== undefined) {
    body.seed = args.seed
  }

  const res = await fetch(`${BASE}/api/v1/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `ApiKey ${apiKey}`,
      'User-Agent': 'settlegrid-tonic-fabricate/1.0',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown error')
    throw new Error(`Tonic Fabricate API error ${res.status}: ${errText.slice(0, 300)}`)
  }

  const data = await res.json()
  return {
    numRows,
    seed: args.seed ?? null,
    result: data,
  }
}, { method: 'generate_data' })

export { generateData }
console.log('settlegrid-tonic-fabricate MCP server ready')
console.log('Methods: generate_data')
console.log('Pricing: 5¢ per call | Powered by SettleGrid')