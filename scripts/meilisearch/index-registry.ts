/**
 * Indexes apps/web/public/registry.json into Meilisearch.
 *
 * Usage:
 *   MEILI_URL=https://... MEILI_MASTER_KEY=... npx tsx scripts/meilisearch/index-registry.ts
 *
 * Requires:
 *   - MEILI_URL — Meilisearch instance URL
 *   - MEILI_MASTER_KEY — admin key for indexing (never exposed to client)
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MeiliSearch } from 'meilisearch'

const INDEX_NAME = 'templates'

const SEARCHABLE_ATTRIBUTES = [
  'name',
  'description',
  'capabilities',
  'tags',
]

const FILTERABLE_ATTRIBUTES = [
  'category',
  'tags',
  'runtime',
  'languages',
]

const SORTABLE_ATTRIBUTES = [
  'trendingRank',
  'name',
]

async function main() {
  const url = process.env.MEILI_URL
  const key = process.env.MEILI_MASTER_KEY
  if (!url || !key) {
    console.error('Error: MEILI_URL and MEILI_MASTER_KEY env vars are required')
    process.exit(1)
  }

  const startTime = performance.now()

  // Read registry
  const registryPath = join(process.cwd(), 'apps', 'web', 'public', 'registry.json')
  const registry = JSON.parse(readFileSync(registryPath, 'utf-8'))

  if (!Array.isArray(registry.templates) || registry.templates.length === 0) {
    console.error('Error: registry.json has 0 templates')
    process.exit(1)
  }

  const client = new MeiliSearch({ host: url, apiKey: key })

  // Create or update index
  const indexTask = await client.createIndex(INDEX_NAME, { primaryKey: 'slug' })
  await client.waitForTask(indexTask.taskUid)

  const index = client.index(INDEX_NAME)

  // Configure index settings
  const settingsTask = await index.updateSettings({
    searchableAttributes: SEARCHABLE_ATTRIBUTES,
    filterableAttributes: FILTERABLE_ATTRIBUTES,
    sortableAttributes: SORTABLE_ATTRIBUTES,
  })
  await client.waitForTask(settingsTask.taskUid)

  // Add documents
  const addTask = await index.addDocuments(registry.templates, {
    primaryKey: 'slug',
  })
  await client.waitForTask(addTask.taskUid)

  const duration = ((performance.now() - startTime) / 1000).toFixed(2)

  console.log(`Meilisearch indexing complete in ${duration}s`)
  console.log(`  Index: ${INDEX_NAME}`)
  console.log(`  Documents: ${registry.templates.length}`)
  console.log(`  Tasks completed: 3 (createIndex, updateSettings, addDocuments)`)
  console.log(`  Searchable: ${SEARCHABLE_ATTRIBUTES.join(', ')}`)
  console.log(`  Filterable: ${FILTERABLE_ATTRIBUTES.join(', ')}`)
  console.log(`  Sortable: ${SORTABLE_ATTRIBUTES.join(', ')}`)
}

main().catch((err) => {
  console.error('Indexing failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
