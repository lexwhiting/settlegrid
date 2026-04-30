/**
 * settlegrid-portkey-prompts — Portkey Prompts MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface RunPromptInput {
  promptID: string
  variables?: Record<string, string>
  stream?: boolean
}

const BASE = 'https://api.portkey.ai'

function getApiKey(): string {
  const k = process.env.PORTKEY_API_KEY
  if (!k) throw new Error('PORTKEY_API_KEY environment variable is required')
  return k
}

const sg = settlegrid.init({
  toolSlug: 'portkey-prompts',
  pricing: {
    defaultCostCents: 5,
    methods: {
      run_prompt: { costCents: 5, displayName: 'Run Prompt Template' },
    },
  },
})

const runPrompt = sg.wrap(async (args: RunPromptInput) => {
  const promptID = args.promptID?.trim()
  if (!promptID) throw new Error('promptID is required')

  const apiKey = getApiKey()

  const body: Record<string, unknown> = {}
  if (args.variables && typeof args.variables === 'object') {
    body.variables = args.variables
  }
  if (args.stream !== undefined) {
    body.stream = Boolean(args.stream)
  } else {
    body.stream = false
  }

  const res = await fetch(`${BASE}/v1/prompts/${encodeURIComponent(promptID)}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-portkey-api-key': apiKey,
      'User-Agent': 'settlegrid-portkey-prompts/1.0',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`Portkey API error ${res.status}: ${errText}`)
  }

  const data = await res.json()
  return data
}, { method: 'run_prompt' })

export { runPrompt }
console.log('settlegrid-portkey-prompts MCP server ready')
console.log('Methods: run_prompt')
console.log('Pricing: 5¢ per call | Powered by SettleGrid')