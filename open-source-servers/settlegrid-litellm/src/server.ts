/**
 * settlegrid-litellm — LiteLLM Proxy MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface Message {
  role: string
  content: string
}

interface CreateChatCompletionInput {
  model: string
  messages: Message[]
  temperature?: number
  max_tokens?: number
}

interface CreateCompletionInput {
  model: string
  prompt: string
  temperature?: number
  max_tokens?: number
}

interface CreateEmbeddingsInput {
  model: string
  input: string | string[]
}

function getApiKey(): string {
  const k = process.env.LITELLM_API_KEY
  if (!k) throw new Error('LITELLM_API_KEY environment variable is required')
  return k
}

function getBaseUrl(): string {
  return process.env.LITELLM_BASE_URL || 'http://0.0.0.0:8000'
}

async function litellmFetch(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const apiKey = getApiKey()
  const base = getBaseUrl()
  const method = options.method || 'GET'
  const headers: Record<string, string> = {
    'User-Agent': 'settlegrid-litellm/1.0',
    'Authorization': `Bearer ${apiKey}`,
  }
  if (options.body) {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`LiteLLM API ${res.status}: ${errText}`)
  }
  return res.json()
}

const sg = settlegrid.init({
  toolSlug: 'litellm',
  pricing: {
    defaultCostCents: 2,
    methods: {
      create_chat_completion: { costCents: 5, displayName: 'Create Chat Completion' },
      create_completion: { costCents: 5, displayName: 'Create Text Completion' },
      create_embeddings: { costCents: 2, displayName: 'Create Embeddings' },
      list_models: { costCents: 1, displayName: 'List Models' },
      get_health: { costCents: 1, displayName: 'Get Health' },
    },
  },
})

const createChatCompletion = sg.wrap(async (args: CreateChatCompletionInput) => {
  const model = args.model?.trim()
  if (!model) throw new Error('model is required')
  if (!args.messages || !Array.isArray(args.messages) || args.messages.length === 0) {
    throw new Error('messages must be a non-empty array')
  }
  const body: Record<string, unknown> = {
    model,
    messages: args.messages,
  }
  if (args.temperature !== undefined) {
    body.temperature = Math.min(Math.max(args.temperature, 0), 2)
  }
  if (args.max_tokens !== undefined) {
    body.max_tokens = Math.min(Math.max(Math.floor(args.max_tokens), 1), 32768)
  }
  return litellmFetch('/chat/completions', { method: 'POST', body })
}, { method: 'create_chat_completion' })

const createCompletion = sg.wrap(async (args: CreateCompletionInput) => {
  const model = args.model?.trim()
  if (!model) throw new Error('model is required')
  const prompt = args.prompt?.trim()
  if (!prompt) throw new Error('prompt is required')
  const body: Record<string, unknown> = { model, prompt }
  if (args.temperature !== undefined) {
    body.temperature = Math.min(Math.max(args.temperature, 0), 2)
  }
  if (args.max_tokens !== undefined) {
    body.max_tokens = Math.min(Math.max(Math.floor(args.max_tokens), 1), 32768)
  }
  return litellmFetch('/completions', { method: 'POST', body })
}, { method: 'create_completion' })

const createEmbeddings = sg.wrap(async (args: CreateEmbeddingsInput) => {
  const model = args.model?.trim()
  if (!model) throw new Error('model is required')
  if (!args.input || (typeof args.input !== 'string' && !Array.isArray(args.input))) {
    throw new Error('input must be a string or array of strings')
  }
  return litellmFetch('/embeddings', { method: 'POST', body: { model, input: args.input } })
}, { method: 'create_embeddings' })

const listModels = sg.wrap(async (_args: Record<string, never>) => {
  return litellmFetch('/models', { method: 'GET' })
}, { method: 'list_models' })

const getHealth = sg.wrap(async (_args: Record<string, never>) => {
  return litellmFetch('/health', { method: 'GET' })
}, { method: 'get_health' })

export { createChatCompletion, createCompletion, createEmbeddings, listModels, getHealth }
console.log('settlegrid-litellm MCP server ready')
console.log('Methods: create_chat_completion, create_completion, create_embeddings, list_models, get_health')
console.log('Pricing: 1-5¢ per call | Powered by SettleGrid')