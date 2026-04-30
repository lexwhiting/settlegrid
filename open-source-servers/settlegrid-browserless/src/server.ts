/**
 * settlegrid-browserless — Browserless REST API MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface ScreenshotInput {
  url: string
  fullPage?: boolean
  width?: number
  height?: number
}

interface GetPageContentInput {
  url: string
  waitFor?: number
}

interface ScrapeElement {
  selector: string
  timeout?: number
}

interface ScrapePageInput {
  url: string
  elements: ScrapeElement[]
}

interface SmartScrapeInput {
  url: string
  prompt: string
}

const BASE = 'https://production-sfo.browserless.io'

function getApiKey(): string {
  const k = process.env.BROWSERLESS_API_KEY
  if (!k) throw new Error('BROWSERLESS_API_KEY environment variable is required')
  return k
}

function buildUrl(path: string): string {
  return `${BASE}${path}?token=${getApiKey()}`
}

const sg = settlegrid.init({
  toolSlug: 'browserless',
  pricing: {
    defaultCostCents: 3,
    methods: {
      take_screenshot: { costCents: 5, displayName: 'Take Screenshot' },
      get_page_content: { costCents: 3, displayName: 'Get Page Content' },
      scrape_page: { costCents: 4, displayName: 'Scrape Page' },
      smart_scrape_page: { costCents: 6, displayName: 'Smart Scrape Page' },
    },
  },
})

const takeScreenshot = sg.wrap(async (args: ScreenshotInput) => {
  const url = args.url?.trim()
  if (!url) throw new Error('url is required')
  const width = Math.min(args.width || 1920, 3840)
  const height = Math.min(args.height || 1080, 2160)
  const fullPage = args.fullPage ?? false

  const body = {
    url,
    options: {
      fullPage,
      type: 'png',
    },
    viewport: { width, height },
  }

  const res = await fetch(buildUrl('/screenshot'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-browserless/1.0',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Browserless API error ${res.status}: ${text.slice(0, 200)}`)
  }

  const buffer = await res.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  return {
    url,
    width,
    height,
    fullPage,
    imageBase64: base64,
    mimeType: 'image/png',
  }
}, { method: 'take_screenshot' })

const getPageContent = sg.wrap(async (args: GetPageContentInput) => {
  const url = args.url?.trim()
  if (!url) throw new Error('url is required')
  const waitFor = Math.min(args.waitFor || 0, 10000)

  const body: Record<string, unknown> = { url }
  if (waitFor > 0) body.waitFor = waitFor

  const res = await fetch(buildUrl('/content'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-browserless/1.0',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Browserless API error ${res.status}: ${text.slice(0, 200)}`)
  }

  const html = await res.text()
  return {
    url,
    waitFor,
    contentLength: html.length,
    html,
  }
}, { method: 'get_page_content' })

const scrapePage = sg.wrap(async (args: ScrapePageInput) => {
  const url = args.url?.trim()
  if (!url) throw new Error('url is required')
  if (!Array.isArray(args.elements) || args.elements.length === 0) {
    throw new Error('elements array is required and must not be empty')
  }
  const elements = args.elements.slice(0, 20).map((el) => ({
    selector: el.selector,
    ...(el.timeout != null ? { timeout: Math.min(el.timeout, 30000) } : {}),
  }))

  const body = { url, elements }

  const res = await fetch(buildUrl('/scrape'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-browserless/1.0',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Browserless API error ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  return { url, results: data }
}, { method: 'scrape_page' })

const smartScrapePage = sg.wrap(async (args: SmartScrapeInput) => {
  const url = args.url?.trim()
  if (!url) throw new Error('url is required')
  const prompt = args.prompt?.trim()
  if (!prompt) throw new Error('prompt is required')

  const body = { url, prompt }

  const res = await fetch(buildUrl('/smart-scrape'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-browserless/1.0',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Browserless API error ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  return { url, prompt, result: data }
}, { method: 'smart_scrape_page' })

export { takeScreenshot, getPageContent, scrapePage, smartScrapePage }
console.log('settlegrid-browserless MCP server ready')
console.log('Methods: take_screenshot, get_page_content, scrape_page, smart_scrape_page')
console.log('Pricing: 3-6¢ per call | Powered by SettleGrid')