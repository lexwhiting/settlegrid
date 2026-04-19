/**
 * settlegrid-comet-ml — Comet ML MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://www.comet.com'

function getApiKey(): string {
  const k = process.env.COMET_ML_API_KEY
  if (!k) throw new Error('COMET_ML_API_KEY environment variable is required')
  return k
}

async function cometFetch(path: string): Promise<unknown> {
  const apiKey = getApiKey()
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-comet-ml/1.0',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Comet ML API error ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

const sg = settlegrid.init({
  toolSlug: 'comet-ml',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_user_workspaces: { costCents: 1, displayName: 'Get User Workspaces' },
    },
  },
})

const getUserWorkspaces = sg.wrap(async () => {
  const data = await cometFetch('/api/rest/v2/user/workspaces')
  return data
}, { method: 'get_user_workspaces' })

export { getUserWorkspaces }
console.log('settlegrid-comet-ml MCP server ready')
console.log('Methods: get_user_workspaces')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')