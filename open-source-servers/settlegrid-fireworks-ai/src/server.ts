/**
 * settlegrid-fireworks-ai — Fireworks AI Inference MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.fireworks.ai/inference'

interface Message {
  role: string
  content: string
}

interface ChatCompletionInput {
  model: string
  messages: Message[]
  max_tokens?: number
  temperature?: number
}

interface TextCompletionInput {
  model: string
  prompt: string
  max_tokens?: number
  temperature?: number
}

interface EmbeddingsInput {
  model: string
  input: string | string[]
}

interface ImageGenerationInput {
  model: string
  prompt: string
  n?: number
  height?: number
  width?: number
}

interface GetModelInput {
  model_id: string
}

function getApiKey(): string {
  const k = process.env.FIREWORKS_API_KEY
  if (!k) throw new Error('FIREWORKS_API_KEY environment variable is required')
  return k
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const key = getApiKey()
  const url = `${BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-fireworks-ai/1.0',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`Fireworks AI API ${res.status}: ${errText}`)
  }
  return res.json()
}

const sg = settlegrid.init({
  toolSlug: 'fireworks-ai',
  pricing: {
    defaultCostCents: 5,
    methods: {
      create_chat_completion: { costCents: 5, displayName: 'Create Chat Completion' },
      create_text_completion: { costCents: 5, displayName: 'Create Text Completion' },
      create_embeddings: { costCents: 2, displayName: 'Create Embeddings' },
      create_image: { costCents: 8, displayName: 'Create Image' },
      list_models: { costCents: 1, displayName: 'List Models' },
      get_model: { costCents: 1, displayName: 'Get Model' },
    },
  },
})

const createChatCompletion = sg.wrap(async (args: ChatCompletionInput) => {
  const model = args.model?.trim()
  if (!model) throw new Error('model is required')
  if (!Array.isArray(args.messages) || args.messages.length === 0) {
    throw new Error('messages must be a non-empty array')
  }
  const max_tokens = Math.min(args.max_tokens || 512, 4096)
  const temperature = Math.min(Math.max(args.temperature ?? 0.7, 0), 2)
  return apiFetch('/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({ model, messages: args.messages, max_tokens, temperature }),
  })
}, { method: 'create_chat_completion' })

const createTextCompletion = sg.wrap(async (args: TextCompletionInput) => {
  const model = args.model?.trim()
  if (!model) throw new Error('model is required')
  const prompt = args.prompt?.trim()
  if (!prompt) throw new Error('prompt is required')
  const max_tokens = Math.min(args.max_tokens || 256, 4096)
  const temperature = Math.min(Math.max(args.temperature ?? 0.7, 0), 2)
  return apiFetch('/v1/completions', {
    method: 'POST',
    body: JSON.stringify({ model, prompt, max_tokens, temperature }),
  })
}, { method: 'create_text_completion' })

const createEmbeddings = sg.wrap(async (args: EmbeddingsInput) => {
  const model = args.model?.trim()
  if (!model) throw new Error('model is required')
  if (!args.input || (Array.isArray(args.input) && args.input.length === 0)) {
    throw new Error('input is required')
  }
  return apiFetch('/v1/embeddings', {
    method: 'POST',
    body: JSON.stringify({ model, input: args.input }),
  })
}, { method: 'create_embeddings' })

const createImage = sg.wrap(async (args: ImageGenerationInput) => {
  const model = args.model?.trim()
  if (!model) throw new Error('model is required')
  const prompt = args.prompt?.trim()
  if (!prompt) throw new Error('prompt is required')
  const n = Math.min(args.n || 1, 4)
  const height = args.height || 1024
  const width = args.width || 1024
  return apiFetch('/v1/images/generations', {
    method: 'POST',
    body: JSON.stringify({ model, prompt, n, height, width }),
  })
}, { method: 'create_image' })

const listModels = sg.wrap(async () => {
  return apiFetch('/v1/models', { method: 'GET' })
}, { method: 'list_models' })

const getModel = sg.wrap(async (args: GetModelInput) => {
  const model_id = args.model_id?.trim()
  if (!model_id) throw new Error('model_id is required')
  return apiFetch(`/v1/models/${encodeURIComponent(model_id)}`, { method: 'GET' })
}, { method: 'get_model' })

export { createChatCompletion, createTextCompletion, createEmbeddings, createImage, listModels, getModel }
console.log('settlegrid-fireworks-ai MCP server ready')
console.log('Methods: create_chat_completion, create_text_completion, create_embeddings, create_image, list_models, get_model')
console.log('Pricing: 1-8¢ per call | Powered by SettleGrid')