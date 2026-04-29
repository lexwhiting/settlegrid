/**
 * settlegrid-leonardo-ai — Leonardo.ai Image Generation MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://cloud.leonardo.ai/api/rest/v1'

interface CreateGenerationInput {
  prompt: string
  modelId?: string
  width?: number
  height?: number
  num_images?: number
  negative_prompt?: string
  guidance_scale?: number
  num_inference_steps?: number
  presetStyle?: string
  alchemy?: boolean
  photoReal?: boolean
  seed?: number
}

interface GetGenerationInput {
  generationId: string
}

interface DeleteGenerationInput {
  generationId: string
}

interface ListPlatformModelsInput {
  limit?: number
  offset?: number
}

function getApiKey(): string {
  const k = process.env.LEONARDO_API_KEY
  if (!k) throw new Error('LEONARDO_API_KEY environment variable is required')
  return k
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const apiKey = getApiKey()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-leonardo-ai/1.0',
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown error')
    throw new Error(`Leonardo.ai API error ${res.status}: ${errText.slice(0, 300)}`)
  }
  return res.json()
}

const sg = settlegrid.init({
  toolSlug: 'leonardo-ai',
  pricing: {
    defaultCostCents: 1,
    methods: {
      create_generation: { costCents: 8, displayName: 'Create Generation' },
      get_generation: { costCents: 1, displayName: 'Get Generation' },
      delete_generation: { costCents: 2, displayName: 'Delete Generation' },
      get_user_info: { costCents: 1, displayName: 'Get User Info' },
      list_platform_models: { costCents: 1, displayName: 'List Platform Models' },
    },
  },
})

const createGeneration = sg.wrap(async (args: CreateGenerationInput) => {
  const prompt = args.prompt?.trim()
  if (!prompt) throw new Error('prompt is required')

  const width = Math.min(Math.max(args.width || 512, 32), 1536)
  const height = Math.min(Math.max(args.height || 512, 32), 1536)
  const num_images = Math.min(Math.max(args.num_images || 1, 1), 4)
  const num_inference_steps = Math.min(args.num_inference_steps || 30, 60)
  const guidance_scale = Math.min(Math.max(args.guidance_scale || 7, 1), 20)

  const body: Record<string, unknown> = {
    prompt,
    width,
    height,
    num_images,
    guidance_scale,
    num_inference_steps,
  }

  if (args.modelId) body.modelId = args.modelId
  if (args.negative_prompt) body.negative_prompt = args.negative_prompt
  if (args.presetStyle) body.presetStyle = args.presetStyle
  if (typeof args.alchemy === 'boolean') body.alchemy = args.alchemy
  if (typeof args.photoReal === 'boolean') body.photoReal = args.photoReal
  if (args.seed !== undefined) body.seed = args.seed

  const data = await apiFetch('/generations', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return data
}, { method: 'create_generation' })

const getGeneration = sg.wrap(async (args: GetGenerationInput) => {
  const id = args.generationId?.trim()
  if (!id) throw new Error('generationId is required')
  return apiFetch(`/generations/${encodeURIComponent(id)}`)
}, { method: 'get_generation' })

const deleteGeneration = sg.wrap(async (args: DeleteGenerationInput) => {
  const id = args.generationId?.trim()
  if (!id) throw new Error('generationId is required')
  return apiFetch(`/generations/${encodeURIComponent(id)}`, { method: 'DELETE' })
}, { method: 'delete_generation' })

const getUserInfo = sg.wrap(async (_args: Record<string, never>) => {
  return apiFetch('/me')
}, { method: 'get_user_info' })

const listPlatformModels = sg.wrap(async (args: ListPlatformModelsInput) => {
  const limit = Math.min(args.limit || 10, 50)
  const offset = Math.max(args.offset || 0, 0)
  return apiFetch(`/platformModels?limit=${limit}&offset=${offset}`)
}, { method: 'list_platform_models' })

export { createGeneration, getGeneration, deleteGeneration, getUserInfo, listPlatformModels }

console.log('settlegrid-leonardo-ai MCP server ready')
console.log('Methods: create_generation, get_generation, delete_generation, get_user_info, list_platform_models')
console.log('Pricing: 1-8¢ per call | Powered by SettleGrid')