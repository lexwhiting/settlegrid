/**
 * settlegrid-firecrawl — Firecrawl MCP Server
 * Scrape, crawl, map, and extract data from websites via Firecrawl API.
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.firecrawl.dev'

function getApiKey(): string {
  const k = process.env.FIRECRAWL_API_KEY
  if (!k) throw new Error('FIRECRAWL_API_KEY environment variable is required')
  return k
}

async function apiFetch(
  path: string,
  method: string,
  body?: unknown
): Promise<unknown> {
  const key = getApiKey()
  const opts: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-firecrawl/1.0',
    },
  }
  if (body !== undefined) {
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`Firecrawl API ${res.status}: ${errText}`)
  }
  return res.json()
}

// ---- Input interfaces ----
interface ScrapeInput {
  url: string
  formats?: string[]
  onlyMainContent?: boolean
}

interface CrawlInput {
  url: string
  maxDepth?: number
  limit?: number
  includePaths?: string[]
  excludePaths?: string[]
}

interface GetCrawlStatusInput {
  id: string
}

interface MapInput {
  url: string
  search?: string
  limit?: number
  includeSubdomains?: boolean
}

interface ExtractInput {
  urls: string[]
  prompt: string
  schema?: object
}

interface GetExtractStatusInput {
  id: string
}

interface GenerateLlmsTxtInput {
  url: string
  maxUrls?: number
  showFullText?: boolean
}

interface GetLlmsTxtStatusInput {
  id: string
}

// ---- Init SettleGrid ----
const sg = settlegrid.init({
  toolSlug: 'firecrawl',
  pricing: {
    defaultCostCents: 2,
    methods: {
      scrape_url: { costCents: 2, displayName: 'Scrape URL' },
      crawl_website: { costCents: 5, displayName: 'Crawl Website' },
      get_crawl_status: { costCents: 1, displayName: 'Get Crawl Status' },
      map_website: { costCents: 2, displayName: 'Map Website' },
      extract_data: { costCents: 8, displayName: 'Extract Data' },
      get_extract_status: { costCents: 1, displayName: 'Get Extract Status' },
      generate_llmstxt: { costCents: 5, displayName: 'Generate LLMs.txt' },
      get_llmstxt_status: { costCents: 1, displayName: 'Get LLMs.txt Status' },
    },
  },
})

// ---- Handlers ----

const scrapeUrl = sg.wrap(async (args: ScrapeInput) => {
  const url = args.url?.trim()
  if (!url) throw new Error('url is required')
  const formats = args.formats && args.formats.length > 0 ? args.formats : ['markdown']
  const payload: Record<string, unknown> = { url, formats }
  if (args.onlyMainContent !== undefined) payload.onlyMainContent = args.onlyMainContent
  return apiFetch('/v1/scrape', 'POST', payload)
}, { method: 'scrape_url' })

const crawlWebsite = sg.wrap(async (args: CrawlInput) => {
  const url = args.url?.trim()
  if (!url) throw new Error('url is required')
  const maxDepth = Math.min(args.maxDepth || 2, 10)
  const limit = Math.min(args.limit || 10, 100)
  const payload: Record<string, unknown> = { url, maxDepth, limit }
  if (args.includePaths && args.includePaths.length > 0) payload.includePaths = args.includePaths
  if (args.excludePaths && args.excludePaths.length > 0) payload.excludePaths = args.excludePaths
  return apiFetch('/v1/crawl', 'POST', payload)
}, { method: 'crawl_website' })

const getCrawlStatus = sg.wrap(async (args: GetCrawlStatusInput) => {
  const id = args.id?.trim()
  if (!id) throw new Error('id is required')
  return apiFetch(`/v1/crawl/${encodeURIComponent(id)}`, 'GET')
}, { method: 'get_crawl_status' })

const mapWebsite = sg.wrap(async (args: MapInput) => {
  const url = args.url?.trim()
  if (!url) throw new Error('url is required')
  const limit = Math.min(args.limit || 50, 500)
  const payload: Record<string, unknown> = { url, limit }
  if (args.search) payload.search = args.search.trim()
  if (args.includeSubdomains !== undefined) payload.includeSubdomains = args.includeSubdomains
  return apiFetch('/v1/map', 'POST', payload)
}, { method: 'map_website' })

const extractData = sg.wrap(async (args: ExtractInput) => {
  if (!args.urls || args.urls.length === 0) throw new Error('urls is required and must not be empty')
  const prompt = args.prompt?.trim()
  if (!prompt) throw new Error('prompt is required')
  const payload: Record<string, unknown> = { urls: args.urls, prompt }
  if (args.schema) payload.schema = args.schema
  return apiFetch('/v1/extract', 'POST', payload)
}, { method: 'extract_data' })

const getExtractStatus = sg.wrap(async (args: GetExtractStatusInput) => {
  const id = args.id?.trim()
  if (!id) throw new Error('id is required')
  return apiFetch(`/v1/extract/${encodeURIComponent(id)}`, 'GET')
}, { method: 'get_extract_status' })

const generateLlmstxt = sg.wrap(async (args: GenerateLlmsTxtInput) => {
  const url = args.url?.trim()
  if (!url) throw new Error('url is required')
  const maxUrls = Math.min(args.maxUrls || 10, 50)
  const payload: Record<string, unknown> = { url, maxUrls }
  if (args.showFullText !== undefined) payload.showFullText = args.showFullText
  return apiFetch('/v1/generate-llmstxt', 'POST', payload)
}, { method: 'generate_llmstxt' })

const getLlmsTxtStatus = sg.wrap(async (args: GetLlmsTxtStatusInput) => {
  const id = args.id?.trim()
  if (!id) throw new Error('id is required')
  return apiFetch(`/v1/generate-llmstxt/${encodeURIComponent(id)}`, 'GET')
}, { method: 'get_llmstxt_status' })

export {
  scrapeUrl,
  crawlWebsite,
  getCrawlStatus,
  mapWebsite,
  extractData,
  getExtractStatus,
  generateLlmstxt,
  getLlmsTxtStatus,
}

console.log('settlegrid-firecrawl MCP server ready')
console.log('Methods: scrape_url, crawl_website, get_crawl_status, map_website, extract_data, get_extract_status, generate_llmstxt, get_llmstxt_status')
console.log('Pricing: 1-8¢ per call | Powered by SettleGrid')