/**
 * settlegrid-prompt-hub — Prompt Hub MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface ListPromptsInput { limit?: number }
interface GetPromptInput { id: string }
interface CreatePromptInput { name: string; content: string; description?: string }
interface UpdatePromptInput { id: string; name?: string; content?: string; description?: string }
interface DeletePromptInput { id: string }

const BASE = 'https://app.prompthub.us'

function getApiKey(): string {
  const k = process.env.PROMPTHUB_API_KEY
  if (!k) throw new Error('PROMPTHUB_API_KEY environment variable is required')
  return k
}

async function apiFetch(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const apiKey = getApiKey()
  const init: RequestInit = {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-prompt-hub/1.0',
    },
  }
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body)
  }
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300)
    throw new Error(`PromptHub API ${res.status}: ${text}`)
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return { success: true }
  }
  return res.json()
}

const sg = settlegrid.init({
  toolSlug: 'prompt-hub',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_prompts: { costCents: 1, displayName: 'List Prompts' },
      get_prompt: { costCents: 1, displayName: 'Get Prompt' },
      create_prompt: { costCents: 3, displayName: 'Create Prompt' },
      update_prompt: { costCents: 3, displayName: 'Update Prompt' },
      delete_prompt: { costCents: 2, displayName: 'Delete Prompt' },
    },
  },
})

const listPrompts = sg.wrap(async (args: ListPromptsInput) => {
  const limit = Math.min(args.limit || 20, 50)
  const data = await apiFetch(`/api/v1/prompts?limit=${limit}`) as { data?: unknown[]; prompts?: unknown[] } | unknown[]
  return data
}, { method: 'list_prompts' })

const getPrompt = sg.wrap(async (args: GetPromptInput) => {
  const id = args.id?.trim()
  if (!id) throw new Error('id is required')
  const data = await apiFetch(`/api/v1/prompts/${encodeURIComponent(id)}`)
  return data
}, { method: 'get_prompt' })

const createPrompt = sg.wrap(async (args: CreatePromptInput) => {
  const name = args.name?.trim()
  if (!name) throw new Error('name is required')
  const content = args.content?.trim()
  if (!content) throw new Error('content is required')
  const body: Record<string, string> = { name, content }
  if (args.description?.trim()) body.description = args.description.trim()
  const data = await apiFetch('/api/v1/prompts', { method: 'POST', body })
  return data
}, { method: 'create_prompt' })

const updatePrompt = sg.wrap(async (args: UpdatePromptInput) => {
  const id = args.id?.trim()
  if (!id) throw new Error('id is required')
  const body: Record<string, string> = {}
  if (args.name?.trim()) body.name = args.name.trim()
  if (args.content?.trim()) body.content = args.content.trim()
  if (args.description?.trim()) body.description = args.description.trim()
  if (Object.keys(body).length === 0) throw new Error('At least one of name, content, or description must be provided')
  const data = await apiFetch(`/api/v1/prompts/${encodeURIComponent(id)}`, { method: 'PUT', body })
  return data
}, { method: 'update_prompt' })

const deletePrompt = sg.wrap(async (args: DeletePromptInput) => {
  const id = args.id?.trim()
  if (!id) throw new Error('id is required')
  const data = await apiFetch(`/api/v1/prompts/${encodeURIComponent(id)}`, { method: 'DELETE' })
  return data
}, { method: 'delete_prompt' })

export { listPrompts, getPrompt, createPrompt, updatePrompt, deletePrompt }
console.log('settlegrid-prompt-hub MCP server ready')
console.log('Methods: list_prompts, get_prompt, create_prompt, update_prompt, delete_prompt')
console.log('Pricing: 1-3¢ per call | Powered by SettleGrid')