/**
 * settlegrid-scrapingbee — ScrapingBee Web Scraping MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://app.scrapingbee.com/api/v1'

interface ScrapeUrlInput {
  url: string
  render_js?: boolean
  block_resources?: boolean
  country_code?: string
  wait?: number
}

interface ScrapeWithExtractionInput {
  url: string
  extract_rules: string
  render_js?: boolean
  wait_for?: string
}

interface ScrapeWithPremiumProxyInput {
  url: string
  render_js?: boolean
  country_code?: string
  device?: string
}

function getApiKey(): string {
  const k = process.env.SCRAPINGBEE_API_KEY
  if (!k) throw new Error('SCRAPINGBEE_API_KEY environment variable is required')
  return k
}

async function scrapingBeeFetch(params: Record<string, string | boolean | number>): Promise<{ html: string; status: number }> {
  const apiKey = getApiKey()
  const qs = new URLSearchParams()
  qs.set('api_key', apiKey)
  for (const [key, value] of Object.entries(params)) {
    qs.set(key, String(value))
  }
  const res = await fetch(`${BASE}/?${qs.toString()}`, {
    headers: { 'User-Agent': 'settlegrid-scrapingbee/1.0' },
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`ScrapingBee API error ${res.status}: ${errText.slice(0, 300)}`)
  }
  const html = await res.text()
  return { html, status: res.status }
}

const sg = settlegrid.init({
  toolSlug: 'scrapingbee',
  pricing: {
    defaultCostCents: 3,
    methods: {
      scrape_url: { costCents: 3, displayName: 'Scrape URL' },
      scrape_with_extraction: { costCents: 5, displayName: 'Scrape with Extraction Rules' },
      scrape_with_premium_proxy: { costCents: 7, displayName: 'Scrape with Premium Proxy' },
    },
  },
})

const scrapeUrl = sg.wrap(async (args: ScrapeUrlInput) => {
  const url = args.url?.trim()
  if (!url) throw new Error('url is required')
  const params: Record<string, string | boolean | number> = { url }
  if (args.render_js !== undefined) params.render_js = args.render_js
  if (args.block_resources !== undefined) params.block_resources = args.block_resources
  if (args.country_code) params.country_code = args.country_code.trim().toLowerCase()
  if (args.wait !== undefined) params.wait = Math.min(Math.max(0, args.wait), 35000)
  const result = await scrapingBeeFetch(params)
  return {
    url,
    status: result.status,
    html_length: result.html.length,
    html: result.html,
  }
}, { method: 'scrape_url' })

const scrapeWithExtraction = sg.wrap(async (args: ScrapeWithExtractionInput) => {
  const url = args.url?.trim()
  if (!url) throw new Error('url is required')
  const extractRulesStr = args.extract_rules?.trim()
  if (!extractRulesStr) throw new Error('extract_rules is required')
  let parsedRules: unknown
  try {
    parsedRules = JSON.parse(extractRulesStr)
  } catch {
    throw new Error('extract_rules must be a valid JSON string')
  }
  const params: Record<string, string | boolean | number> = {
    url,
    extract_rules: JSON.stringify(parsedRules),
  }
  if (args.render_js !== undefined) params.render_js = args.render_js
  if (args.wait_for) params.wait_for = args.wait_for.trim()
  const result = await scrapingBeeFetch(params)
  let extracted: unknown = result.html
  try {
    extracted = JSON.parse(result.html)
  } catch {
    // response may not be JSON when extraction fails
  }
  return {
    url,
    status: result.status,
    extracted,
  }
}, { method: 'scrape_with_extraction' })

const scrapeWithPremiumProxy = sg.wrap(async (args: ScrapeWithPremiumProxyInput) => {
  const url = args.url?.trim()
  if (!url) throw new Error('url is required')
  const device = args.device?.trim().toLowerCase()
  if (device && !['desktop', 'mobile'].includes(device)) {
    throw new Error('device must be either "desktop" or "mobile"')
  }
  const params: Record<string, string | boolean | number> = {
    url,
    premium_proxy: true,
  }
  if (args.render_js !== undefined) params.render_js = args.render_js
  if (args.country_code) params.country_code = args.country_code.trim().toLowerCase()
  if (device) params.device = device
  const result = await scrapingBeeFetch(params)
  return {
    url,
    status: result.status,
    html_length: result.html.length,
    html: result.html,
  }
}, { method: 'scrape_with_premium_proxy' })

export { scrapeUrl, scrapeWithExtraction, scrapeWithPremiumProxy }
console.log('settlegrid-scrapingbee MCP server ready')
console.log('Methods: scrape_url, scrape_with_extraction, scrape_with_premium_proxy')
console.log('Pricing: 3-7¢ per call | Powered by SettleGrid')