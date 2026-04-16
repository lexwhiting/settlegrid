/**
 * Registry build script — walks template directories, validates each
 * template.json via the P2.6 schema, and emits a deterministic
 * apps/web/public/registry.json plus per-slug JSON files.
 *
 * Usage:
 *   npm run build:registry [-- --strict] [-- --only <slug>]
 *
 * Flags:
 *   --strict    Fail on any invalid manifest (default on CI via CI env var)
 *   --only <s>  Only process template directories matching slug <s>
 *
 * Mirrors the node-native, minimal-deps style of scripts/gen/core.mjs.
 */

import { realpathSync } from 'node:fs'
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  safeValidateTemplateManifest,
  type TemplateManifest,
} from '@settlegrid/mcp'

// ── Constants ──────────────────────────────────────────────────────────────

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SCRIPT_DIR, '..')

const DEFAULT_TEMPLATE_ROOTS = [
  join(REPO_ROOT, 'open-source-servers'),
  join(REPO_ROOT, 'packages', 'create-settlegrid-tool', 'templates'),
]

const DEFAULT_OUTPUT_DIR = join(REPO_ROOT, 'apps', 'web', 'public')

/** Increment when the RegistryJson shape has a breaking change. */
const REGISTRY_VERSION = 1

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * Public template manifest — the subset of fields exposed in the registry.
 * Currently identical to TemplateManifest (no private fields exist yet).
 */
export type TemplateManifestPublic = TemplateManifest

export interface RegistryJson {
  version: number
  generatedAt: string
  commit: string
  totalTemplates: number
  categories: Record<string, number>
  templates: TemplateManifestPublic[]
}

export interface BuildRegistryOptions {
  templateRoots?: string[]
  outputDir?: string
  strict?: boolean
  only?: string
}

export interface BuildResult {
  registry: RegistryJson
  skipped: SkippedManifest[]
}

export interface SkippedManifest {
  dir: string
  errors: string[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getGitCommit(): string {
  try {
    return execSync('git rev-parse HEAD', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch {
    return 'unknown'
  }
}

/**
 * Discover template.json files in the given roots.
 * Returns entries sorted by directory name for deterministic processing.
 */
async function discoverManifests(
  roots: string[],
  only?: string,
): Promise<{ manifestPath: string; dirName: string }[]> {
  const found: { manifestPath: string; dirName: string }[] = []

  for (const root of roots) {
    let entries: string[]
    try {
      entries = await readdir(root)
    } catch {
      // Root doesn't exist — skip silently
      continue
    }

    for (const dirName of entries) {
      // Filter by --only: strip settlegrid- prefix for matching
      if (only) {
        const slug = dirName.replace(/^settlegrid-/, '')
        if (slug !== only) continue
      }

      const manifestPath = join(root, dirName, 'template.json')
      try {
        const s = await stat(manifestPath)
        if (s.isFile()) {
          found.push({ manifestPath, dirName })
        }
      } catch {
        // No template.json in this directory — skip
      }
    }
  }

  return found.sort((a, b) => a.dirName.localeCompare(b.dirName))
}

// ── Core ───────────────────────────────────────────────────────────────────

export async function buildRegistry(
  opts: BuildRegistryOptions = {},
): Promise<BuildResult> {
  const roots = opts.templateRoots ?? DEFAULT_TEMPLATE_ROOTS
  const outputDir = opts.outputDir ?? DEFAULT_OUTPUT_DIR
  const strict = opts.strict ?? false
  const only = opts.only

  const startTime = performance.now()
  const discovered = await discoverManifests(roots, only)

  const templates: TemplateManifestPublic[] = []
  const skipped: SkippedManifest[] = []

  for (const { manifestPath, dirName } of discovered) {
    let raw: unknown
    try {
      const content = await readFile(manifestPath, 'utf-8')
      raw = JSON.parse(content)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      skipped.push({ dir: dirName, errors: [`Failed to read/parse: ${msg}`] })
      continue
    }

    const result = safeValidateTemplateManifest(raw)
    if (!result.success) {
      skipped.push({ dir: dirName, errors: result.errors })
      continue
    }

    templates.push(result.data)
  }

  // Non-strict mode: log per-manifest warnings to stderr
  if (!strict && skipped.length > 0) {
    for (const s of skipped) {
      console.warn(`WARN: skipping ${s.dir}:`)
      for (const e of s.errors) {
        console.warn(`  - ${e}`)
      }
    }
  }

  // Strict mode: fail loud with aggregated report
  if (strict && skipped.length > 0) {
    const report = skipped
      .map(
        (s) =>
          `  ${s.dir}:\n${s.errors.map((e) => `    - ${e}`).join('\n')}`,
      )
      .join('\n')
    throw new Error(
      `Strict mode: ${skipped.length} invalid manifest(s):\n${report}`,
    )
  }

  // Sort templates by slug ascending for deterministic output
  templates.sort((a, b) => a.slug.localeCompare(b.slug))

  // Build sorted categories map
  const catCounts: Record<string, number> = {}
  for (const t of templates) {
    catCounts[t.category] = (catCounts[t.category] ?? 0) + 1
  }
  const categories = Object.fromEntries(
    Object.entries(catCounts).sort(([a], [b]) => a.localeCompare(b)),
  )

  const registry: RegistryJson = {
    version: REGISTRY_VERSION,
    generatedAt: new Date().toISOString(),
    commit: getGitCommit(),
    totalTemplates: templates.length,
    categories,
    templates,
  }

  // ── Write outputs ──

  await mkdir(outputDir, { recursive: true })

  await writeFile(
    join(outputDir, 'registry.json'),
    JSON.stringify(registry, null, 2) + '\n',
    'utf-8',
  )

  // Per-slug JSON files
  const templatesDir = join(outputDir, 'templates')
  await mkdir(templatesDir, { recursive: true })

  for (const t of templates) {
    await writeFile(
      join(templatesDir, `${t.slug}.json`),
      JSON.stringify(t, null, 2) + '\n',
      'utf-8',
    )
  }

  // ── Summary to stdout ──

  const duration = ((performance.now() - startTime) / 1000).toFixed(2)

  console.log(`Registry built in ${duration}s`)
  console.log(`  Total: ${templates.length} templates`)
  for (const [cat, count] of Object.entries(categories)) {
    console.log(`  ${cat}: ${count}`)
  }
  if (skipped.length > 0) {
    console.log(`  Skipped: ${skipped.length}`)
  }

  return { registry, skipped }
}

// ── CLI entry ──────────────────────────────────────────────────────────────

function isMainEntry(): boolean {
  try {
    const scriptPath = realpathSync(fileURLToPath(import.meta.url))
    const entryPath = realpathSync(process.argv[1])
    return scriptPath === entryPath
  } catch {
    return false
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  const strict = args.includes('--strict') || !!process.env.CI

  let only: string | undefined
  const onlyIdx = args.indexOf('--only')
  if (onlyIdx !== -1) {
    only = args[onlyIdx + 1]
    if (!only) {
      console.error('Error: --only requires a slug argument')
      process.exit(1)
    }
  }

  try {
    await buildRegistry({ strict, only })
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

if (isMainEntry()) {
  main()
}
