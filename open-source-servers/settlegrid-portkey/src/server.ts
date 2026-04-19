/**
 * settlegrid-portkey — Portkey Prompt API MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface RenderPromptInput {
  promptId: string
  variables?: Record<string, unknown>
}

interface ExecutePromptInput {
  promptId: string
  variables?: Record<string, unknown>
}

const BASE = 'https://api.portkey.ai'

function getApiKey(): string {
  const k = process.env.PORTKEY_API_KEY
  if (!k) throw new Error('PORTKEY_API_KEY environment variable is required')
  return k
}

const sg = settlegrid.init({
  toolSlug: 'portkey',
  pricing: {
    defaultCostCents: 1,
    methods: {
      render_prompt: { costCents: 1, displayName: 'Render Prompt' },
      execute_prompt: { costCents: 5, displayName: 'Execute Prompt' },
    },
  },
})

const renderPrompt = sg.wrap(async (args: RenderPromptInput) => {
  const promptId = args.promptId?.trim()
  if (!promptId) throw new Error('promptId is required')
  const apiKey = getApiKey()
  const body: Record<string, unknown> = {}
  if (args.variables && typeof args.variables === 'object') {
    body.variables = args.variables
  }
  const res = await fetch(`${BASE}/v1/prompts/${encodeURIComponent(promptId)}/render`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-portkey-api-key': apiKey,
      'User-Agent': 'settlegrid-portkey/1.0',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`Portkey API ${res.status}: ${errText}`)
  }
  return res.json()
}, { method: 'render_prompt' })

const executePrompt = sg.wrap(async (args: ExecutePromptInput) => {
  const promptId = args.promptId?.trim()
  if (!promptId) throw new Error('promptId is required')
  const apiKey = getApiKey()
  const body: Record<string, unknown> = { stream: false }
  if (args.variables && typeof args.variables === 'object') {
    body.variables = args.variables
  }
  const res = await fetch(`${BASE}/v1/prompts/${encodeURIComponent(promptId)}/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-portkey-api-key': apiKey,
      'User-Agent': 'settlegrid-portkey/1.0',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`Portkey API ${res.status}: ${errText}`)
  }
  return res.json()
}, { method: 'execute_prompt' })

export { renderPrompt, executePrompt }
console.log('settlegrid-portkey MCP server ready')
console.log('Methods: render_prompt, execute_prompt')
console.log('Pricing: render_prompt=1¢, execute_prompt=5¢ per call | Powered by SettleGrid')