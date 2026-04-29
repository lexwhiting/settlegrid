/**
 * settlegrid-lokalise — Lokalise Localization MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.lokalise.com/api2'

function getApiKey(): string {
  const k = process.env.LOKALISE_API_KEY
  if (!k) throw new Error('LOKALISE_API_KEY environment variable is required')
  return k
}

async function lokaliseRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const apiKey = getApiKey()
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'X-Api-Token': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'settlegrid-lokalise/1.0',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Lokalise API error ${res.status}: ${errText.slice(0, 300)}`)
  }
  return res.json()
}

interface CreateProjectInput {
  name: string
  team_id: number
  base_lang_iso: string
  description?: string
}

interface ListProjectsInput {
  limit?: number
  page?: number
}

interface GetProjectInput {
  project_id: string
}

interface ListKeysInput {
  project_id: string
  limit?: number
  page?: number
  filter_tags?: string
}

interface CreateKeyInput {
  project_id: string
  key_name: string
  platforms: string[]
  description?: string
}

interface ListLanguagesInput {
  project_id: string
}

interface ListTranslationsInput {
  project_id: string
  language_iso?: string
  limit?: number
  page?: number
}

interface UpdateTranslationInput {
  project_id: string
  translation_id: number
  translation: string
  is_reviewed?: boolean
}

const sg = settlegrid.init({
  toolSlug: 'lokalise',
  pricing: {
    defaultCostCents: 1,
    methods: {
      create_project: { costCents: 3, displayName: 'Create Project' },
      list_projects: { costCents: 1, displayName: 'List Projects' },
      get_project: { costCents: 1, displayName: 'Get Project' },
      list_keys: { costCents: 1, displayName: 'List Keys' },
      create_key: { costCents: 3, displayName: 'Create Key' },
      list_languages: { costCents: 1, displayName: 'List Languages' },
      list_translations: { costCents: 1, displayName: 'List Translations' },
      update_translation: { costCents: 3, displayName: 'Update Translation' },
    },
  },
})

const createProject = sg.wrap(async (args: CreateProjectInput) => {
  const name = args.name?.trim()
  if (!name) throw new Error('name is required')
  if (!args.team_id) throw new Error('team_id is required')
  const base_lang_iso = args.base_lang_iso?.trim()
  if (!base_lang_iso) throw new Error('base_lang_iso is required')
  const body: Record<string, unknown> = {
    name,
    team_id: args.team_id,
    base_lang_iso,
  }
  if (args.description) body.description = args.description
  return lokaliseRequest('POST', '/projects', body)
}, { method: 'create_project' })

const listProjects = sg.wrap(async (args: ListProjectsInput) => {
  const limit = Math.min(args.limit || 100, 500)
  const page = Math.max(args.page || 1, 1)
  return lokaliseRequest('GET', `/projects?limit=${limit}&page=${page}`)
}, { method: 'list_projects' })

const getProject = sg.wrap(async (args: GetProjectInput) => {
  const id = args.project_id?.trim()
  if (!id) throw new Error('project_id is required')
  return lokaliseRequest('GET', `/projects/${encodeURIComponent(id)}`)
}, { method: 'get_project' })

const listKeys = sg.wrap(async (args: ListKeysInput) => {
  const id = args.project_id?.trim()
  if (!id) throw new Error('project_id is required')
  const limit = Math.min(args.limit || 100, 500)
  const page = Math.max(args.page || 1, 1)
  let qs = `limit=${limit}&page=${page}`
  if (args.filter_tags) qs += `&filter_tags=${encodeURIComponent(args.filter_tags)}`
  return lokaliseRequest('GET', `/projects/${encodeURIComponent(id)}/keys?${qs}`)
}, { method: 'list_keys' })

const createKey = sg.wrap(async (args: CreateKeyInput) => {
  const id = args.project_id?.trim()
  if (!id) throw new Error('project_id is required')
  const key_name = args.key_name?.trim()
  if (!key_name) throw new Error('key_name is required')
  if (!args.platforms || args.platforms.length === 0) throw new Error('platforms is required and must be non-empty')
  const keyObj: Record<string, unknown> = {
    key_name,
    platforms: args.platforms,
  }
  if (args.description) keyObj.description = args.description
  return lokaliseRequest('POST', `/projects/${encodeURIComponent(id)}/keys`, { keys: [keyObj] })
}, { method: 'create_key' })

const listLanguages = sg.wrap(async (args: ListLanguagesInput) => {
  const id = args.project_id?.trim()
  if (!id) throw new Error('project_id is required')
  return lokaliseRequest('GET', `/projects/${encodeURIComponent(id)}/languages`)
}, { method: 'list_languages' })

const listTranslations = sg.wrap(async (args: ListTranslationsInput) => {
  const id = args.project_id?.trim()
  if (!id) throw new Error('project_id is required')
  const limit = Math.min(args.limit || 100, 500)
  const page = Math.max(args.page || 1, 1)
  let qs = `limit=${limit}&page=${page}`
  if (args.language_iso) qs += `&language_iso=${encodeURIComponent(args.language_iso)}`
  return lokaliseRequest('GET', `/projects/${encodeURIComponent(id)}/translations?${qs}`)
}, { method: 'list_translations' })

const updateTranslation = sg.wrap(async (args: UpdateTranslationInput) => {
  const id = args.project_id?.trim()
  if (!id) throw new Error('project_id is required')
  if (!args.translation_id) throw new Error('translation_id is required')
  const translation = args.translation
  if (translation === undefined || translation === null) throw new Error('translation value is required')
  const body: Record<string, unknown> = { translation }
  if (args.is_reviewed !== undefined) body.is_reviewed = args.is_reviewed
  return lokaliseRequest(
    'PUT',
    `/projects/${encodeURIComponent(id)}/translations/${args.translation_id}`,
    body
  )
}, { method: 'update_translation' })

export {
  createProject,
  listProjects,
  getProject,
  listKeys,
  createKey,
  listLanguages,
  listTranslations,
  updateTranslation,
}

console.log('settlegrid-lokalise MCP server ready')
console.log('Methods: create_project, list_projects, get_project, list_keys, create_key, list_languages, list_translations, update_translation')
console.log('Pricing: 1-3¢ per call | Powered by SettleGrid')