/**
 * settlegrid-oxylabs — Oxylabs Web Scraper MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface ScrapeUrlInput {
  url: string
  render?: string
  geo_location?: string
  parse?: boolean
}

interface ScrapeGoogleInput {
  query: string
  geo_location?: string
  parse?: boolean
}

interface ScrapeAmazonInput {
  url: string
  geo_location?: string
  parse?: boolean
}

interface ScrapeWithJsInput {
  url: string
  geo_location?: string
  parse?: boolean
}

const BASE = 'https://realtime.oxylabs.io'

function getCredentials(): { username: string; password: string } {
  const raw = process.env.OXYLABS_CREDENTIALS
  if (!raw) throw new Error('OXYLABS_CREDENTIALS environment variable is required (format: username:password)')
  const sep = raw.indexOf(':')
  if (sep === -1) throw new Error('OXYLABS_CREDENTIALS must be in the format username:password')
  return { username: raw.slice(0, sep), password: raw.slice(sep + 1) }
}

function buildAuthHeader(): string {
  const { username, password } = getCredentials()
  return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
}

async function oxyPost(payload: Record<string, unknown>): Promise<unknown> {
  const auth = buildAuthHeader()
  const res = await fetch(`${BASE}/v1/queries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': auth,
      'User-Agent': 'settlegrid-oxylabs/1.0',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Oxylabs API error ${res.status}: ${errText.slice(0, 300)}`)
  }
  return res.json()
}

const sg = settlegrid.init({
  toolSlug: 'oxylabs',
  pricing: {
    defaultCostCents: 5,
    methods: {
      scrape_url: { costCents: 5, displayName: 'Scrape URL' },
      scrape_google_search: { costCents: 5, displayName: 'Scrape Google Search' },
      scrape_amazon_product: { costCents: 5, displayName: 'Scrape Amazon Product' },
      scrape_with_js: { costCents: 7, displayName: 'Scrape with JS Rendering' },
    },
  },
})

const scrapeUrl = sg.wrap(async (args: ScrapeUrlInput) => {
  const url = args.url?.trim()
  if (!url) throw new Error('url is required')
  const payload: Record<string, unknown> = { source: 'universal', url }
  if (args.render) payload.render = args.render
  if (args.geo_location) payload.geo_location = args.geo_location
  if (typeof args.parse === 'boolean') payload.parse = args.parse
  return oxyPost(payload)
}, { method: 'scrape_url' })

const scrapeGoogleSearch = sg.wrap(async (args: ScrapeGoogleInput) => {
  const query = args.query?.trim()
  if (!query) throw new Error('query is required')
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`
  const payload: Record<string, unknown> = { source: 'google_search', url }
  if (args.geo_location) payload.geo_location = args.geo_location
  payload.parse = typeof args.parse === 'boolean' ? args.parse : true
  return oxyPost(payload)
}, { method: 'scrape_google_search' })

const scrapeAmazonProduct = sg.wrap(async (args: ScrapeAmazonInput) => {
  const url = args.url?.trim()
  if (!url) throw new Error('url is required')
  if (!url.includes('amazon.')) throw new Error('url must be an Amazon product URL')
  const payload: Record<string, unknown> = { source: 'amazon', url }
  if (args.geo_location) payload.geo_location = args.geo_location
  payload.parse = typeof args.parse === 'boolean' ? args.parse : true
  return oxyPost(payload)
}, { method: 'scrape_amazon_product' })

const scrapeWithJs = sg.wrap(async (args: ScrapeWithJsInput) => {
  const url = args.url?.trim()
  if (!url) throw new Error('url is required')
  const payload: Record<string, unknown> = { source: 'universal', url, render: 'html' }
  if (args.geo_location) payload.geo_location = args.geo_location
  if (typeof args.parse === 'boolean') payload.parse = args.parse
  return oxyPost(payload)
}, { method: 'scrape_with_js' })

export { scrapeUrl, scrapeGoogleSearch, scrapeAmazonProduct, scrapeWithJs }
console.log('settlegrid-oxylabs MCP server ready')
console.log('Methods: scrape_url, scrape_google_search, scrape_amazon_product, scrape_with_js')
console.log('Pricing: 5-7¢ per call | Powered by SettleGrid')