#!/usr/bin/env tsx
/**
 * Sync gallery template pricing from `src/server.ts` (the source of truth
 * the SDK actually meters on) onto the downstream surfaces:
 *
 *   1. `template.json` — reconcile `pricing.perCallUsdCents` to the server
 *      `defaultCostCents` and populate `pricing.methods` with the full
 *      per-method price map. Every other manifest field is preserved
 *      verbatim (this is a surgical pricing reconciliation, NOT a manifest
 *      regeneration — curated `name` / `capabilities` / `tags` are kept).
 *
 *   2. `monetization.md` + `README.md` — for templates that ship a
 *      `monetization.md`, regenerate the price-dependent Monetization
 *      sections when the doc's advertised price disagrees with
 *      `server.ts`. Templates whose docs already match are left untouched.
 *
 * The fix is a display/manifest reconciliation: no DB, SDK, or billing
 * change. Re-run `scripts/build-registry.ts` afterwards to refresh
 * `apps/web/public/registry.json` + `public/templates/*.json`.
 *
 * Idempotent. Usage:
 *   npx tsx scripts/sync-template-pricing.ts [--dry-run]
 */

import { realpathSync } from 'node:fs'
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  extractServerPricing,
  renderMonetizationSections,
  renderReadmeMonetization,
  type ServerPricing,
} from './lib/template-pricing'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SCRIPT_DIR, '..')
const OSS_ROOT = join(REPO_ROOT, 'open-source-servers')

// ── Pure helpers (exported for tests) ───────────────────────────────────────

/**
 * Parse the per-call price (in cents) a `monetization.md` currently
 * advertises, read from its `## Revenue Examples (at $X.XX / call)` header.
 * Returns null when the header is absent / unrecognised — callers must then
 * leave the doc untouched rather than guess.
 */
export function parseMonetizationDocPriceCents(md: string): number | null {
  const m = md.match(
    /## Revenue Examples \(at \$([0-9]+\.[0-9]+) \/ call\)/,
  )
  if (!m) return null
  const cents = Math.round(Number.parseFloat(m[1]) * 100)
  return Number.isInteger(cents) && cents >= 0 ? cents : null
}

/**
 * Return a copy of `manifest` with its `pricing` block reconciled to
 * `serverPricing`: `perCallUsdCents` set to the server default and
 * `methods` populated from the per-method map. `pricing.model` /
 * `pricing.currency` and every other manifest field — including key
 * order — are preserved. Field order within `pricing` follows the
 * `templateManifestSchema` declaration (model, perCallUsdCents,
 * currency, methods).
 */
export function applyPricingToManifest(
  manifest: Record<string, unknown>,
  serverPricing: ServerPricing,
): Record<string, unknown> {
  const oldPricing = (manifest.pricing ?? {}) as Record<string, unknown>
  const newPricing: Record<string, unknown> = {}
  if ('model' in oldPricing) newPricing.model = oldPricing.model
  newPricing.perCallUsdCents = serverPricing.defaultCostCents
  if ('currency' in oldPricing) newPricing.currency = oldPricing.currency
  if (serverPricing.methods) newPricing.methods = serverPricing.methods
  return { ...manifest, pricing: newPricing }
}

// ── Doc rewriting ───────────────────────────────────────────────────────────

/**
 * Splice the freshly-rendered Monetization sections into a stale
 * `monetization.md` / `README.md` pair. Returns the new file contents
 * (or null when the expected section markers are missing — never guesses).
 */
function rewriteMonetizationMd(md: string, priceCents: number): string | null {
  // The `## Revenue Model` … `## How It Works` span is the price-dependent
  // region; everything else (H1, How It Works, Adjusting Pricing) is kept.
  const re = /## Revenue Model[\s\S]*?(?=\n## How It Works)/
  if (!re.test(md)) return null
  return md.replace(re, renderMonetizationSections(priceCents))
}

function rewriteReadme(md: string, priceCents: number): string | null {
  // The `## Monetization` section runs up to the next `## ` heading.
  const re = /## Monetization\n[\s\S]*?(?=\n## )/
  if (!re.test(md)) return null
  return md.replace(re, renderReadmeMonetization(priceCents))
}

// ── Main ────────────────────────────────────────────────────────────────────

interface SyncResult {
  manifestsUpdated: string[]
  manifestsRepriced: string[]
  docsUpdated: string[]
  warnings: string[]
  scanned: number
}

