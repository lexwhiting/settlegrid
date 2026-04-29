/**
 * settlegrid-airbyte — Airbyte MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface CreateSourceInput {
  name: string
  workspaceId: string
  configuration: Record<string, unknown>
}

const BASE = 'https://api.airbyte.com/v1'

function getApiKey(): string {
  const k = process.env.AIRBYTE_API_KEY
  if (!k) throw new Error('AIRBYTE_API_KEY environment variable is required')
  return k
}

const sg = settlegrid.init({
  toolSlug: 'airbyte',
  pricing: {
    defaultCostCents: 5,
    methods: {
      create_source: { costCents: 5, displayName: 'Create Source' },
    },
  },
})

const createSource = sg.wrap(async (args: CreateSourceInput) => {
  const name = args.name?.trim()
  if (!name) throw new Error('name is required')
  const workspaceId = args.workspaceId?.trim()
  if (!workspaceId) throw new Error('workspaceId is required')
  if (!args.configuration || typeof args.configuration !== 'object') {
    throw new Error('configuration must be a non-null object')
  }

  const apiKey = getApiKey()

  const body = {
    name,
    workspaceId,
    configuration: args.configuration,
  }

  let res: Response
  try {
    res = await fetch(`${BASE}/sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'settlegrid-airbyte/1.0',
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    throw new Error(`Network error calling Airbyte API: ${String(err)}`)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Airbyte API error ${res.status}: ${text.slice(0, 300)}`)
  }

  const data = await res.json()
  return data
}, { method: 'create_source' })

export { createSource }
console.log('settlegrid-airbyte MCP server ready')
console.log('Methods: create_source')
console.log('Pricing: 5¢ per call | Powered by SettleGrid')