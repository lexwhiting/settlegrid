/**
 * Polish scaffolder for the 20 canonical templates selected from
 * CANONICAL_50.json. Generates template.json, README.md,
 * monetization.md, and remove-settlegrid.md for each entry in
 * CANONICAL_20.json.
 *
 * Usage:
 *   npm run polish:canonical [-- --only <slug>] [-- --dry-run]
 */

import { realpathSync } from 'node:fs'
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { safeValidateTemplateManifest } from '@settlegrid/mcp'

// ── Constants ──────────────────────────────────────────────────────────────

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SCRIPT_DIR, '..')
const SERVERS_DIR = join(REPO_ROOT, 'open-source-servers')
const CANONICAL_20_PATH = join(REPO_ROOT, 'CANONICAL_20.json')

const GENERIC_KEYWORDS = new Set(['settlegrid', 'mcp', 'ai'])

// ── Types ──────────────────────────────────────────────────────────────────

interface CanonicalEntry {
  slug: string
  name: string
  score: number
  sourceCategory: string
  manifestCategory: string
  selectionRationale: string
}

interface Canonical20 {
  version: number
  entries: CanonicalEntry[]
}

interface TemplateContext {
  entry: CanonicalEntry
  description: string
  keywords: string[]
  repoUrl: string
  methodsTable: string
  capabilities: string[]
  upstreamInfo: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function extractMethodsTable(readme: string): string {
  const match = readme.match(
    /## Methods\n\n(\| Method[\s\S]*?\|)\n\n/,
  )
  return match?.[1] ?? '| Method | Description | Cost |\n|--------|-------------|------|\n| *No methods documented* | — | — |'
}

function extractCapabilities(readme: string): string[] {
  const re = /\| `(\w+)\(/g
  const caps: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(readme)) !== null) {
    caps.push(m[1].replace(/_/g, '-'))
  }
  return caps.length > 0 ? caps : ['general']
}

/**
 * Extract the Upstream API section from an existing README.
 * Handles both the original format (`## Upstream API`) and the
 * polished format (`### Upstream API` under `## Original README`)
 * so the script is idempotent.
 */
function extractUpstreamInfo(readme: string): string {
  const match = readme.match(
    /###?\s+Upstream API\n\n((?:- .+\n?)+)/,
  )
  return match?.[1]?.trim() ?? ''
}

function filterTags(keywords: string[]): string[] {
  return keywords
    .filter((k) => !GENERIC_KEYWORDS.has(k))
    .slice(0, 10)
}

// ── Generators ─────────────────────────────────────────────────────────────

export function generateTemplateJson(ctx: TemplateContext): object {
  return {
    slug: ctx.entry.slug,
    name: ctx.entry.name,
    description: ctx.description,
    version: '1.0.0',
    category: ctx.entry.manifestCategory,
    tags: filterTags(ctx.keywords),
    author: {
      name: 'Alerterra, LLC',
      url: 'https://settlegrid.ai',
      github: 'settlegrid',
    },
    repo: {
      type: 'git',
      url: ctx.repoUrl,
    },
    runtime: 'node',
    languages: ['ts'],
    entry: 'src/server.ts',
    pricing: {
      model: 'per-call',
      perCallUsdCents: 1,
    },
    quality: {
      tests: false,
    },
    capabilities: ctx.capabilities,
    featured: false,
  }
}

export function generateReadme(ctx: TemplateContext): string {
  const slug = ctx.entry.slug
  const dirSlug = `settlegrid-${slug}`
  const deployUrl = `https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/${dirSlug}`

  return `# ${ctx.entry.name}

> ${ctx.description}

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](${deployUrl})

## 30-Second Quickstart

\`\`\`bash
# Option 1: Use the CLI scaffolder
npx create-settlegrid-tool --template ${slug}

# Option 2: Clone and run
git clone https://github.com/settlegrid/${dirSlug}.git
cd ${dirSlug}
npm install
cp .env.example .env   # Add your API keys
npm run dev
\`\`\`

## Methods

${ctx.methodsTable}

## Monetization

Turn this template into a revenue stream. At the default 1\u00A2/call pricing:

| Monthly Calls | Your Revenue (after 20% fee) |
|---------------|------------------------------|
| 1,000 | $8 |
| 10,000 | $80 |
| 100,000 | $800 |

See [monetization.md](monetization.md) for full pricing math and payout details.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](${deployUrl})

\`\`\`bash
# Or use Docker
docker build -t ${dirSlug} .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 ${dirSlug}
\`\`\`

## Demo

<!-- Replace with your Loom recording URL -->
> Loom demo placeholder — record a 30-second walkthrough and paste the embed URL here.

## Standalone Value

This template works without SettleGrid. See [remove-settlegrid.md](remove-settlegrid.md) for step-by-step removal instructions. **No lock-in.**

## Original README

The original template was generated by the SettleGrid scaffolder.
Upstream API attribution is preserved below.
${ctx.upstreamInfo ? `\n### Upstream API\n\n${ctx.upstreamInfo}\n` : ''}
## License

MIT — see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
`
}

export function generateMonetizationMd(ctx: TemplateContext): string {
  return `# Monetization Guide — ${ctx.entry.name}

## Revenue Model

This template uses **per-call pricing** via SettleGrid.

| Metric | Value |
|--------|-------|
| **Price per call** | $0.01 (1\u00A2) |
| **SettleGrid fee** | 20% |
| **Your revenue per call** | $0.008 |

## Revenue Examples

| Monthly Calls | Gross Revenue | SettleGrid Fee (20%) | Your Revenue |
|---------------|--------------|----------------------|-------------|
| 1,000 | $10 | $2 | **$8** |
| 10,000 | $100 | $20 | **$80** |
| 100,000 | $1,000 | $200 | **$800** |
| 1,000,000 | $10,000 | $2,000 | **$8,000** |

## How It Works

1. An AI agent calls your MCP server method
2. SettleGrid meters the call and charges the caller's account
3. Revenue accumulates in your SettleGrid dashboard
4. Payouts via Stripe Connect on your configured schedule

## Adjusting Pricing

Edit \`src/server.ts\` and change the \`costCents\` parameter in each \`sg.wrap()\` call:

\`\`\`typescript
sg.wrap(handler, { method: 'my_method', costCents: 5 }) // 5\u00A2 per call
\`\`\`

Higher-value methods (e.g., complex queries, real-time data) can command higher prices.
Rebuild and redeploy after changing prices.
`
}

export function generateRemoveSettlegridMd(ctx: TemplateContext): string {
  return `# How to Remove SettleGrid

This guide explains how to remove the \`@settlegrid/mcp\` dependency and run the server without billing. **You can leave anytime — no lock-in.**

## Steps

### 1. Remove the dependency

\`\`\`bash
npm uninstall @settlegrid/mcp
\`\`\`

### 2. Remove the SettleGrid import

In \`src/server.ts\`, delete the import line:

\`\`\`typescript
// DELETE THIS LINE:
import { SettleGrid } from '@settlegrid/mcp'
\`\`\`

### 3. Remove the init call

Delete the SettleGrid initialization block:

\`\`\`typescript
// DELETE THIS BLOCK:
const sg = new SettleGrid({
  apiKey: process.env.SETTLEGRID_API_KEY!,
})
\`\`\`

### 4. Unwrap handler calls

Replace each \`sg.wrap(handler, { method, costCents })\` with the original handler directly:

\`\`\`typescript
// BEFORE (with SettleGrid):
server.setRequestHandler(schema, sg.wrap(myHandler, { method: 'search', costCents: 2 }))

// AFTER (without SettleGrid):
server.setRequestHandler(schema, myHandler)
\`\`\`

### 5. Remove the environment variable

Delete \`SETTLEGRID_API_KEY\` from your \`.env\` file and any deployment configuration.

### 6. Test

\`\`\`bash
npm run dev
\`\`\`

Your server now runs without any billing layer. All API functionality is preserved.

---

*SettleGrid adds value without lock-in. If you want billing back, run \`npm install @settlegrid/mcp\` and re-wrap your handlers.*
`
}

// ── Core ───────────────────────────────────────────────────────────────────

export interface PolishOptions {
  canonical20Path?: string
  serversDir?: string
  only?: string
  dryRun?: boolean
}

export interface PolishResult {
  polished: string[]
  skipped: { slug: string; reason: string }[]
  validationErrors: { slug: string; errors: string[] }[]
}

export async function polishCanonical(
  opts: PolishOptions = {},
): Promise<PolishResult> {
  const c20Path = opts.canonical20Path ?? CANONICAL_20_PATH
  const servers = opts.serversDir ?? SERVERS_DIR
  const only = opts.only
  const dryRun = opts.dryRun ?? false

  const raw = JSON.parse(await readFile(c20Path, 'utf-8')) as Canonical20
  const entries = only
    ? raw.entries.filter((e) => e.slug === only)
    : raw.entries

  const polished: string[] = []
  const skipped: { slug: string; reason: string }[] = []
  const validationErrors: { slug: string; errors: string[] }[] = []

  for (const entry of entries) {
    const dirSlug = `settlegrid-${entry.slug}`
    const templateDir = join(servers, dirSlug)

    // Read existing package.json
    let pkgJson: {
      description?: string
      keywords?: string[]
      repository?: { url?: string }
    }
    try {
      pkgJson = JSON.parse(
        await readFile(join(templateDir, 'package.json'), 'utf-8'),
      )
    } catch {
      skipped.push({ slug: entry.slug, reason: 'Missing package.json' })
      continue
    }

    // Read existing README for methods extraction
    let existingReadme = ''
    try {
      existingReadme = await readFile(join(templateDir, 'README.md'), 'utf-8')
    } catch {
      // No existing README — methods table will be empty
    }

    const description =
      pkgJson.description?.replace(/^MCP server for .+ with SettleGrid billing\.\s*/, '') ||
      `${entry.name} MCP server`
    const keywords = pkgJson.keywords ?? []
    const repoUrl =
      pkgJson.repository?.url ?? `https://github.com/settlegrid/${dirSlug}`

    const ctx: TemplateContext = {
      entry,
      description,
      keywords,
      repoUrl,
      methodsTable: extractMethodsTable(existingReadme),
      capabilities: extractCapabilities(existingReadme),
      upstreamInfo: extractUpstreamInfo(existingReadme),
    }

    // Generate template.json
    const manifest = generateTemplateJson(ctx)
    const validation = safeValidateTemplateManifest(manifest)
    if (!validation.success) {
      validationErrors.push({ slug: entry.slug, errors: validation.errors })
      continue
    }

    if (!dryRun) {
      await writeFile(
        join(templateDir, 'template.json'),
        JSON.stringify(manifest, null, 2) + '\n',
        'utf-8',
      )
      await writeFile(
        join(templateDir, 'README.md'),
        generateReadme(ctx),
        'utf-8',
      )
      await writeFile(
        join(templateDir, 'monetization.md'),
        generateMonetizationMd(ctx),
        'utf-8',
      )
      await writeFile(
        join(templateDir, 'remove-settlegrid.md'),
        generateRemoveSettlegridMd(ctx),
        'utf-8',
      )
    }

    polished.push(entry.slug)
  }

  // Summary
  console.log(`Polished ${polished.length} templates`)
  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length}: ${skipped.map((s) => s.slug).join(', ')}`)
  }
  if (validationErrors.length > 0) {
    console.error(`Validation errors in ${validationErrors.length} templates:`)
    for (const v of validationErrors) {
      console.error(`  ${v.slug}: ${v.errors.join('; ')}`)
    }
  }

  return { polished, skipped, validationErrors }
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

  let only: string | undefined
  const onlyIdx = args.indexOf('--only')
  if (onlyIdx !== -1) {
    only = args[onlyIdx + 1]
    if (!only || only.startsWith('--')) {
      console.error('Error: --only requires a slug argument')
      process.exit(1)
    }
  }

  const dryRun = args.includes('--dry-run')

  const result = await polishCanonical({ only, dryRun })
  if (result.validationErrors.length > 0) {
    process.exit(1)
  }
}

if (isMainEntry()) {
  main()
}
