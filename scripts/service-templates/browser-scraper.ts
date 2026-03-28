/**
 * SettleGrid Service Template: Browser Scraper
 *
 * Wraps Playwright-based page scraping with per-page billing through
 * SettleGrid. Callers provide a URL and CSS selector, and receive
 * extracted text/HTML content. No need for callers to run their own
 * browser infrastructure.
 *
 * Pricing: $0.05 per page scrape (configurable)
 *
 * Usage:
 *   1. `npm install settlegrid playwright`
 *   2. `npx playwright install chromium`
 *   3. Set SETTLEGRID_SECRET in your environment
 *   4. Deploy and register on SettleGrid dashboard
 */

import { SettleGrid } from 'settlegrid'
import { chromium, type Browser } from 'playwright'

// ─── Initialize ─────────────────────────────────────────────────────────────

const sg = new SettleGrid({
  secret: process.env.SETTLEGRID_SECRET!,
})

let browser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true })
  }
  return browser
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScrapeRequest {
  url: string
  selector?: string    // CSS selector to extract (default: 'body')
  waitFor?: string     // CSS selector to wait for before extracting
  timeout?: number     // Max page load time in ms (default: 15000)
  format?: 'text' | 'html'
}

interface ScrapeResponse {
  url: string
  title: string
  content: string
  format: 'text' | 'html'
  extractedAt: string
  loadTimeMs: number
}

// ─── Handler ────────────────────────────────────────────────────────────────

async function handleScrape(input: ScrapeRequest): Promise<ScrapeResponse> {
  const url = input.url
  if (!url || typeof url !== 'string') {
    throw new Error('url is required')
  }

  // Validate URL format
  const parsed = new URL(url) // Throws on invalid URL
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http and https URLs are supported')
  }

  const selector = input.selector ?? 'body'
  const format = input.format ?? 'text'
  const timeout = Math.min(input.timeout ?? 15_000, 30_000)

  const start = Date.now()
  const b = await getBrowser()
  const page = await b.newPage()

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout })

    if (input.waitFor) {
      await page.waitForSelector(input.waitFor, { timeout: 5_000 }).catch(() => {
        // Selector not found within timeout — continue with what we have
      })
    }

    const title = await page.title()

    const content =
      format === 'html'
        ? await page.locator(selector).first().innerHTML().catch(() => '')
        : await page.locator(selector).first().innerText().catch(() => '')

    const loadTimeMs = Date.now() - start

    return {
      url,
      title,
      content: content.slice(0, 50_000), // Cap output at 50KB
      format,
      extractedAt: new Date().toISOString(),
      loadTimeMs,
    }
  } finally {
    await page.close()
  }
}

// ─── SettleGrid Wrap ────────────────────────────────────────────────────────

/**
 * sg.wrap() intercepts each request, verifies the caller's SettleGrid
 * API key, charges per-page, and records usage on the SettleGrid ledger.
 */
export default sg.wrap(handleScrape, {
  name: 'browser-scraper',
  pricing: {
    model: 'per-call',
    costCentsPerCall: 5, // $0.05 per scrape
  },
  rateLimit: {
    requests: 30,
    window: '1m',
  },
})
