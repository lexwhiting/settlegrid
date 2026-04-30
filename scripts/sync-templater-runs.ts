#!/usr/bin/env tsx
/**
 * Sync Templater run summaries from the agents repo into the web repo
 * so the admin dashboard reads deterministic, committed JSON instead
 * of a live FS outside its own bundle.
 *
 * Source:  /Users/lex/settlegrid-agents/data/templater/runs/*-summary.json
 * Dest:    apps/web/src/data/templater-runs/<runId>.json
 *
 * Filenames are normalized to `<runId>.json` (the runId field already
 * encodes the run type and timestamp, so this keeps dest names stable
 * whether the source is a scale run or retry-rejected).
 *
 * Idempotent: a byte-identical re-sync makes no changes.
 *
 * Usage:
 *   npx tsx scripts/sync-templater-runs.ts
 *     [--source /path/to/agents/data/templater/runs]
 *     [--dest   apps/web/src/data/templater-runs]
 *     [--dry-run]
 */

import { promises as fsp } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..')

const DEFAULT_SOURCE = '/Users/lex/settlegrid-agents/data/templater/runs'
const DEFAULT_DEST = path.join(
  REPO_ROOT,
  'apps',
  'web',
  'src',
  'data',
  'templater-runs',
)

export interface SyncOptions {
  source: string
  dest: string
  dryRun: boolean
}

export function parseArgs(argv: string[]): SyncOptions {
  const opts: SyncOptions = {
    source: DEFAULT_SOURCE,
    dest: DEFAULT_DEST,
    dryRun: false,
  }
  // Require a value for --source/--dest. Without this check, passing
  // `--source` (with no argument) would silently set source=undefined
  // and crash later at readdir with a cryptic TypeError. Surface the
  // bad invocation up-front instead.
  const requireValue = (flag: string, value: string | undefined): string => {
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`${flag} requires a value`)
    }
    return value
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--source') opts.source = requireValue('--source', argv[++i])
    else if (a === '--dest') opts.dest = requireValue('--dest', argv[++i])
    else if (a === '--dry-run') opts.dryRun = true
    else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: sync-templater-runs.ts [--source <dir>] [--dest <dir>] [--dry-run]',
      )
      process.exit(0)
    }
  }
  return opts
}

export interface SyncResult {
  copied: string[]
  unchanged: string[]
  invalid: Array<{ file: string; reason: string }>
  sourceMissing: boolean
}

/**
 * Structural check before copying — refuses to sync a summary file
 * that's missing the fields the dashboard requires, since "garbage
 * in, garbage out" at commit time is worse than "skipped; please
 * investigate".
 */
function looksLikeSummary(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  return (
    typeof o.runId === 'string' &&
    typeof o.startedAt === 'string' &&
    typeof o.totalAttempts === 'number' &&
    typeof o.passed === 'number' &&
    Array.isArray(o.topFailureClusters)
  )
}

export async function sync(opts: SyncOptions): Promise<SyncResult> {
  const result: SyncResult = {
    copied: [],
    unchanged: [],
    invalid: [],
    sourceMissing: false,
  }
  let files: string[]
  try {
    files = await fsp.readdir(opts.source)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      result.sourceMissing = true
      return result
    }
    throw err
  }

  const summaries = files.filter(
    (f) => f.endsWith('-summary.json') && !f.startsWith('.'),
  )

  if (!opts.dryRun) {
    await fsp.mkdir(opts.dest, { recursive: true })
  }

  // Track safe-slugged IDs emitted in this run so we can detect
  // collisions (e.g., runIds "run/a" and "run-a" both slug to the
  // same dest name). Silent overwrite would mean the dashboard loses
  // a snapshot — report as invalid instead.
  const seenDestNames = new Map<string, string>() // destName -> source file

  for (const file of summaries) {
    const srcPath = path.join(opts.source, file)
    let raw: string
    try {
      raw = await fsp.readFile(srcPath, 'utf-8')
    } catch (err) {
      result.invalid.push({ file, reason: (err as Error).message })
      continue
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      result.invalid.push({ file, reason: `JSON parse: ${(err as Error).message}` })
      continue
    }
    if (!looksLikeSummary(parsed)) {
      result.invalid.push({ file, reason: 'missing required summary fields' })
      continue
    }
    const runId = (parsed as { runId: string }).runId
    // Defensive: a runId containing "/" or ".." could escape the dest
    // directory. Normalize to a safe slug by replacing anything that
    // isn't [A-Za-z0-9_-] with "_".
    const safeId = runId.replace(/[^A-Za-z0-9_-]/g, '_')
    const destName = `${safeId}.json`

    const priorFile = seenDestNames.get(destName)
    if (priorFile) {
      result.invalid.push({
        file,
        reason: `runId collides with ${priorFile} after safe-slug (both produce ${destName}); rename one upstream`,
      })
      continue
    }
    seenDestNames.set(destName, file)

    const destPath = path.join(opts.dest, destName)

    // Re-stringify with consistent formatting so idempotency is robust
    // across different emitter versions (trailing newline, 2-space
    // indent).
    const normalized = JSON.stringify(parsed, null, 2) + '\n'

    let existing: string | null = null
    try {
      existing = await fsp.readFile(destPath, 'utf-8')
    } catch {
      existing = null
    }
    if (existing === normalized) {
      result.unchanged.push(destName)
      continue
    }
    if (!opts.dryRun) {
      await fsp.writeFile(destPath, normalized, 'utf-8')
    }
    result.copied.push(destName)
  }
  return result
}

export async function main(): Promise<void> {
  const opts = parseArgs(process.argv)
  console.log(`[sync-templater-runs] source: ${opts.source}`)
  console.log(`[sync-templater-runs] dest:   ${opts.dest}`)
  if (opts.dryRun) console.log('[sync-templater-runs] DRY RUN — no writes')

  const r = await sync(opts)
  if (r.sourceMissing) {
    console.warn(`[sync-templater-runs] source directory does not exist — nothing to do`)
    return
  }
  console.log(
    `[sync-templater-runs] copied=${r.copied.length} unchanged=${r.unchanged.length} invalid=${r.invalid.length}`,
  )
  for (const c of r.copied) console.log(`  + ${c}`)
  for (const u of r.unchanged) console.log(`  = ${u}`)
  for (const inv of r.invalid) console.warn(`  ! ${inv.file}: ${inv.reason}`)

  // Exit non-zero when any file failed to sync so CI/CD (or an
  // operator piping stdout) notices. Previously silent: the script
  // would exit 0 with "1 invalid file" only visible in stderr, and
  // an unattended sync could land a half-empty committed snapshot
  // directory.
  if (r.invalid.length > 0) {
    process.exitCode = 2
  }
}

// Run `main` when invoked directly (not when imported by tests).
const thisFile = fileURLToPath(import.meta.url)
const invokedAs = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (thisFile === invokedAs) {
  main().catch((err) => {
    console.error('[sync-templater-runs] fatal:', err)
    process.exit(1)
  })
}