async function syncAll(dryRun: boolean): Promise<SyncResult> {
  const entries = await readdir(OSS_ROOT, { withFileTypes: true })
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()

  const result: SyncResult = {
    manifestsUpdated: [],
    manifestsRepriced: [],
    docsUpdated: [],
    warnings: [],
    scanned: 0,
  }

  for (const dir of dirs) {
    const templateDir = join(OSS_ROOT, dir)
    const manifestPath = join(templateDir, 'template.json')

    let manifestRaw: string
    try {
      manifestRaw = await readFile(manifestPath, 'utf-8')
    } catch {
      continue // no template.json — not a gallery template
    }
    result.scanned++

    let serverTs: string
    try {
      serverTs = await readFile(join(templateDir, 'src', 'server.ts'), 'utf-8')
    } catch {
      result.warnings.push(`${dir}: template.json present but src/server.ts missing — skipped`)
      continue
    }
    const serverPricing = extractServerPricing(serverTs)

    // ── template.json — surgical pricing reconciliation ──
    let manifest: Record<string, unknown>
    try {
      manifest = JSON.parse(manifestRaw) as Record<string, unknown>
    } catch (err) {
      result.warnings.push(`${dir}: template.json is not valid JSON — skipped (${(err as Error).message})`)
      continue
    }
    const oldPerCall = (manifest.pricing as Record<string, unknown> | undefined)
      ?.perCallUsdCents
    const updatedManifest = applyPricingToManifest(manifest, serverPricing)
    const updatedRaw = JSON.stringify(updatedManifest, null, 2) + '\n'
    if (updatedRaw !== manifestRaw) {
      if (!dryRun) await writeFile(manifestPath, updatedRaw, 'utf-8')
      result.manifestsUpdated.push(dir)
      if (oldPerCall !== serverPricing.defaultCostCents) {
        result.manifestsRepriced.push(
          `${dir}: perCallUsdCents ${String(oldPerCall)} → ${serverPricing.defaultCostCents}`,
        )
      }
    }

    // ── docs — only templates that ship a monetization.md ──
    let monMd: string
    try {
      monMd = await readFile(join(templateDir, 'monetization.md'), 'utf-8')
    } catch {
      continue // no monetization.md — nothing else to sync
    }
    const docPrice = parseMonetizationDocPriceCents(monMd)
    if (docPrice === null) {
      result.warnings.push(`${dir}: monetization.md price header unrecognised — docs left untouched`)
      continue
    }
    if (docPrice === serverPricing.defaultCostCents) {
      continue // doc already matches server.ts — leave it
    }

    // Doc is stale — regenerate the Monetization sections of both files.
    const newMon = rewriteMonetizationMd(monMd, serverPricing.defaultCostCents)
    if (newMon === null) {
      result.warnings.push(`${dir}: monetization.md missing the Revenue Model → How It Works section — skipped`)
      continue
    }
    if (!dryRun) await writeFile(join(templateDir, 'monetization.md'), newMon, 'utf-8')

    const readmePath = join(templateDir, 'README.md')
    try {
      const readme = await readFile(readmePath, 'utf-8')
      const newReadme = rewriteReadme(readme, serverPricing.defaultCostCents)
      if (newReadme === null) {
        result.warnings.push(`${dir}: README.md has no recognised "## Monetization" section — README left stale`)
      } else if (!dryRun) {
        await writeFile(readmePath, newReadme, 'utf-8')
      }
    } catch {
      result.warnings.push(`${dir}: README.md unreadable — README left stale`)
    }

    result.docsUpdated.push(`${dir} (${docPrice}¢ → ${serverPricing.defaultCostCents}¢)`)
  }

  return result
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')
  if (dryRun) console.log('[sync-pricing] DRY RUN — no files will be written\n')

  const r = await syncAll(dryRun)

  console.log(`[sync-pricing] scanned ${r.scanned} gallery template.json files`)
  console.log(`[sync-pricing] template.json updated: ${r.manifestsUpdated.length}`)
  if (r.manifestsRepriced.length > 0) {
    console.log(`[sync-pricing] repriced manifests (${r.manifestsRepriced.length}):`)
    for (const m of r.manifestsRepriced) console.log(`  - ${m}`)
  }
  console.log(`[sync-pricing] docs regenerated: ${r.docsUpdated.length}`)
  for (const d of r.docsUpdated) console.log(`  - ${d}`)
  if (r.warnings.length > 0) {
    console.log(`[sync-pricing] warnings (${r.warnings.length}):`)
    for (const w of r.warnings) console.log(`  ! ${w}`)
  }
  console.log('\n[sync-pricing] done — run `npm run build:registry` to refresh the gallery registry.')
}

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

if (isMainEntry()) {
  main().catch((err) => {
    console.error('[sync-pricing] fatal:', err)
    process.exit(1)
  })
}
