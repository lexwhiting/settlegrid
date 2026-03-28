/**
 * Set proxy endpoints on all showcase tools so GridBot can invoke them
 * via the Smart Proxy.
 *
 * Points each tool's proxyEndpoint to the internal /api/tools/{slug}/call endpoint.
 * Run: npx tsx scripts/setup-proxy-endpoints.ts
 */

import { db } from '../apps/web/src/lib/db'
import { tools } from '../apps/web/src/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://settlegrid.ai'

async function main() {
  console.log(`\nSetting proxy endpoints on showcase tools...`)
  console.log(`App URL: ${APP_URL}\n`)

  // Find all active tools without a proxy endpoint
  const toolsToUpdate = await db
    .select({ id: tools.id, slug: tools.slug, name: tools.name })
    .from(tools)
    .where(and(
      eq(tools.status, 'active'),
      isNull(tools.proxyEndpoint)
    ))
    .limit(100)

  if (toolsToUpdate.length === 0) {
    console.log('All active tools already have proxy endpoints set.')
    return
  }

  console.log(`Found ${toolsToUpdate.length} tools without proxy endpoints:\n`)

  let updated = 0
  for (const tool of toolsToUpdate) {
    const endpoint = `${APP_URL}/api/tools/${tool.slug}/call`

    await db
      .update(tools)
      .set({
        proxyEndpoint: endpoint,
        updatedAt: new Date(),
      })
      .where(eq(tools.id, tool.id))

    console.log(`  ✅ ${tool.name} (${tool.slug}) → ${endpoint}`)
    updated++
  }

  console.log(`\nDone! Set proxy endpoints on ${updated} tools.`)
  console.log(`GridBot can now invoke these tools via /api/proxy/{slug}\n`)

  process.exit(0)
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
