/**
 * settlegrid-promptlayer — PromptLayer MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface GetRequestInput { request_id: number }
interface SearchRequestsInput { page?: number; per_page?: number; tags?: string }
interface GetPromptTemplateInput { prompt_name: string; version?: number }
interface ListPromptTemplatesInput { page?: number; per_page?: number }
interface CreateRequestLogInput { provider: string; model: string; prompt: string; response: string; latency_ms?: number }
interface AddRequestTagsInput { request_id: number; tags: string[] }

const BASE = 'https://api.promptlayer.com'

function getApiKey(): string {
  const k = process.env.PROMPTLAYER_API_KEY
  if (!k) throw new Error('PROMPTLAYER_API_KEY environment variable is required')
  return k
}

async function plFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const apiKey = getApiKey()
  const url = `${BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-promptlayer/1.0',
      'X-API-KEY': apiKey,
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`PromptLayer API ${res.status}: ${errText}`)
  }
  return res.json()
}

const sg = settlegrid.init({
  toolSlug: 'promptlayer',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_request: { costCents: 1, displayName: 'Get Request' },
      search_requests: { costCents: 2, displayName: 'Search Requests' },
      get_prompt_template: { costCents: 1, displayName: 'Get Prompt Template' },
      list_prompt_templates: { costCents: 1, displayName: 'List Prompt Templates' },
      create_request_log: { costCents: 3, displayName: 'Create Request Log' },
      add_request_tags: { costCents: 2, displayName: 'Add Request Tags' },
    },
  },
})

const getRequest = sg.wrap(async (args: GetRequestInput) => {
  if (!args.request_id) throw new Error('request_id is required')
  return plFetch(`/requests/${args.request_id}`)
}, { method: 'get_request' })

const searchRequests = sg.wrap(async (args: SearchRequestsInput) => {
  const page = Math.max(1, args.page || 1)
  const perPage = Math.min(args.per_page || 10, 50)
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  })
  if (args.tags) params.set('tags', args.tags)
  return plFetch(`/requests?${params.toString()}`)
}, { method: 'search_requests' })

const getPromptTemplate = sg.wrap(async (args: GetPromptTemplateInput) => {
  const name = args.prompt_name?.trim()
  if (!name) throw new Error('prompt_name is required')
  const params = new URLSearchParams({ prompt_name: name })
  if (args.version !== undefined) params.set('version', String(args.version))
  return plFetch(`/prompt-templates?${params.toString()}`)
}, { method: 'get_prompt_template' })

const listPromptTemplates = sg.wrap(async (args: ListPromptTemplatesInput) => {
  const page = Math.max(1, args.page || 1)
  const perPage = Math.min(args.per_page || 10, 50)
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  })
  return plFetch(`/prompt-templates/all?${params.toString()}`)
}, { method: 'list_prompt_templates' })

const createRequestLog = sg.wrap(async (args: CreateRequestLogInput) => {
  if (!args.provider?.trim()) throw new Error('provider is required')
  if (!args.model?.trim()) throw new Error('model is required')
  if (!args.prompt?.trim()) throw new Error('prompt is required')
  if (!args.response?.trim()) throw new Error('response is required')
  const body: Record<string, unknown> = {
    provider: args.provider.trim(),
    model: args.model.trim(),
    prompt: args.prompt.trim(),
    response: args.response.trim(),
  }
  if (args.latency_ms !== undefined) body.latency_ms = args.latency_ms
  return plFetch('/requests', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}, { method: 'create_request_log' })

const addRequestTags = sg.wrap(async (args: AddRequestTagsInput) => {
  if (!args.request_id) throw new Error('request_id is required')
  if (!args.tags || args.tags.length === 0) throw new Error('tags array must not be empty')
  return plFetch(`/requests/${args.request_id}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tags: args.tags }),
  })
}, { method: 'add_request_tags' })

export { getRequest, searchRequests, getPromptTemplate, listPromptTemplates, createRequestLog, addRequestTags }
console.log('settlegrid-promptlayer MCP server ready')
console.log('Methods: get_request, search_requests, get_prompt_template, list_prompt_templates, create_request_log, add_request_tags')
console.log('Pricing: 1-3¢ per call | Powered by SettleGrid')