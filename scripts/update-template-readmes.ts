#!/usr/bin/env npx tsx
/**
 * update-template-readmes.ts
 *
 * Adds a monetization CTA and SettleGrid badge to all open-source server
 * template READMEs. Idempotent — skips READMEs that already contain the
 * monetization section.
 *
 * Usage:
 *   npx tsx scripts/update-template-readmes.ts
 *   npx tsx scripts/update-template-readmes.ts --dry-run
 */

import { readdir, readFile, writeFile, stat } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')
const SERVERS_DIR = join(ROOT, 'open-source-servers')

// ── Markers for idempotency ────────────────────────────────────────────────

const SKIP_MARKERS = ['Monetize This Template', 'settlegrid.ai/api/badge']

const BADGE_LINE = '[![Monetize with SettleGrid](https://settlegrid.ai/api/badge/powered-by)](https://settlegrid.ai)'

function buildMonetizeSection(slug: string): string {
  return `
## Monetize This Template

Turn this MCP server into a revenue stream with [SettleGrid](https://settlegrid.ai) — add per-call billing in 2 lines of code.

\`\`\`bash
npm install @settlegrid/mcp
\`\`\`

\`\`\`typescript
import { settlegrid } from '@settlegrid/mcp'
const sg = settlegrid.init({ toolSlug: '${slug}' })
\`\`\`

Free tier: 25,000 ops/month • 0% platform fee • 95% revenue share

[Get started →](https://settlegrid.ai/docs)
`
}

// ── Slug sanitization ──────────────────────────────────────────────────────

function toSlug(dirName: string): string {
  return dirName
    .toLowerCase()
    .replace(/^settlegrid-/, '')  // strip prefix for cleaner slug
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// ── CLI arg parsing ─────────────────────────────────────────────────────────

function parseArgs(): { dryRun: boolean } {
  const args = process.argv.slice(2)
  return { dryRun: args.includes('--dry-run') }
}

// ── README processing ──────────────────────────────────────────────────────

function shouldSkip(content: string): boolean {
  return SKIP_MARKERS.some((marker) => content.includes(marker))
}

function insertBadge(content: string): string {
  const lines = content.split('\n')

  // Find the title line (first line starting with # )
  let titleIndex = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.startsWith('# ')) {
      titleIndex = i
      break
    }
  }

  if (titleIndex === -1) {
    // No title found — prepend badge at the very top
    return BADGE_LINE + '\n\n' + content
  }

  // Insert badge after the title line, with a blank line separator
  const before = lines.slice(0, titleIndex + 1)
  const after = lines.slice(titleIndex + 1)

  // Check if there's already a blank line after the title
  const needsBlank = after.length > 0 && after[0]!.trim() !== ''

  return [
    ...before,
    '',
    BADGE_LINE,
    needsBlank ? '' : '',
    ...after,
  ].join('\n')
}

function appendMonetizeSection(content: string, slug: string): string {
  // Ensure there's a trailing newline before the section
  const trimmed = content.trimEnd()
  return trimmed + '\n' + buildMonetizeSection(slug)
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { dryRun } = parseArgs()

  console.log(`Settings: dryRun=${dryRun}\n`)
  console.log(`Scanning ${SERVERS_DIR}...\n`)

  const entries = await readdir(SERVERS_DIR, { withFileTypes: true })
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()

  let updated = 0
  let skipped = 0
  let missing = 0
  const total = dirs.length

  for (const dirName of dirs) {
    const readmePath = join(SERVERS_DIR, dirName, 'README.md')

    // Check if README exists
    try {
      const s = await stat(readmePath)
      if (!s.isFile()) {
        missing++
        continue
      }
    } catch {
      missing++
      continue
    }

    // Read existing content
    const content = await readFile(readmePath, 'utf-8')

    // Skip if already has monetization content
    if (shouldSkip(content)) {
      skipped++
      continue
    }

    // Build slug from directory name
    const slug = toSlug(dirName)

    // Apply modifications
    let modified = insertBadge(content)
    modified = appendMonetizeSection(modified, slug)

    if (dryRun) {
      updated++
      // Log every 100 or first few
      if (updated <= 3 || updated % 100 === 0) {
        console.log(`  [DRY RUN] Would update: ${dirName} (slug: ${slug})`)
      }
    } else {
      await writeFile(readmePath, modified, 'utf-8')
      updated++
    }

    // Progress logging every 100 templates
    if ((updated + skipped) % 100 === 0) {
      console.log(`Progress: ${updated + skipped}/${total} (updated: ${updated}, skipped: ${skipped})`)
    }
  }

  console.log(`\nDone!`)
  console.log(`  Updated: ${updated} templates`)
  console.log(`  Skipped: ${skipped} (already had monetization section)`)
  if (missing > 0) {
    console.log(`  Missing README: ${missing} directories`)
  }
  console.log(`  Total directories scanned: ${total}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
