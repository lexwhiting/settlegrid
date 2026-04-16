/**
 * Template quality gates — validates template.json manifests under
 * open-source-servers/ and packages/create-settlegrid-tool/templates/.
 *
 * Usage:
 *   npx tsx scripts/quality-gates.ts [--only-changed] [--json]
 *
 * Flags:
 *   --only-changed  Only validate templates modified in the current PR
 *                   (uses git diff origin/main...HEAD)
 *   --json          Emit machine-readable JSON summary to stdout
 */

import { realpathSync } from 'node:fs'
import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { safeValidateTemplateManifest } from '@settlegrid/mcp'

// ── Constants ──────────────────────────────────────────────────────────────

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SCRIPT_DIR, '..')

const TEMPLATE_ROOTS = [
  join(REPO_ROOT, 'open-source-servers'),
  join(REPO_ROOT, 'packages', 'create-settlegrid-tool', 'templates'),
]

// ── Types ──────────────────────────────────────────────────────────────────

export interface GateResult {
  slug: string
  path: string
  valid: boolean
  errors: string[]
}

export interface GateSummary {
  total: number
  passed: number
  failed: number
  results: GateResult[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Get the list of template directories changed in the current PR.
 * Uses `git diff --name-only origin/main...HEAD` to find modified files,
 * then extracts the template directory names.
 */
/**
 * Pure parsing function — given raw git diff output, extracts the set of
 * template directory absolute paths that were modified. Exported for
 * testing with fake diff fixtures.
 */
export function parseChangedTemplateDirs(
  diffOutput: string,
  templateRoots: string[] = TEMPLATE_ROOTS,
  repoRoot: string = REPO_ROOT,
): string[] {
  const changedDirs = new Set<string>()

  for (const line of diffOutput.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    for (const root of templateRoots) {
      const relRoot = root.replace(repoRoot + '/', '')
      if (trimmed.startsWith(relRoot + '/')) {
        const rest = trimmed.slice(relRoot.length + 1)
        const dirName = rest.split('/')[0]
        if (dirName) {
          changedDirs.add(join(root, dirName))
        }
      }
    }
  }

  return [...changedDirs]
}

export function getChangedTemplateDirs(): string[] {
  let diffOutput: string
  try {
    // Ensure origin/main is available (CI may have a shallow clone)
    try {
      execSync('git fetch origin main --depth=1', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    } catch {
      // May already be fetched or may not have an origin
    }

    diffOutput = execSync('git diff --name-only origin/main...HEAD', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch {
    // If git diff fails (e.g., no origin/main), return empty — skip all
    return []
  }

  return parseChangedTemplateDirs(diffOutput)
}

/**
 * Discover all template directories that contain a template.json.
 */
async function discoverAllTemplateDirs(): Promise<string[]> {
  const dirs: string[] = []

  for (const root of TEMPLATE_ROOTS) {
    let entries: string[]
    try {
      entries = await readdir(root)
    } catch {
      continue
    }

    for (const entry of entries) {
      const manifestPath = join(root, entry, 'template.json')
      try {
        const s = await stat(manifestPath)
        if (s.isFile()) dirs.push(join(root, entry))
      } catch {
        // No template.json — skip
      }
    }
  }

  return dirs
}

/**
 * Validate a single template.json manifest.
 */
async function validateTemplate(dir: string): Promise<GateResult> {
  const manifestPath = join(dir, 'template.json')
  const slug = dir.split('/').pop() ?? dir

  try {
    const content = await readFile(manifestPath, 'utf-8')
    const json = JSON.parse(content)
    const result = safeValidateTemplateManifest(json)

    if (result.success) {
      return { slug, path: manifestPath, valid: true, errors: [] }
    }

    return { slug, path: manifestPath, valid: false, errors: result.errors }
  } catch (err) {
    return {
      slug,
      path: manifestPath,
      valid: false,
      errors: [
        `Failed to read/parse: ${err instanceof Error ? err.message : String(err)}`,
      ],
    }
  }
}

// ── Core ───────────────────────────────────────────────────────────────────

export async function runQualityGates(opts: {
  onlyChanged?: boolean
  json?: boolean
}): Promise<GateSummary> {
  let dirs: string[]

  if (opts.onlyChanged) {
    dirs = getChangedTemplateDirs()
    // Filter to only dirs that actually have template.json
    const withManifest: string[] = []
    for (const d of dirs) {
      try {
        await stat(join(d, 'template.json'))
        withManifest.push(d)
      } catch {
        // Changed dir doesn't have template.json — skip
      }
    }
    dirs = withManifest

    if (dirs.length === 0) {
      const summary: GateSummary = {
        total: 0,
        passed: 0,
        failed: 0,
        results: [],
      }
      if (opts.json) {
        console.log(JSON.stringify(summary, null, 2))
      } else {
        console.log('No changed templates to validate.')
      }
      return summary
    }
  } else {
    dirs = await discoverAllTemplateDirs()
  }

  const results: GateResult[] = []
  for (const dir of dirs) {
    results.push(await validateTemplate(dir))
  }

  const passed = results.filter((r) => r.valid).length
  const failed = results.filter((r) => !r.valid).length

  const summary: GateSummary = {
    total: results.length,
    passed,
    failed,
    results,
  }

  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    console.log(`Quality gates: ${passed}/${results.length} passed`)
    for (const r of results) {
      if (r.valid) {
        console.log(`  PASS ${r.slug}`)
      } else {
        console.log(`  FAIL ${r.slug}`)
        for (const e of r.errors) {
          console.log(`    - ${e}`)
        }
      }
    }
  }

  return summary
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
  const onlyChanged = args.includes('--only-changed')
  const json = args.includes('--json')

  const summary = await runQualityGates({ onlyChanged, json })
  if (summary.failed > 0) {
    process.exit(1)
  }
}

if (isMainEntry()) {
  main()
}
