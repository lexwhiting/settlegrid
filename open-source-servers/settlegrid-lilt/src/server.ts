/**
 * settlegrid-lilt — Lilt Translation & Content MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.lilt.com'
const SLUG = 'lilt'

function getApiKey(): string {
  const k = process.env.LILT_API_KEY
  if (!k) throw new Error('LILT_API_KEY environment variable is required')
  return k
}

function basicAuthHeader(): string {
  const key = getApiKey()
  const encoded = Buffer.from(`${key}:${key}`).toString('base64')
  return `Basic ${encoded}`
}

async function liltFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const url = `${BASE}${path}`
  const headers: Record<string, string> = {
    'Authorization': basicAuthHeader(),
    'Content-Type': 'application/json',
    'User-Agent': `settlegrid-${SLUG}/1.0`,
    ...(options.headers as Record<string, string> || {}),
  }
  const res = await fetch(url, { ...options, headers })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Lilt API ${res.status}: ${text.slice(0, 300)}`)
  }
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return res.json()
  return res.text()
}

interface GetCreateContentByIdInput { contentId: number }
interface CreateContentInput { language: string; topic: string; tone?: string }
interface DeleteCreateContentInput { contentId: number }
interface GetFilesInput { name?: string }
interface RegenerateCreateContentInput { contentId: number }

const sg = settlegrid.init({
  toolSlug: SLUG,
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_create_content: { costCents: 1, displayName: 'Get Create Content' },
      get_create_content_by_id: { costCents: 1, displayName: 'Get Create Content By ID' },
      create_content: { costCents: 5, displayName: 'Create Content' },
      delete_create_content: { costCents: 2, displayName: 'Delete Create Content' },
      get_create_preferences: { costCents: 1, displayName: 'Get Create Preferences' },
      get_domains: { costCents: 1, displayName: 'Get Domains' },
      get_files: { costCents: 1, displayName: 'Get Files' },
      regenerate_create_content: { costCents: 5, displayName: 'Regenerate Create Content' },
    },
  },
})

const getCreateContent = sg.wrap(async () => {
  return liltFetch('/v2/create')
}, { method: 'get_create_content' })

const getCreateContentById = sg.wrap(async (args: GetCreateContentByIdInput) => {
  if (args.contentId == null) throw new Error('contentId is required')
  const id = Math.floor(args.contentId)
  return liltFetch(`/v2/create/${id}`)
}, { method: 'get_create_content_by_id' })

const createContent = sg.wrap(async (args: CreateContentInput) => {
  const language = args.language?.trim()
  const topic = args.topic?.trim()
  if (!language) throw new Error('language is required')
  if (!topic) throw new Error('topic is required')
  const body: Record<string, unknown> = { language, topic }
  if (args.tone) body.tone = args.tone.trim()
  return liltFetch('/v2/create', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}, { method: 'create_content' })

const deleteCreateContent = sg.wrap(async (args: DeleteCreateContentInput) => {
  if (args.contentId == null) throw new Error('contentId is required')
  const id = Math.floor(args.contentId)
  return liltFetch(`/v2/create/${id}`, { method: 'DELETE' })
}, { method: 'delete_create_content' })

const getCreatePreferences = sg.wrap(async () => {
  return liltFetch('/v2/create/preferences')
}, { method: 'get_create_preferences' })

const getDomains = sg.wrap(async () => {
  return liltFetch('/v3/domains')
}, { method: 'get_domains' })

const getFiles = sg.wrap(async (args: GetFilesInput) => {
  const params = new URLSearchParams()
  if (args.name) params.set('name', args.name.trim())
  const qs = params.toString() ? `?${params.toString()}` : ''
  return liltFetch(`/v2/files${qs}`)
}, { method: 'get_files' })

const regenerateCreateContent = sg.wrap(async (args: RegenerateCreateContentInput) => {
  if (args.contentId == null) throw new Error('contentId is required')
  const id = Math.floor(args.contentId)
  return liltFetch(`/v2/create/${id}/create`)
}, { method: 'regenerate_create_content' })

export {
  getCreateContent,
  getCreateContentById,
  createContent,
  deleteCreateContent,
  getCreatePreferences,
  getDomains,
  getFiles,
  regenerateCreateContent,
}

console.log('settlegrid-lilt MCP server ready')
console.log('Methods: get_create_content, get_create_content_by_id, create_content, delete_create_content, get_create_preferences, get_domains, get_files, regenerate_create_content')
console.log('Pricing: 1-5¢ per call | Powered by SettleGrid')