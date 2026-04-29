/**
 * settlegrid-openrouter — OpenRouter AI MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface Message {
  role: string
  content: string
}

interface CreateChatCompletionInput {
  model: string
  messages: Message[]
  max_tokens?: number
  temperature?: number
}

interface ListModelsInput {
  supported_parameters?: string
}

interface GetModelInput {
  model_id: string
}

interface GetGenerationInput {
  generation_id: string
}

type EmptyInput = Record<string, never>

const BASE = 'https://openrouter.ai'

function getApiKey(): string {
  const k = process.env.OPENROUTER_API_KEY
  if (!k) throw new Error('OPENROUTER_API_KEY environment variable is required')
  return k
}

function authHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json',
    'User-Agent': 'settlegrid-openrouter/1.0',
  }
}

const sg = settlegrid.init({
  toolSlug: 'openrouter',
  pricing: {
    defaultCostCents: 1,
    methods: {
      create_chat_completion: { costCents: 5, displayName: 'Create Chat Completion' },
      list_models: { costCents: 1, displayName: 'List Models' },
      get_model: { costCents: 1, displayName: 'Get Model' },
      get_generation: { costCents: 1, displayName: 'Get Generation' },
      get_credits: { costCents: 1, displayName: 'Get Credits' },
    },
  },
})

const createChatCompletion = sg.wrap(async (args: CreateChatCompletionInput) => {
  const model = args.model?.trim()
  if (!model) throw new Error('model is required')
  const messages = args.messages
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('messages array is required and must not be empty')
  }
  for (const msg of messages) {
    if (!msg.role || !msg.content) throw new Error('Each message must have role and content')
  }
  const max_tokens = Math.min(args.max_tokens ?? 1024, 4096)
  const temperature = Math.max(0, Math.min(args.temperature ?? 1.0, 2))
  const body = JSON.stringify({ model, messages, max_tokens, temperature, stream: false })
  const res = await fetch(`${BASE}/api/v1/chat/completions`, {
    method: 'POST',
    headers: authHeaders(),
    body,
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 400)
    throw new Error(`OpenRouter API ${res.status}: ${errText}`)
  }
  return res.json()
}, { method: 'create_chat_completion' })

const listModels = sg.wrap(async (args: ListModelsInput) => {
  const url = new URL(`${BASE}/api/v1/models`)
  if (args.supported_parameters?.trim()) {
    url.searchParams.set('supported_parameters', args.supported_parameters.trim())
  }
  const res = await fetch(url.toString(), {
    headers: authHeaders(),
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 400)
    throw new Error(`OpenRouter API ${res.status}: ${errText}`)
  }
  const data = await res.json() as { data: unknown[] }
  return { count: data.data?.length ?? 0, models: data.data }
}, { method: 'list_models' })

const getModel = sg.wrap(async (args: GetModelInput) => {
  const model_id = args.model_id?.trim()
  if (!model_id) throw new Error('model_id is required')
  const res = await fetch(`${BASE}/api/v1/models/${encodeURIComponent(model_id)}`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 400)
    throw new Error(`OpenRouter API ${res.status}: ${errText}`)
  }
  return res.json()
}, { method: 'get_model' })

const getGeneration = sg.wrap(async (args: GetGenerationInput) => {
  const generation_id = args.generation_id?.trim()
  if (!generation_id) throw new Error('generation_id is required')
  const res = await fetch(`${BASE}/api/v1/generation?id=${encodeURIComponent(generation_id)}`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 400)
    throw new Error(`OpenRouter API ${res.status}: ${errText}`)
  }
  return res.json()
}, { method: 'get_generation' })

const getCredits = sg.wrap(async (_args: EmptyInput) => {
  const res = await fetch(`${BASE}/api/v1/credits`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 400)
    throw new Error(`OpenRouter API ${res.status}: ${errText}`)
  }
  return res.json()
}, { method: 'get_credits' })

export { createChatCompletion, listModels, getModel, getGeneration, getCredits }
console.log('settlegrid-openrouter MCP server ready')
console.log('Methods: create_chat_completion, list_models, get_model, get_generation, get_credits')
console.log('Pricing: 1-5¢ per call | Powered by SettleGrid')