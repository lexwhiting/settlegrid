#!/usr/bin/env node
/**
 * Codemod batch runner (P3.11)
 *
 * Applies EVERY registered codemod to EVERY template under the
 * configured roots. Used by the weekly template-ci GitHub Actions
 * workflow to sweep the whole corpus in one pass.
 *
 * Default roots:
 *   open-source-servers/*
 *   packages/create-settlegrid-tool/templates/*
 *
 * Default mode: dry-run (no writes). Pass `--apply` to persist.
 *
 * Usage:
 *   node scripts/codemods/run-all.mjs             # dry-run
 *   node scripts/codemods/run-all.mjs --apply     # write changes
 *   node scripts/codemods/run-all.mjs --apply --smoke-test 5
 *
 * Exit codes:
 *   0 — clean pass (or dry-run with no errors)
 *   1 — codemod errored on at least one template
 *   2 — post-apply smoke test found a typecheck regression
 *   3 — argument / configuration error
 *
 * The `--smoke-test N` flag runs `tsc --noEmit` on N random
 * templates after applying, to catch transforms that compile
 * individually but break a whole-template typecheck. Only runs
 * when `--apply` is also set. N defaults to 5 if omitted.
 */

import { readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import * as path from 'node:path'
import * as url from 'node:url'

import { runCodemod } from './runner.mjs'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..')

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Roots searched for templates. Every immediate subdirectory of
 * each root is treated as a template.
 *
 * Note: `packages/create-settlegrid-tool/templates/*` is
 * intentionally excluded. Those are pre-scaffold stubs containing
 * `{{PLACEHOLDER}}` tokens substituted at `create-settlegrid-tool`
 * run time — the source files there are not valid TypeScript
 * until after substitution, so a codemod that parses as TS will
 * reliably fail on them. Scaffolded templates (not stubs) end
 * up under `open-source-servers/` after publication and get
 * swept from there.
 */
export const TEMPLATE_ROOTS = ['open-source-servers']

/**
 * Codemods applied in order. Order matters only if two codemods
 * could overlap on the same AST region; the current set is
 * disjoint, so order is for human readability.
 */
export const CODEMODS = [
  // Version-bump codemod requires --from and --to — skip in the
  // batch runner unless explicitly configured. This batch is for
  // transforms that are always safe to apply; version bumps are
  // intentional, manual events.
  'sdk-breaking-changes',
]

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
  const args = {
    apply: false,
    smokeTest: 0,
    baseDir: REPO_ROOT,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--apply') {
      args.apply = true
    } else if (arg === '--smoke-test') {
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) {
        // Default to 5 when no count is supplied.
        args.smokeTest = 5
      } else {
        const n = Number(next)
        if (!Number.isInteger(n) || n < 0) {
          throw new Error(
            `--smoke-test expects a non-negative integer (got ${JSON.stringify(next)})`,
          )
        }
        args.smokeTest = n
        i++
      }
    }
  }
  return args
}

// ---------------------------------------------------------------------------
// Template discovery
// ---------------------------------------------------------------------------

