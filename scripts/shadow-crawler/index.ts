/**
 * Shadow directory crawler — ingests MCP server records from multiple
 * sources into the mcp_shadow_index Postgres table.
 *
 * Usage:
 *   npm run shadow:crawl [-- --source <name>] [-- --limit <n>] [-- --dry-run]
 */

import { realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ShadowRecord } from './types'

// ── Source modules ─────────────────────────────────────────────────────────

import { fetchPulseMCP } from './sources/pulsemcp'
import { fetchSmithery } from './sources/smithery'
import { fetchAwesomeMCP } from './sources/awesome-mcp'
import { fetchGitHub } from './sources/github'
import { fetchNpm } from './sources/npm'
import { fetchPyPI } from './sources/pypi'

const SOURCES: Record<string, (opts: { limit?: number }) => AsyncIterable<ShadowRecord>> = {
  pulsemcp: fetchPulseMCP,
  smithery: fetchSmithery,
  'awesome-mcp': fetchAwesomeMCP,
  github: fetchGitHub,
  npm: fetchNpm,
  pypi: fetchPyPI,
}

// ── Upsert logic ───────────────────────────────────────────────────────────

async function upsertRecords(records: ShadowRecord[]): Promise<number> {
  if (records.length === 0) return 0

  // Lazy-import DB deps only when actually writing (not in --dry-run)
  const { drizzle } = await import('drizzle-orm/postgres-js')
  const postgres = (await import('postgres')).default
  const { mcpShadowIndex } = await import(
    '../../apps/web/src/lib/db/schema' as string
  )

  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL env var is required for writes')
  }

  const sql = postgres(url, { prepare: false, max: 3 })
  const db = drizzle(sql)

  const BATCH_SIZE = 100
  let total = 0

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const values = batch.map((r) => ({
      source: r.source,
      owner: r.owner,
      repo: r.repo,
      name: r.name,
      description: r.description ?? null,
      category: r.category ?? null,
      tags: r.tags ?? null,
      stars: r.stars ?? null,
      downloads: r.downloads ?? null,
      lastUpdated: r.lastUpdated ?? null,
      sourceUrl: r.sourceUrl ?? null,
    }))

    await db
      .insert(mcpShadowIndex)
      .values(values)
      .onConflictDoUpdate({
        target: [
          mcpShadowIndex.source,
          mcpShadowIndex.owner,
          mcpShadowIndex.repo,
        ],
        set: {
          name: mcpShadowIndex.name,
          description: mcpShadowIndex.description,
          category: mcpShadowIndex.category,
          tags: mcpShadowIndex.tags,
          stars: mcpShadowIndex.stars,
          downloads: mcpShadowIndex.downloads,
          lastUpdated: mcpShadowIndex.lastUpdated,
          sourceUrl: mcpShadowIndex.sourceUrl,
          indexedAt: new Date(),
        },
      })

    total += batch.length
  }

  await sql.end()
  return total
}

// ── Main ───────────────────────────────────────────────────────────────────

export async function crawl(opts: {
  source?: string
  limit?: number
  dryRun?: boolean
}): Promise<{ perSource: Record<string, number>; total: number }> {
  const startTime = performance.now()

  const sourceNames = opts.source
    ? [opts.source]
    : Object.keys(SOURCES)

  const allRecords: ShadowRecord[] = []
  const perSource: Record<string, number> = {}

  for (const name of sourceNames) {
    const fetchFn = SOURCES[name]
    if (!fetchFn) {
      console.warn(`Unknown source: ${name}`)
      continue
    }

    console.log(`Crawling ${name}...`)
    let count = 0

    try {
      for await (const record of fetchFn({ limit: opts.limit })) {
        allRecords.push(record)
        count++
      }
    } catch (err) {
      console.error(
        `  Error crawling ${name}:`,
        err instanceof Error ? err.message : err,
      )
    }

    perSource[name] = count
    console.log(`  ${name}: ${count} records`)
  }

  let total = 0

  if (opts.dryRun) {
    console.log(`\nDry run — ${allRecords.length} records would be upserted`)
    total = 0
  } else {
    console.log(`\nUpserting ${allRecords.length} records...`)
    total = await upsertRecords(allRecords)
    console.log(`  Upserted: ${total}`)
  }

  const duration = ((performance.now() - startTime) / 1000).toFixed(2)
  console.log(`\nCrawl complete in ${duration}s`)
  for (const [src, cnt] of Object.entries(perSource)) {
    console.log(`  ${src}: ${cnt}`)
  }
  console.log(`  Total: ${allRecords.length}`)

  return { perSource, total }
}

// ── CLI entry ──────────────────────────────────────────────────────────────

function isMainEntry(): boolean {
  try {
    return (
      realpathSync(fileURLToPath(import.meta.url)) ===
      realpathSync(process.argv[1])
    )
  } catch {
    return false
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  let source: string | undefined
  const srcIdx = args.indexOf('--source')
  if (srcIdx !== -1) {
    source = args[srcIdx + 1]
    if (!source || source.startsWith('--')) {
      console.error('Error: --source requires a name')
      process.exit(1)
    }
  }

  let limit: number | undefined
  const limIdx = args.indexOf('--limit')
  if (limIdx !== -1) {
    limit = parseInt(args[limIdx + 1], 10)
    if (!Number.isFinite(limit) || limit <= 0) {
      console.error('Error: --limit requires a positive integer')
      process.exit(1)
    }
  }

  const dryRun = args.includes('--dry-run')

  try {
    await crawl({ source, limit, dryRun })
  } catch (err) {
    console.error('Crawl failed:', err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

if (isMainEntry()) {
  main()
}
