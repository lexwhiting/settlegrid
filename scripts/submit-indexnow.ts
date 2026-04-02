#!/usr/bin/env npx tsx
/**
 * One-time script to submit ALL existing public pages to IndexNow.
 *
 * This notifies Bing, Yandex, and other participating search engines
 * to crawl and index SettleGrid pages within hours instead of days.
 *
 * Usage:
 *   npx tsx scripts/submit-indexnow.ts
 *
 * Environment:
 *   DATABASE_URL — Postgres connection string (to fetch tool slugs)
 *   CRON_SECRET  — Auth secret for the IndexNow API endpoint
 *   APP_URL      — Base URL (default: https://settlegrid.ai)
 */

import pg from 'pg'

// ─── Configuration ──────────────────────────────────────────────────────────────

const APP_URL = process.env.APP_URL ?? 'https://settlegrid.ai'
const CRON_SECRET = process.env.CRON_SECRET
const INDEXNOW_ENDPOINT = `${APP_URL}/api/indexnow`
const BATCH_SIZE = 5_000
const BATCH_DELAY_MS = 2_000

// ─── Static Pages ───────────────────────────────────────────────────────────────

const STATIC_PAGES = [
  '/',
  '/explore',
  '/learn',
  '/docs',
  '/faq',
  '/pricing',
  '/about',
  '/privacy',
  '/terms',
  '/ask',
  '/register',
  '/login',
  // Blog posts
  '/learn/blog/how-to-monetize-mcp-server',
  '/learn/blog/mcp-billing-comparison-2026',
  '/learn/blog/per-call-billing-ai-agents',
  '/learn/blog/ai-agent-payment-protocols',
  '/learn/blog/free-mcp-monetization',
  // Learn pages
  '/learn/how-mcp-billing-works',
  '/learn/discovery',
  '/learn/protocols',
  '/learn/state-of-mcp-2026',
  '/learn/mcp-zero-problem',
  '/learn/glossary',
  '/learn/handbook',
  // Category pages
  '/explore/category/data',
  '/explore/category/search',
  '/explore/category/nlp',
  '/explore/category/code',
  '/explore/category/finance',
  '/explore/category/security',
  '/explore/category/geo',
  '/explore/category/translation',
  '/explore/category/image',
  '/explore/category/database',
  '/explore/category/communication',
  '/explore/category/devops',
  '/explore/category/general',
  // Framework pages
  '/explore/for/langchain',
  '/explore/for/crewai',
  '/explore/for/smolagents',
  '/explore/for/autogen',
  '/explore/for/semantic-kernel',
  '/explore/for/mastra',
  // Marketplace pages
  '/marketplace/mcp-server',
  '/marketplace/api',
  '/marketplace/model',
  '/marketplace/agent',
  '/marketplace/automation',
  '/marketplace/sdk-package',
]

// ─── Helpers ────────────────────────────────────────────────────────────────────

function toAbsoluteUrl(path: string): string {
  return `${APP_URL}${path}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function submitBatch(urls: string[]): Promise<{ submitted: number; status: number; ok: boolean }> {
  if (!CRON_SECRET) {
    throw new Error('CRON_SECRET environment variable is required')
  }

  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CRON_SECRET}`,
    },
    body: JSON.stringify({ urls }),
  })

  const data = (await response.json()) as { submitted?: number; status?: number; ok?: boolean }

  return {
    submitted: data.submitted ?? urls.length,
    status: data.status ?? response.status,
    ok: data.ok ?? response.ok,
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== IndexNow Bulk Submission ===')
  console.log(`Target: ${APP_URL}`)
  console.log(`Endpoint: ${INDEXNOW_ENDPOINT}`)
  console.log()

  // Collect all URLs
  const allUrls: string[] = STATIC_PAGES.map(toAbsoluteUrl)

  // Fetch tool slugs from the database (if DATABASE_URL is available)
  const databaseUrl = process.env.DATABASE_URL
  if (databaseUrl) {
    console.log('Fetching tool slugs from database...')
    const client = new pg.Client({ connectionString: databaseUrl })

    try {
      await client.connect()
      const result = await client.query<{ slug: string }>(
        'SELECT slug FROM tools WHERE status != $1 ORDER BY created_at DESC',
        ['deleted']
      )

      const toolUrls = result.rows.map((row) => toAbsoluteUrl(`/tools/${row.slug}`))
      allUrls.push(...toolUrls)
      console.log(`  Found ${result.rows.length} tools`)
    } catch (dbError) {
      console.warn('  Could not fetch tools from database:', dbError instanceof Error ? dbError.message : String(dbError))
      console.warn('  Continuing with static pages only.')
    } finally {
      await client.end()
    }
  } else {
    console.log('No DATABASE_URL set — submitting static pages only.')
  }

  console.log(`Total URLs to submit: ${allUrls.length}`)
  console.log()

  // Submit in batches
  let totalSubmitted = 0
  const batches = Math.ceil(allUrls.length / BATCH_SIZE)

  for (let i = 0; i < batches; i++) {
    const batchUrls = allUrls.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
    const batchNum = i + 1

    console.log(`Batch ${batchNum}/${batches}: ${batchUrls.length} URLs...`)

    try {
      const result = await submitBatch(batchUrls)

      if (result.ok) {
        console.log(`  Submitted successfully (status ${result.status})`)
        totalSubmitted += result.submitted
      } else {
        console.error(`  Failed (status ${result.status})`)
      }
    } catch (error) {
      console.error(`  Error:`, error instanceof Error ? error.message : String(error))
    }

    // Delay between batches to be polite to the API
    if (i < batches - 1) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  console.log()
  console.log(`=== Done ===`)
  console.log(`Total submitted: ${totalSubmitted}/${allUrls.length}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