export async function discoverTemplates(
  roots = TEMPLATE_ROOTS,
  baseDir = REPO_ROOT,
) {
  const results = []
  for (const rel of roots) {
    const abs = path.resolve(baseDir, rel)
    if (!existsSync(abs)) continue
    let entries
    try {
      entries = await readdir(abs, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      // Skip hidden dirs.
      if (entry.name.startsWith('.')) continue
      results.push(path.join(abs, entry.name))
    }
  }
  return results.sort()
}

// ---------------------------------------------------------------------------
// Seeded-random picker for the smoke-test sample
// ---------------------------------------------------------------------------

/**
 * Deterministic sample of up to N elements from `arr`, seeded by
 * the current ISO date. The same day always picks the same
 * templates — important so two runs on the same day test the
 * same subset and a regression is reproducible.
 */
export function sampleForSmokeTest(arr, n, seed) {
  if (n <= 0 || arr.length === 0) return []
  // Mulberry32 PRNG seeded by the given string hash. Deterministic
  // across Node versions and architectures.
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h = (h ^ seed.charCodeAt(i)) * 16777619
    h = h >>> 0
  }
  function rand() {
    h = (h + 0x6d2b79f5) >>> 0
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const copy = [...arr]
  const pick = []
  const target = Math.min(n, copy.length)
  for (let i = 0; i < target; i++) {
    const idx = Math.floor(rand() * copy.length)
    pick.push(copy[idx])
    copy.splice(idx, 1)
  }
  return pick
}

// ---------------------------------------------------------------------------
// tsc smoke test
// ---------------------------------------------------------------------------

/**
 * Run `tsc --noEmit` against a single template directory. Returns
 * `{ ok: boolean, stderr: string }`. Non-zero exit = regression.
 *
 * Templates typically have their own `tsconfig.json`; if not,
 * skip them (nothing to typecheck).
 */
export async function runTscOnTemplate(templateDir) {
  const tsconfig = path.join(templateDir, 'tsconfig.json')
  if (!existsSync(tsconfig)) {
    return { ok: true, stderr: '', skipped: true }
  }
  return new Promise((resolve) => {
    const child = spawn(
      'npx',
      ['tsc', '--noEmit', '-p', tsconfig],
      { cwd: templateDir, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let stderr = ''
    child.stdout?.on('data', (d) => (stderr += d.toString()))
    child.stderr?.on('data', (d) => (stderr += d.toString()))
    child.on('close', (code) => {
      resolve({ ok: code === 0, stderr, skipped: false })
    })
    child.on('error', (err) => {
      resolve({
        ok: false,
        stderr: `spawn error: ${err.message}`,
        skipped: false,
      })
    })
  })
}

// ---------------------------------------------------------------------------
// Main orchestration
// ---------------------------------------------------------------------------

/**
 * Apply every codemod to every discovered template. Returns
 * an aggregated summary.
 */
export async function runAll(opts = {}) {
  const apply = opts.apply === true
  const baseDir = opts.baseDir ?? REPO_ROOT
  const roots = opts.roots ?? TEMPLATE_ROOTS
  const codemods = opts.codemods ?? CODEMODS

  const templates = await discoverTemplates(roots, baseDir)

  const byCodemod = {}
  let totalTemplates = 0
  let totalFilesTouched = 0
  let totalErrors = 0

  for (const codemod of codemods) {
    byCodemod[codemod] = { templates: 0, filesTouched: 0, errors: [] }
    for (const templateDir of templates) {
      const summary = await runCodemod({
        codemod,
        target: templateDir,
        apply,
        baseDir,
        persistLastRun: false,
      })
      // runCodemod runs against the resolved glob. When target is a
      // single directory, templates[0] is that directory.
      const per = summary.templates[0]
      if (!per) continue
      byCodemod[codemod].templates += 1
      byCodemod[codemod].filesTouched += per.filesTouched.length
      if (per.errors.length > 0) {
        byCodemod[codemod].errors.push({
          template: path.relative(baseDir, templateDir),
          errors: per.errors,
        })
      }
    }
    totalTemplates = Math.max(totalTemplates, byCodemod[codemod].templates)
    totalFilesTouched += byCodemod[codemod].filesTouched
    totalErrors += byCodemod[codemod].errors.length
  }

  return {
    apply,
    roots,
    codemods,
    templatesDiscovered: templates.length,
    perCodemod: byCodemod,
    totals: {
      templates: totalTemplates,
      filesTouched: totalFilesTouched,
      errors: totalErrors,
    },
  }
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

async function cliMain() {
  let args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (err) {
    console.error(`[run-all] ${err.message}`)
    process.exit(3)
  }

  const result = await runAll(args)
  console.log(
    `[run-all] discovered ${result.templatesDiscovered} templates, ` +
      `ran ${result.codemods.length} codemod(s), ` +
      `${result.totals.filesTouched} files ` +
      `${args.apply ? 'touched' : 'would touch'}, ` +
      `${result.totals.errors} template(s) errored`,
  )

  for (const [name, stats] of Object.entries(result.perCodemod)) {
    console.log(
      `  [${name}] ${stats.filesTouched} files across ` +
        `${stats.templates} templates (${stats.errors.length} errors)`,
    )
    for (const e of stats.errors) {
      console.log(`    ! ${e.template}: ${e.errors.join('; ')}`)
    }
  }

  if (result.totals.errors > 0) {
    console.error('[run-all] at least one template errored; exiting 1')
    process.exit(1)
  }

  // Smoke test: tsc on a seeded-random sample of templates. Only
  // runs when --apply is set AND --smoke-test is requested — the
  // dry-run mode produces no file changes, so there's nothing to
  // regression-check.
  if (args.apply && args.smokeTest > 0) {
    const discovered = await discoverTemplates(result.roots)
    const seed = new Date().toISOString().slice(0, 10)
    const sample = sampleForSmokeTest(discovered, args.smokeTest, seed)
    console.log(
      `[run-all] smoke-testing ${sample.length} template(s) with tsc --noEmit (seed=${seed})`,
    )
    let failures = 0
    for (const templateDir of sample) {
      const rel = path.relative(REPO_ROOT, templateDir)
      const { ok, stderr, skipped } = await runTscOnTemplate(templateDir)
      if (skipped) {
        console.log(`  - ${rel}: skipped (no tsconfig.json)`)
        continue
      }
      if (ok) {
        console.log(`  ✓ ${rel}`)
      } else {
        failures += 1
        console.log(`  ✗ ${rel}`)
        console.log(stderr.split('\n').slice(0, 20).map((l) => `      ${l}`).join('\n'))
      }
    }
    if (failures > 0) {
      console.error(
        `[run-all] ${failures} smoke-test template(s) failed typecheck; exiting 2`,
      )
      process.exit(2)
    }
  }

  console.log('[run-all] done')
}

if (import.meta.url === url.pathToFileURL(process.argv[1] || '').href) {
  cliMain().catch((err) => {
    console.error(
      '[run-all] fatal:',
      err instanceof Error ? err.stack : err,
    )
    process.exit(2)
  })
}
