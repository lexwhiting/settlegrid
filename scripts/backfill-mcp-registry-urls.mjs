/**
 * One-time backfill: updates tools that have the generic MCP Registry URL
 * (https://registry.modelcontextprotocol.io/v0.1/servers) with their actual
 * GitHub repository URLs by re-querying the MCP Registry API.
 *
 * Also normalizes git+https:// and git+ssh:// URLs to standard https:// format.
 *
 * Usage: node scripts/backfill-mcp-registry-urls.mjs
 */

import pg from 'pg'
const { Client } = pg

const CONNECTION_STRING =
  'postgresql://postgres:SettleGridSees%40ll89@db.ncqjvmpruutwhilldcjp.supabase.co:5432/postgres'
const MCP_REGISTRY_URL = 'https://registry.modelcontextprotocol.io/v0.1/servers'

/**
 * Normalize git-style URLs to standard HTTPS.
 */
function normalizeGitUrl(raw) {
  let url = raw.trim()
  url = url.replace(/^git\+/, '')
  url = url.replace(/^ssh:\/\/git@github\.com\//i, 'https://github.com/')
  url = url.replace(/^git:\/\//, 'https://')
  url = url.replace(/\.git$/, '').replace(/\/+$/, '')
  return url
}

async function main() {
  const client = new Client({
    connectionString: CONNECTION_STRING,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  console.log('Connected to database.\n')

  // ── Part 1: Fix MCP Registry generic URLs ──────────────────────────────
  console.log('=== Part 1: Backfill MCP Registry URLs ===')

  const mcpTools = await client.query(`
    SELECT id, name, slug, source_repo_url FROM tools
    WHERE status = 'unclaimed'
    AND source_repo_url = $1
  `, [MCP_REGISTRY_URL])

  console.log(`Found ${mcpTools.rows.length} tools with generic MCP Registry URL.`)

  if (mcpTools.rows.length > 0) {
    // Fetch the full MCP Registry
    const res = await fetch(MCP_REGISTRY_URL, {
      headers: { Accept: 'application/json', 'User-Agent': 'SettleGrid-Backfill/1.0' },
    })

    if (!res.ok) {
      console.error('Failed to fetch MCP Registry:', res.status)
    } else {
      const data = await res.json()
      const servers = data.servers || []

      // Build a lookup map: name -> repository URL
      const repoMap = new Map()
      for (const entry of servers) {
        const s = entry.server || entry
        const name = (s.name || s.title || '').trim()
        const repo = s.repository
        const repoUrl = typeof repo?.url === 'string' ? repo.url : null
        if (name && repoUrl) {
          repoMap.set(name.toLowerCase(), repoUrl)
        }
      }

      console.log(`MCP Registry has ${servers.length} servers, ${repoMap.size} with repo URLs.`)

      let updated = 0
      for (const tool of mcpTools.rows) {
        // Try exact slug match and name match
        const nameKey = tool.name.toLowerCase()
        const slugKey = tool.slug.toLowerCase()
        const repoUrl = repoMap.get(nameKey) || repoMap.get(slugKey)

        if (repoUrl) {
          await client.query(`
            UPDATE tools SET source_repo_url = $1, updated_at = NOW() WHERE id = $2
          `, [repoUrl, tool.id])
          console.log(`  Updated: ${tool.name} -> ${repoUrl}`)
          updated++
        } else {
          console.log(`  No match: ${tool.name} (slug: ${tool.slug})`)
        }
      }
      console.log(`Updated ${updated}/${mcpTools.rows.length} MCP Registry tools.\n`)
    }
  }

  // ── Part 2: Normalize git+ URLs ────────────────────────────────────────
  console.log('=== Part 2: Normalize git+ prefix URLs ===')

  const gitPlusTools = await client.query(`
    SELECT id, name, source_repo_url FROM tools
    WHERE status = 'unclaimed'
    AND (source_repo_url LIKE 'git+%' OR source_repo_url LIKE 'git://%')
  `)

  console.log(`Found ${gitPlusTools.rows.length} tools with git+ or git:// URLs.`)

  let normalized = 0
  for (const tool of gitPlusTools.rows) {
    const newUrl = normalizeGitUrl(tool.source_repo_url)
    if (newUrl !== tool.source_repo_url) {
      await client.query(`
        UPDATE tools SET source_repo_url = $1, updated_at = NOW() WHERE id = $2
      `, [newUrl, tool.id])
      normalized++
    }
  }
  console.log(`Normalized ${normalized}/${gitPlusTools.rows.length} URLs.\n`)

  // ── Part 3: Reset sentinel dates for re-processing ─────────────────────
  // If there are tools with claimEmailSentAt = epoch (1970-01-01),
  // reset them so they can be re-attempted with the improved resolvers.
  console.log('=== Part 3: Reset failed resolution markers ===')

  const resetResult = await client.query(`
    UPDATE tools SET claim_email_sent_at = NULL, updated_at = NOW()
    WHERE status = 'unclaimed'
    AND claim_email_sent_at = '1970-01-01 00:00:00+00'
  `)
  console.log(`Reset ${resetResult.rowCount} tools with epoch sentinel date.\n`)

  // ── Summary ────────────────────────────────────────────────────────────
  const summary = await client.query(`
    SELECT
      CASE
        WHEN source_repo_url LIKE '%github.com%' THEN 'github'
        WHEN source_repo_url LIKE '%smithery.ai%' THEN 'smithery'
        WHEN source_repo_url LIKE '%registry.modelcontextprotocol%' THEN 'mcp-registry'
        WHEN source_repo_url LIKE '%npmjs.com%' THEN 'npm'
        WHEN source_repo_url LIKE '%huggingface.co%' THEN 'huggingface'
        ELSE 'other'
      END as url_type,
      count(*)::int as total,
      count(claim_email_sent_at)::int as emailed
    FROM tools WHERE status = 'unclaimed'
    GROUP BY 1 ORDER BY total DESC
  `)

  console.log('=== Updated URL Distribution ===')
  summary.rows.forEach(row =>
    console.log(`  ${row.url_type}: ${row.total} (emailed: ${row.emailed})`)
  )

  await client.end()
  console.log('\nDone.')
}

main().catch(err => {
  console.error('Fatal error:', err.message)
  process.exit(1)
})
