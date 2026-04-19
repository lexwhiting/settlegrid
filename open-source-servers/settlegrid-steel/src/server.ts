/**
 * settlegrid-steel — Steel Headless Browser API MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface ListSessionsInput { _?: never }
interface CreateSessionInput { timeout?: number }
interface GetSessionInput { id: string }
interface ReleaseSessionInput { id: string }
interface ListScreenshotsInput { _?: never }
interface GetScreenshotInput { id: string }
interface ListPdfsInput { _?: never }
interface GetPdfInput { id: string }

const BASE = 'https://api.steel.dev'

function getApiKey(): string {
  const k = process.env.STEEL_API_KEY
  if (!k) throw new Error('STEEL_API_KEY environment variable is required')
  return k
}

async function steelFetch(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const apiKey = getApiKey()
  const res = await fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-steel/1.0',
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Steel API ${res.status}: ${text.slice(0, 200)}`)
  }
  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return res.json()
  }
  return { raw: await res.text() }
}

const sg = settlegrid.init({
  toolSlug: 'steel',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_sessions:    { costCents: 1, displayName: 'List Sessions' },
      create_session:   { costCents: 3, displayName: 'Create Session' },
      get_session:      { costCents: 1, displayName: 'Get Session' },
      release_session:  { costCents: 2, displayName: 'Release Session' },
      list_screenshots: { costCents: 1, displayName: 'List Screenshots' },
      get_screenshot:   { costCents: 1, displayName: 'Get Screenshot' },
      list_pdfs:        { costCents: 1, displayName: 'List PDFs' },
      get_pdf:          { costCents: 1, displayName: 'Get PDF' },
    },
  },
})

const listSessions = sg.wrap(async (_args: ListSessionsInput) => {
  return steelFetch('/sessions')
}, { method: 'list_sessions' })

const createSession = sg.wrap(async (args: CreateSessionInput) => {
  const timeout = args.timeout ? Math.min(Math.max(args.timeout, 1000), 3600000) : 300000
  return steelFetch('/sessions', {
    method: 'POST',
    body: { timeout },
  })
}, { method: 'create_session' })

const getSession = sg.wrap(async (args: GetSessionInput) => {
  const id = args.id?.trim()
  if (!id) throw new Error('id is required')
  return steelFetch(`/sessions/${encodeURIComponent(id)}`)
}, { method: 'get_session' })

const releaseSession = sg.wrap(async (args: ReleaseSessionInput) => {
  const id = args.id?.trim()
  if (!id) throw new Error('id is required')
  return steelFetch(`/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
}, { method: 'release_session' })

const listScreenshots = sg.wrap(async (_args: ListScreenshotsInput) => {
  return steelFetch('/screenshots')
}, { method: 'list_screenshots' })

const getScreenshot = sg.wrap(async (args: GetScreenshotInput) => {
  const id = args.id?.trim()
  if (!id) throw new Error('id is required')
  return steelFetch(`/screenshots/${encodeURIComponent(id)}`)
}, { method: 'get_screenshot' })

const listPdfs = sg.wrap(async (_args: ListPdfsInput) => {
  return steelFetch('/pdfs')
}, { method: 'list_pdfs' })

const getPdf = sg.wrap(async (args: GetPdfInput) => {
  const id = args.id?.trim()
  if (!id) throw new Error('id is required')
  return steelFetch(`/pdfs/${encodeURIComponent(id)}`)
}, { method: 'get_pdf' })

export {
  listSessions,
  createSession,
  getSession,
  releaseSession,
  listScreenshots,
  getScreenshot,
  listPdfs,
  getPdf,
}

console.log('settlegrid-steel MCP server ready')
console.log('Methods: list_sessions, create_session, get_session, release_session, list_screenshots, get_screenshot, list_pdfs, get_pdf')
console.log('Pricing: 1-3¢ per call | Powered by SettleGrid')